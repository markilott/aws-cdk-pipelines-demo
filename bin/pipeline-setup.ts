/**
 * These stacks prepare the Dev account and Tools account for the Pipelines. They should be run first.
 *
 * Update config/index.ts with your account numbers and repo name before beginning.
 *
 * You will also need to run the Pipeline stacks from pipeline-deploy.ts after this stack.
 *
 * Deploy both stacks:
 * cdk deploy --all -a "npx ts-node bin/pipeline-setup.ts"
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { PipelinePrepStack, CodeCommitStack } from '../lib/pipeline/pipeline-stack';
import { options } from '../config';

const {
    defaultRegion, toolsAccount, codeCommitAccount,
} = options;
const app = new App();

/**
 * Preparation stack for the Pipeline Account
 * Run this stack first.
 *
 * Deployment:
 * cdk deploy PipelineAccountPrepStack -a "npx ts-node bin/pipeline-setup.ts"
 */
const pipelinePrep = new PipelinePrepStack(app, 'PipelineAccountPrepStack', {
    description: 'Pipeline Account Prep Stack',
    env: { region: defaultRegion, account: toolsAccount },
    options,
});

/**
 * Optionally create the CodeCommit repository.
 *
 * Deployment:
 * cdk deploy CodeCommitStack -a "npx ts-node bin/pipeline-setup.ts"
 */
const sourcePrep = new CodeCommitStack(app, 'CodeCommitStack', {
    description: 'CodeCommit Repository Stack',
    env: { region: defaultRegion, account: codeCommitAccount },
    options,
});
sourcePrep.addDependency(pipelinePrep, 'Access to the event bus is required in Pipeline account');
