/* eslint-disable max-classes-per-file */
/* eslint-disable no-new */

const { Stage, Stack, CfnOutput } = require('@aws-cdk/core');
const apigw = require('@aws-cdk/aws-apigateway');
const lambda = require('@aws-cdk/aws-lambda');

class ApplicationStack extends Stack {
    /**
     * Deploys a simple API with Lambda function and GET method.
     * API Url is output for use in testing.
     *
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        // Lambda function
        const lambdaFnc = new lambda.Function(this, 'lambdaFnc', {
            functionName: 'pipelineTestFnc',
            code: lambda.Code.fromAsset(`${__dirname}/lambda-src`),
            runtime: lambda.Runtime.NODEJS_12_X,
            handler: 'index.handler',
            environment: {
                VERSION: (props.version) || 'Unknown',
                ACCOUNT: this.account,
            },
        });

        // API base
        const api = new apigw.RestApi(this, 'pipelineTestApi', {
            restApiName: 'pipelineTestApi',
            description: 'The pipelineTestApi',
            deployOptions: {
                stageName: 'v1',
                description: 'V1 Deployment',
            },
            endpointTypes: [apigw.EndpointType.REGIONAL],
        });
        new CfnOutput(this, 'apiUrl', {
            description: 'API URL',
            value: api.url,
        });

        // Lambda integration for API method
        const lambdaInteg = new apigw.LambdaIntegration(lambdaFnc, {
            proxy: false,
            requestTemplates: {
                'application/json': `{
                    "context": {
                        "requestId" : "$context.requestId"
                    }
                }`,
            },
            integrationResponses: [{
                statusCode: '200',
                responseTemplates: {
                    'application/json': '$input.body',
                },
            }],
        });

        // API method at root
        api.root.addMethod('GET', lambdaInteg, {
            methodResponses: [{
                statusCode: '200',
                responseModels: {
                    'application/json': '$input.body',
                },
            }],
        });
    }
}

class ApplicationStage extends Stage {
    /**
     * Deploys the API stack via CodePipeline.
     * Stages can deploy many stacks, but keeping it simple here with one.
     *
     * @param {cdk.Construct} scope
     * @param {string} id
     * @param {cdk.StageProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const { env, version } = props;

        new ApplicationStack(this, 'LambdaApi', {
            stackName: 'TestApiStack',
            description: 'Lambda API Test Stack',
            env,
            version,
        });
    }
}

module.exports = { ApplicationStack, ApplicationStage };
