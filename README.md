# AWS CDK Cross-Account Pipeline Demo

This Typescript CDK project creates a Pipeline in a Tools Account, to deploy an application from code in CodeCommit in a Dev account,
into Dev, Pre-Prod and Prod environments in their own accounts.

We are using CDK v2 and the new GA version of CDK Pipelines.

Specifically, we have (by default):
- A Dev account, where the code resides in CodeCommit repositories, and where development code is deployed.
- A UAT (Pre-Prod/Staging) account - a production like environment used for business acceptance testing.
- A Prod account, for production deployment, obviously.
- A Tools (Shared Services) account, where CodePipeline will be used to build and deploy into Dev, UAT and Prod.

You can read about the concepts behind it and more detailed instructions [in this Medium article](https://markilott.medium.com/cdk-cross-account-pipelines-22e9cdc3c566).

This Readme assumes you already have a good understanding of CDK deployments. If you are just starting out, read the blog article first.

You can deploy the preparation and pipeline stacks using CDK deploy or CloudFormation.

&nbsp;

## Requirements

You will need a minimum of 2 accounts to complete a demo - Tools and Dev. Ideally you will have at least one of
the pre-prod or prod accounts as well.

There are no other requirements in the AWS environments.

&nbsp;

## Setup

Assuming you have the AWS CLI and CDK installed and configured already...

Setup the project:
- Clone the repo
- `npm install`
- `npm run build`
- Update the `config/index.ts` file with your own environment details and preferences

&nbsp;

## Account Preparation

The Tools, Dev and application accounts need to be Bootstrapped for the cross-account Pipeline. Your Tools Account must be trusted by the other Accounts.

Using CloudFormation:
- Deploy CDK Bootstrap into all accounts using the [AWS template here](https://github.com/aws/aws-cdk/blob/master/packages/aws-cdk/lib/api/bootstrap/bootstrap-template.yaml).
- Your Tools account number needs to be included in the Trusted Accounts parameter. Use `arn:aws:iam::aws:policy/AdministratorAccess` for the Execution role.

Using CDK Deploy (eg. Target Account: '111111111111', Tools Account: '444444444444'):
- CLI credentials will be required for each account, and you will need to update them or use the `--profile` switch to specify credentials when bootstrapping each account
- Tools Account: `cdk bootstrap 444444444444/ap-southeast-1 --no-bootstrap-customer-key --cloudformation-execution-policies 'arn:aws:iam::aws:policy/AdministratorAccess'`.
- Other Accounts: `cdk bootstrap 111111111111/ap-southeast-1 --no-bootstrap-customer-key --cloudformation-execution-policies 'arn:aws:iam::aws:policy/AdministratorAccess' --trust 444444444444 --trust-for-lookup 444444444444`.
- Repeat for all Accounts and all Regions you will deploy to

Deploy the CodeCommit and Pipeline Preparation stacks:
- `cdk deploy --all -a "npx ts-node bin/pipeline-setup.ts"` (creates a CodeCommit repo in your Dev account and the Pipeline role in the Tools Account)

Push the code into `dev, uat and main` branches in CodeCommit (or whatever branches you configured in the `options` file).

&nbsp;

## Pipeline Deployment

The Pipeline stacks need to be deployed once manually using CloudFormation or CDK Deploy. Sync the code into your CodeCommit repo before proceeding.

Deployment to all accounts and regions:
- CLI credentials for the Tools Account are required
- Run `cdk deploy --all`

The pipelines will run on deployment, and may fail:
- If you have not pushed the code into CodeCommit before deploying the pipelines then they will run and fail at the Source step. Push the code to trigger again.
- Sometimes the pipeline will start running before the CloudFormation deployment has actually completed. In this case it will fail in the Build step. Use the Release Change option to run again after the deployment is complete.

## Pipelines and Stacks

After deployment you will see the following CloudFormation stacks:
- Tools Account: A Pipeline stack for each environment (account/region)
- Tools Account: A helper stack for each region you are using outside the default
- CodeCommit Account: A shared helper stack for the Pipelines
- App Accounts: An application stack in each region you have deployed to

If you want to check what stacks will be created before deploying use:
- `cdk list` or
- `cdk diff`

&nbsp;

## The Application

The pipeline will deploy a simple application stack including a Lambda backed API. You can test the deployment and updates by accessing the API.

You will need to get the API URL from the outputs of the CloudFormation stack in each account. Open in a browser and it will return the current time, application version and the API request Id.

The application stack can be deployed manually on its own using CDK deploy:
- Run `cdk deploy --all -a "npx ts-node bin/app-deploy.ts"`
- Note this will deploy using the current default CLI credentials

&nbsp;

## Testing and Updating

The Pipelines will run any time code is pushed to the relevant branch.

A simple way to update is to increment `version` in `config/index.ts`. This will update the Lambda function, which will return the new version number in the API response.

&nbsp;

## Costs and Cleanup

A KMS key will be created in the Tools account for use in cross-account bucket encryption. Cost is approx. $1/month per pipeline.

Everything else is pay per use and will be well inside the free-use tiers.

Delete everything:
- **Pipelines:** `cdk destroy --all` (this will delete the KMS keys which are the only real cost)
- **Preparation stacks:** `cdk destroy --all -a "npx ts-node bin/pipeline-setup.ts"`
- **App Accounts (and each region)** - Delete the CloudFormation stacks manually, they are not deleted by the pipelines or destroing the pipeline stacks.
- There will also be **pipeline artifact buckets** in the Tools account that must be manually deleted.
- If you are deleting the CDK Bootstrap stacks you may also need to manually delete the S3 staging buckets in each account.
