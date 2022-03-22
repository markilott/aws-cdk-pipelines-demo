/**
 * You can use this to manually deploy the application stack using CDK deploy.
 *
 * Will deploy into the current default CLI account.
 *
 * Deployment:
 * cdk deploy --all -a "npx ts-node bin/app-deploy.ts"
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { ApplicationStack } from '../lib/application/application-stage';
import { options } from '../config';

const app = new App();

// use account details from default AWS credentials:
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

new ApplicationStack(app, 'LambdaApi', {
    stackName: 'TestApiStack',
    description: 'Lambda API Test Stack',
    env: { account, region },
    version: options.version,
});
