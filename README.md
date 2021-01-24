# AWS CDK Cross-Account Pipeline Demo

This Javascript CDK project creates a Pipeline in a Tools Account, to deploy an application from code in CodeCommit in a Dev account,
into Dev, Pre-Prod and Prod environments in their own accounts.

Specifically, we have:
- A Dev account, where the code resides in CodeCommit repositories, and where development code is deployed.
Developers have (almost) full access to the account and can manage code and deploy apps.
- A UAT (Pre-Prod/Staging) account - a production like environment used for business acceptance testing.
Infra team manage the environment, developers have limited access for troubleshooting and testing.
- A Prod account, for production deployment, obviously. Developers can view logs, and not much else.
- A Tools (Shared Services) account, where CodePipeline will be used to build and deploy into Dev, UAT and Prod.
Developers have limited access for troubleshooting and testing, and can view but not manage pipelines.

You can read about the concepts behind it and more detailed instructions [in this Medium article](https://markilott.medium.com/cdk-cross-account-pipelines-3126e0434b0c).

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
- Run `npm install`
- Run `npm build`
- Update the `bin/options.json` file with your own environment details and preferences
- Create a CodeCommit reposistory in your Dev Account, and sync the code into `dev, uat and main` branches.

&nbsp;

## Account Preparation

The Tools and Dev accounts need to be prepared for the cross-account Pipeline.

Using CloudFormation:
- Deploy CDK Bootstrap into all accounts using the [AWS template here](https://github.com/aws/aws-cdk/blob/master/packages/aws-cdk/lib/api/bootstrap/bootstrap-template.yaml).
Your Tools account number needs to be included in the Trusted Accounts parameter. Use `arn:aws:iam::aws:policy/AdministratorAccess` for the Execution role.
- Deploy `lib/cfn-templates/pipeline-account-prep.yaml` into the Tools account
- Deploy `lib/cfn-templates/source-account-prep.yaml` into the Dev account, leaving the pipeline bucket and key parameters blank. This will need to be updated after the Pipelines are deployed below.

Using CDK Deploy:
- All accounts require the CDK Bootstrap stack with the [new DefaultStackSynthesizer](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html).
Update cdk.json using instructions in the linked article, then proceed.
- Run `cdk bootstrap --bootstrap-customer-key --cloudformation-execution-policies 'arn:aws:iam::aws:policy/AdministratorAccess' aws://111111111111/ap-southeast-1` (substituting your own Account and Region).
- Make sure you have updated `bin/options.json` with your account details
- Run `cdk deploy Pipeline-Account-Prep -a "node bin/pipeline-setup.js"` against the Tools account
- Run `cdk deploy Source-Account-Prep -a "node bin/pipeline-setup.js"` against the Dev account. This will need to be updated after the Pipelines are deployed below.

&nbsp;

## Pipeline Deployment

The Pipeline stacks need to be deployed once manually using CloudFormation or CDK Deploy. Sync the code into your CodeCommit repo before proceeding.

In either case the Pipelines will run immediately on creation and fail at the Source stage. This is expected, as the source role does not have access to the newly created bucket and key.

After you have completed all the steps below they should complete and deploy the application stack into each environment.

Using CloudFormation:
- You can create CloudFormation templates using CDK synth, then deploy directly using CloudFormation CLI or Console
- Run `cdk synth Pipeline-DEV > dev-pipeline.yaml` to create the Dev pipeline template
- Run `cdk synth Pipeline-UAT > uat-pipeline.yaml` to create the UAT pipeline template
- Run `cdk synth Pipeline-PROD > prod-pipeline.yaml` to create the Prod pipeline template
- Deploy using CloudFormation in the Tools account
- Get the Bucket and Key ARN outputs from each stack
- Update the parameters in the Source-Account-Prep stack deployed above
- Open the Pipelines in the Console and use the Release Change option to restart

Using CDK Deploy against the Tools account:
- Run `cdk deploy Pipeline-DEV --outputs-file dev-pipeline-outputs.json`
- Run `cdk deploy Pipeline-UAT --outputs-file uat-pipeline-outputs.json`
- Run `cdk deploy Pipeline-PROD --outputs-file prod-pipeline-outputs.json`
- Get the Bucket and Key ARN outputs from each stack (in the outputs.json files or the console)
- Update `bin/options.json` with the Bucket and Key params
- Run `cdk deploy --Source-Account-Prep -a "node bin/pipeline-setup.js"` against the Dev account.
- Open the Pipelines in the Console and use the Release Change option to restart

Note that by default the Pipelines include the following approval steps:
- Dev: no approval, application stack will deploy immediately
- UAT: approval required before proceeding to deployment. You will need to manually approve before proceeding to the Deploy stage.
- Prod: approval required before proceeding to deployment, and after CloudFormation Change Set create. You will need to manually approve before proceeding to the Deploy stage.
You will then need to approve again after Change Sets have been created in the target account.
- These options can be modified in `bin/pipeline-deploy.js` if you want to try out different combinations.

&nbsp;

## The Application

The pipeline will deploy a simple application stack including a Lambda backed API. You can test the deployment and updates by accessing the API.

You will need to get the API URL from the outputs of the CloudFormation stack in each account. Open in a browser and it will return the current time, application version and the API request Id.

The application stack can be deployed manually on it's own using CDK deploy:
- Run `cdk deploy --all -a "node bin/app-deploy.js"`
- Note this will deploy using the current default CLI credentials

&nbsp;

## Testing and Updating

The Pipelines will run any time code is pushed to the relevant branch.

A simple way to update is to increment `version` in `bin/options.json`. This will update the Lambda function, which will return the new version number in the API response.

&nbsp;

## Costs and Cleanup

A KMS key will be created in the Tools account for use in cross-account bucket encryption. Cost is approx. $1/month.

Everything else is pay per use and will be well inside the free-use tiers.

Delete all the CloudFormation stacks in each account to clean up everything except the S3 buckets. There will be artifact buckets in the Tools account that must be manually deleted.

If you are deleting the CDK Bootstrap stacks you may also need to manually delete the S3 staging buckets in each account.
