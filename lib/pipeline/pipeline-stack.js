/* eslint-disable max-classes-per-file */
/* eslint-disable no-new */
const { Stack, CfnOutput } = require('@aws-cdk/core');
const { CdkPipeline, SimpleSynthAction } = require('@aws-cdk/pipelines');
const codepipeline = require('@aws-cdk/aws-codepipeline');
const cpactions = require('@aws-cdk/aws-codepipeline-actions');
const codecommit = require('@aws-cdk/aws-codecommit');
const { CfnEventBusPolicy } = require('@aws-cdk/aws-events');
const iam = require('@aws-cdk/aws-iam');
const events = require('@aws-cdk/aws-events');
const { ApplicationStage } = require('../application/application-stage');

class PipelineStack extends Stack {
    /**
     * Creates a deployment Pipeline.
     * Can be run for each environment to create separate
     * pipelines for each.
     *
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const {
            deployEnv, repoName, branch, codeCommitAccessRoleName, devAccount, preApproval, execApproval, version,
        } = props;
        const envName = branch;

        // Artifacts to be created in Pipeline
        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();

        // CodeCommit source action
        const sourceActionProps = {
            actionName: 'GetCodeCommitSource',
            output: sourceArtifact,
            branch,
            repository: codecommit.Repository.fromRepositoryArn(this, `${repoName}-${branch}`, `arn:aws:codecommit:${this.region}:${devAccount}:${repoName}`),
        };

        // Assume role in CodeCommit Account to get source
        sourceActionProps.role = iam.Role.fromRoleArn(this, 'ccRole', `arn:aws:iam::${devAccount}:role/${codeCommitAccessRoleName}`);

        // Create the pipeline
        const pipeline = new CdkPipeline(this, `${envName}Pipeline`, {
            pipelineName: `${envName}-pipeline`,
            cloudAssemblyArtifact,

            // Source stage
            sourceAction: new cpactions.CodeCommitSourceAction(sourceActionProps),

            // Build stage - CodeBuild action to run CDK Deploy
            synthAction: SimpleSynthAction.standardNpmSynth({
                actionName: 'TemplateSynth',
                sourceArtifact,
                cloudAssemblyArtifact,
                synthCommand: 'npx cdk synth -a "node bin/pipeline-deploy"',
                buildCommand: 'npm run build', // npm install for the Lambda
            }),
        });

        // Add approval stage before creating CloudFormation Change Set
        if (preApproval) {
            const preApprovalStage = pipeline.addStage('CreateChangeSetApproval');
            preApprovalStage.addManualApprovalAction({
                actionName: 'ApproveChangeSetCreation',
            });
        }

        // Application deployment stage
        pipeline.addApplicationStage(new ApplicationStage(this, 'DeployStage', {
            env: deployEnv,
            version,
         }),
            {
                manualApprovals: execApproval, // Add approval stage before executing CloudFormation Change Set
                extraRunOrderSpace: 1,
            });

        // Bucket and Key Arn required in the CodeCommit account Role Policy. We can complete the CodeCommit role after we have these.
        new CfnOutput(this, 'artifactBucket', {
            description: 'Pipeline Artifact Bucket Arn',
            value: pipeline.codePipeline.artifactBucket.bucketArn,
        });
        new CfnOutput(this, 'kmsKey', {
            description: 'Pipeline KMS Key Arn',
            value: pipeline.codePipeline.artifactBucket.encryptionKey.keyArn,
        });
    }
}

class PipelinePrepStack extends Stack {
    /**
     * Creates the Event Bus Policy required by the Pipeline.
     * Allows for triggering of the Pipeline from CodeCommit
     * in a different Account.
     * Only required for cross-account CodeCommit/Pipeline.
     *
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const { devAccount } = props;

        // allow CodeCommit account EventBus to put events to Pipeline account EventBus
        // this is used to trigger the pipeline from CodeCommit updates in the Dev account
        new CfnEventBusPolicy(this, 'eventsPolicy', {
            statementId: 'IntegCodeCommit',
            eventBusName: 'default',
            statement: {
                Effect: 'Allow',
                Principal: { AWS: `arn:aws:iam::${devAccount}:root` },
                Action: 'events:PutEvents',
                Resource: `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
            },
        });
    }
}

class SourcePrepStack extends Stack {
    /**
     * Create Role for Pipeline to assume in CodeCommit Account.
     * This stack is run once to create a blank Role, so that the Pipeline stack can create.
     * Then after we have the Bucket and Key Arn for each environment we can run again to complete.
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const {
            codeCommitAccessRoleName, pipelineResources, repoName, toolsAccount,
        } = props;
        const {
            bucketArnDev, keyArnDev, bucketArnUat, keyArnUat, bucketArnProd, keyArnProd,
        } = pipelineResources;

        const repoArn = `arn:aws:codecommit:${this.region}:${this.account}:${repoName}`;

        // allow access to Pipeline artifacts buckets
        const s3Props = {
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject*',
                's3:PutObject',
                's3:PutObjectAcl',
            ],
        };
        const s3PolicyDev = new iam.PolicyStatement({
            resources: [bucketArnDev, `${bucketArnDev}/*`],
            ...s3Props,
        });
        const s3PolicyUat = new iam.PolicyStatement({
            resources: [bucketArnUat, `${bucketArnUat}/*`],
            ...s3Props,
        });
        const s3PolicyProd = new iam.PolicyStatement({
            resources: [bucketArnProd, `${bucketArnProd}/*`],
            ...s3Props,
        });

        // allow access to KMS keys for artifacts bucket encryption
        const kmsProps = {
            effect: iam.Effect.ALLOW,
            actions: [
                'kms:DescribeKey',
                'kms:GenerateDataKey*',
                'kms:Encrypt',
                'kms:ReEncrypt*',
                'kms:Decrypt',
            ],
        };
        const kmsPolicyDev = new iam.PolicyStatement({
            resources: [keyArnDev],
            ...kmsProps,
        });
        const kmsPolicyUat = new iam.PolicyStatement({
            resources: [keyArnUat],
            ...kmsProps,
        });
        const kmsPolicyProd = new iam.PolicyStatement({
            resources: [keyArnProd],
            ...kmsProps,
        });

        // allow access to CodeCommit repo
        const ccPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'codecommit:UploadArchive',
                'codecommit:GetCommit',
                'codecommit:GetUploadArchiveStatus',
                'codecommit:ListBranches',
                'codecommit:GetComment',
                'codecommit:GetCommitHistory',
                'codecommit:GetBranch',
            ],
            resources: [repoArn],
        });
        // allow access to list all repos
        const ccGlobalPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['codecommit:ListRepositories'],
            resources: ['*'],
        });
        // Role to be assumed by the Pipeline
        const ccRole = new iam.Role(this, 'ccRole', {
            roleName: codeCommitAccessRoleName,
            assumedBy: new iam.ArnPrincipal(`arn:aws:iam::${toolsAccount}:root`),
        });

        // Include the Policies after we have the Bucket and Key Arns
        let statements = [ccPolicy, ccGlobalPolicy];
        if (bucketArnDev && keyArnDev) {
            statements = [...statements, s3PolicyDev, kmsPolicyDev];
        }
        if (bucketArnUat && keyArnUat) {
            statements = [...statements, s3PolicyUat, kmsPolicyUat];
        }
        if (bucketArnProd && keyArnProd) {
            statements = [...statements, s3PolicyProd, kmsPolicyProd];
        }
        // attach the policies to the Role
        ccRole.attachInlinePolicy(new iam.Policy(this, 'CodeCommitPipelinePolicy', { statements }));

        new CfnOutput(this, 'roleArn', {
            description: 'CodeCommit Pipeline Role Arn',
            value: ccRole.roleArn,
        });

        // create an Events rule to send all CodeCommit repository updates for our repo to Pipeline Account
        // they are filtered by branch at the other end by the Pipeline rules
        new events.CfnRule(this, 'UpdateToPipeline', {
            description: 'Send CodeCommit events to Pipeline Account',
            eventBusName: 'default',
            eventPattern: {
                'detail-type': ['CodeCommit Repository State Change'],
                source: ['aws.codecommit'],
                resources: [repoArn],
            },
            state: 'ENABLED',
            targets: [{
                arn: `arn:aws:events:${this.region}:${toolsAccount}:event-bus/default`,
                id: 'PipelineDemo',
            }],
        });
    }
}

module.exports = { PipelineStack, PipelinePrepStack, SourcePrepStack };
