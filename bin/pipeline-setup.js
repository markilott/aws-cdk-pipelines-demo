/**
 * You can use the CloudFormation templates in lib/cfn-templates to prepare the accounts,
 * or you can use cdk deploy and setup from here.
 *
 * Update options.json with your account numbers and repo name before beginning.
 *
 * You will also need to run the Pipeline stacks from pipeline-deploy.js
 */

/* eslint-disable no-new */
const cdk = require('@aws-cdk/core');
const { PipelinePrepStack, SourcePrepStack } = require('../lib/pipeline/pipeline-stack');
const options = require('./options.json');

const {
    region, codeCommitAccessRoleName, devAccount, toolsAccount, pipelineResources,
} = options;
const app = new cdk.App();

/**
 * Preparation stack for the Pipeline Account
 * Run this stack first.
 *
 * Deployment:
 * cdk deploy Pipeline-Account-Prep -a "node bin/pipeline-setup.js"
 */
new PipelinePrepStack(app, 'Pipeline-Account-Prep', {
    description: 'Pipeline Account Prep Stack',
    env: { region, account: toolsAccount },
    devAccount,
});

/**
 * Preparation stack for the CodeCommit Account.
 *
 * This stack needs to be run once for setup, then again after each pipeline is created.
 *
 * Deployment:
 * cdk deploy Source-Account-Prep -a "node bin/pipeline-setup.js"
 */
new SourcePrepStack(app, 'Source-Account-Prep', {
    description: 'CodeCommit Account Prep Stack',
    env: { region, account: devAccount },
    codeCommitAccessRoleName,
    pipelineResources,
});
