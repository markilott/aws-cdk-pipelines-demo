/**
 * You can use this to manually deploy the application stack using CDK deploy.
 *
 * Will deploy into the current default CLI account.
 *
 * Deployment:
 * cdk deploy --all -a "node bin/app-deploy.js" --outputs-file api-outputs.json
 */

/* eslint-disable no-new */
const cdk = require('@aws-cdk/core');
const { ApplicationStack } = require('../lib/application/application-stage');
const options = require('./options.json');

const app = new cdk.App();

// use account details from default AWS credentials:
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

new ApplicationStack(app, 'LambdaApi', {
    stackName: 'TestApiStack',
    description: 'Lambda API Test Stack',
    env: { account, region },
    version: options.version,
});
