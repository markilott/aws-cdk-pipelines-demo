/* eslint-disable max-classes-per-file */
/* eslint-disable no-new */
import { Construct } from 'constructs';
import {
    Stack, StackProps, CfnOutput,
} from 'aws-cdk-lib';
import {
    CodePipeline, CodePipelineSource, ManualApprovalStep, ShellStep,
} from 'aws-cdk-lib/pipelines';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CfnEventBusPolicy, CfnRule } from 'aws-cdk-lib/aws-events';
import {
    Role, PolicyStatement, Effect, ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Options } from '../../types';
import { ApplicationStage } from '../application/application-stage';

interface PipelineStackProps extends StackProps {
    deployEnv: {
        region: string,
        account: string,
    },
    branch: string,
    preApproval?: boolean,
    envName: string,
    options: Options,
}

export class PipelineStack extends Stack {
    /**
     * Creates a deployment Pipeline.
     * Can be run for each environment to create separate
     * pipelines for each.
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

        // Environment props
        const {
            deployEnv, branch, preApproval, envName, options,
        } = props;

        // Common options
        const {
            repoName, codeCommitAccount, codeCommitAccessRoleName, version,
            pipelineName, cdkBootstrapQualifier, pipelineBaseResourceName, pipelineResourceName, deployStageResourceName,
        } = options;

        // Import the repository
        const repository = Repository.fromRepositoryArn(this, `${repoName}-${branch}`, `arn:aws:codecommit:${this.region}:${codeCommitAccount}:${repoName}`);

        // Role is created externally because it must exist for helper stacks that are created before this stack completes
        const pipelineBaseRole = Role.fromRoleArn(this, 'pipelineBaseRole', `arn:aws:iam::${this.account}:role/${codeCommitAccessRoleName}`, {
            mutable: false,
            addGrantsToResources: true, // Causes CDK to update the resource policy where required, instead of the Role
        });

        // Creating base pipeline from CDK CodePipeline so we can specify the role manually
        const pipelineBase = new Pipeline(this, pipelineBaseResourceName, {
            pipelineName: `${pipelineName}-${envName}-${deployEnv.region}`,
            role: pipelineBaseRole,
        });

        // Complete the pipeline using CDK Pipelines
        const pipeline = new CodePipeline(this, pipelineResourceName, {
            codePipeline: pipelineBase,
            // selfMutation: false,
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.codeCommit(repository, branch),
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth',
                ],
            }),
            selfMutationCodeBuildDefaults: {
                rolePolicy: [
                    new PolicyStatement({
                        sid: 'CcAccountRole',
                        effect: Effect.ALLOW,
                        actions: [
                            'sts:AssumeRole',
                        ],
                        resources: [
                            // CodeCommit account cdk roles - to allow for update of the support stack during self mutation
                            `arn:aws:iam::${codeCommitAccount}:role/cdk-${cdkBootstrapQualifier}-deploy-role-${codeCommitAccount}-${this.region}`,
                            `arn:aws:iam::${codeCommitAccount}:role/cdk-${cdkBootstrapQualifier}-file-publishing-role-${codeCommitAccount}-${this.region}`,
                        ],
                    }),
                ],
            },
        });

        const applicationStage = new ApplicationStage(this, deployStageResourceName, {
            env: deployEnv,
            version,
        });
        pipeline.addStage(applicationStage, {
            pre: (preApproval) ? [
                new ManualApprovalStep('PreApproval'),
            ] : [],
        });
    }
}

interface PipelinePrepStackProps extends StackProps {
    options: Options,
}

export class PipelinePrepStack extends Stack {
    /**
     * Creates the Event Bus Policy required by the Pipeline in the Tools account.
     * Allows for triggering of the Pipeline from CodeCommit in a different Account.
     * Only required for cross-account CodeCommit/Pipeline.
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope: Construct, id: string, props: PipelinePrepStackProps) {
        super(scope, id, props);

        const { options } = props;
        const {
            codeCommitAccount, codeCommitAccessRoleName, pipelineName,
            cdkBootstrapQualifier, stackNamePrefix, pipelineBaseResourceName, pipelineResourceName, deployStageResourceName,
        } = options;

        // Allow CodeCommit account EventBus to put events to Pipeline account EventBus
        // This is used to trigger the pipeline from CodeCommit updates in the Development account
        new CfnEventBusPolicy(this, 'eventsPolicy', {
            statementId: 'CodeCommit',
            eventBusName: 'default',
            statement: {
                Effect: 'Allow',
                Principal: { AWS: `arn:aws:iam::${codeCommitAccount}:root` },
                Action: 'events:PutEvents',
                Resource: `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
            },
        });

        // Base Role for pipelines. Created here as it is required outside of the pipeline stack for cross-region deployments.
        const pipelineBaseRole = new Role(this, 'pipelineBaseRole', {
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
            roleName: codeCommitAccessRoleName,
            description: 'Role used by CodePipelines to allow for cross-account deployments',
        });
        pipelineBaseRole.addToPolicy(new PolicyStatement({
            sid: 'AssumeRoles',
            effect: Effect.ALLOW,
            actions: [
                'sts:AssumeRole',
            ],
            resources: [
                // Roles that the Pipelines will need to assume during source, build and deploy.
                // The resource Arn's are created using params that are shared with the Pipeline stacks, so we have predictable Arn's.

                // Destination accounts CDK deploy role
                `arn:aws:iam::*:role/cdk-${cdkBootstrapQualifier}-deploy-role-*`,

                // Helper stacks in the pipeline account
                `arn:aws:iam::${this.account}:role/${pipelineName}*`,

                // All of the CodeBuild assets roles
                `arn:aws:iam::${this.account}:role/*${pipelineResourceName}Assets*`,
                `arn:aws:iam::${this.account}:role/*${pipelineResourceName}Update*`,
                `arn:aws:iam::${this.account}:role/*${pipelineResourceName}Build*`,
                `arn:aws:iam::${this.account}:role/*${pipelineResourceName}${deployStageResourceName}*`,
                `arn:aws:iam::${this.account}:role/*${pipelineBaseResourceName}Assets*`,
                `arn:aws:iam::${this.account}:role/*${pipelineBaseResourceName}Update*`,
                `arn:aws:iam::${this.account}:role/*${pipelineBaseResourceName}Build*`,
                `arn:aws:iam::${this.account}:role/*${pipelineBaseResourceName}${deployStageResourceName}*`,

                // The helper role created by CDK Pipelines in the CodeCommit Account (CDK creates this role in lowercase only)
                `arn:aws:iam::${codeCommitAccount}:role/${stackNamePrefix.toLowerCase()}*`,
            ],
        }));
    }
}

interface CodeCommitStackProps extends StackProps {
    options: Options,
}

export class CodeCommitStack extends Stack {
    /**
     * Creates the CodeCommit Repository.
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope: Construct, id: string, props: CodeCommitStackProps) {
        super(scope, id, props);

        const { options } = props;
        const { repoName, toolsAccount, createRepo } = options;

        if (createRepo) {
            const repo = new Repository(this, 'repo', {
                repositoryName: repoName,
                description: 'Cross-account pipelines demo',
            });

            new CfnOutput(this, 'repositoryCloneUrlGrc', {
                description: 'Repository Clone Url Grc',
                value: repo.repositoryCloneUrlGrc,
            });
            new CfnOutput(this, 'repositoryCloneUrlHttp', {
                description: 'Repository Clone Url Http',
                value: repo.repositoryCloneUrlHttp,
            });
            new CfnOutput(this, 'repositoryCloneUrlSsh', {
                description: 'Repository Clone Url Ssh',
                value: repo.repositoryCloneUrlSsh,
            });
        }

        // Create an Events rule to send all CodeCommit repository updates for our repo to the Pipeline Account.
        // They are filtered by branch at the other end by the Pipeline rules.
        // The Event Bus Policy in the Pipeline account must be created to allow this first (in the PipelinePrepStack above).
        new CfnRule(this, 'UpdateToPipeline', {
            description: 'Send CodeCommit events to Pipeline Account',
            eventBusName: 'default',
            eventPattern: {
                'detail-type': ['CodeCommit Repository State Change'],
                source: ['aws.codecommit'],
                resources: [`arn:aws:codecommit:${this.region}:${this.account}:${repoName}`],
            },
            state: 'ENABLED',
            targets: [{
                arn: `arn:aws:events:${this.region}:${toolsAccount}:event-bus/default`,
                id: 'PipelineDemo',
            }],
        });
    }
}
