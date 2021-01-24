/**
 * Pipeline Stacks
 * This creates the Pipelines, and is also called to deploy the app via the pipeline.
 *
 * Assumes branch names dev, uat, main. You can change below if required.
 * Update all branches in CodeCommit before deploying the pipelines.
 */

/* eslint-disable no-new */
const cdk = require('@aws-cdk/core');
const { PipelineStack } = require('../lib/pipeline/pipeline-stack');
const options = require('./options.json');

const {
    region, codeCommitAccessRoleName, devAccount, uatAccount, prodAccount, toolsAccount, repoName, version,
} = options;
const app = new cdk.App();

/**
 * Dev Account stack
 *
 * Deployment:
 * cdk deploy Pipeline-DEV --outputs-file dev-pipeline-outputs.json
 *
 * Create CloudFormation template:
 * cdk synth Pipeline-DEV > dev-pipeline.yaml
 */
new PipelineStack(app, 'Pipeline-DEV', {
    description: 'Dev Pipeline Stack',
    env: { region, account: toolsAccount },
    deployEnv: { region, account: devAccount },
    codeCommitAccessRoleName,
    devAccount,
    repoName,
    branch: 'dev',
    preApproval: false, // require approval before Create Change Set
    execApproval: false, // require approval before Execute Change Set
    version,
});

/**
 * UAT Account stack
 *
 * Deployment:
 * cdk deploy Pipeline-UAT --outputs-file uat-pipeline-outputs.json
 *
 * Create CloudFormation template:
 * cdk synth Pipeline-UAT > uat-pipeline.yaml
 */
new PipelineStack(app, 'Pipeline-UAT', {
    description: 'UAT Pipeline Stack',
    env: { region, account: toolsAccount },
    deployEnv: { region, account: uatAccount },
    codeCommitAccessRoleName,
    devAccount,
    repoName,
    branch: 'uat',
    preApproval: true,
    execApproval: false,
    version,
});

/**
 * Prod Account stack
 *
 * Deployment:
 * cdk deploy Pipeline-PROD --outputs-file prod-pipeline-outputs.json
 *
 * Create CloudFormation template:
 * cdk synth Pipeline-PROD > prod-pipeline.yaml
 */
new PipelineStack(app, 'Pipeline-PROD', {
    description: 'Prod Pipeline Stack',
    env: { region, account: toolsAccount },
    deployEnv: { region, account: prodAccount },
    codeCommitAccessRoleName,
    devAccount,
    repoName,
    branch: 'main',
    preApproval: true,
    execApproval: true,
    version,
});
