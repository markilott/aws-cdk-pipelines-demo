/* eslint-disable max-classes-per-file */
/* eslint-disable no-new */
import {
    CfnOutput, Stack, StackProps,
    Stage, StageProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
    RestApi, EndpointType, LambdaIntegration,
    JsonSchemaType, JsonSchemaVersion,
} from 'aws-cdk-lib/aws-apigateway';
import { Function, Code, Runtime } from 'aws-cdk-lib/aws-lambda';

interface ApplicationStackProps extends StackProps {
    version: string,
}

export class ApplicationStack extends Stack {
    /**
     * Deploys a simple API with Lambda function and GET method.
     * API Url is output for use in testing.
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope: Construct, id: string, props: ApplicationStackProps) {
        super(scope, id, props);

        // Lambda function
        const lambdaFnc = new Function(this, 'lambdaFnc', {
            functionName: 'pipelineTestFnc',
            code: Code.fromAsset(`${__dirname}/lambda-src`),
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            environment: {
                VERSION: (props.version) || 'Unknown',
                ACCOUNT: this.account,
            },
        });

        // API base
        const api = new RestApi(this, 'pipelineTestApi', {
            restApiName: 'pipelineTestApi',
            description: 'The pipelineTestApi',
            deployOptions: {
                stageName: 'v1',
                description: 'V1 Deployment',
            },
            endpointTypes: [EndpointType.REGIONAL],
        });
        new CfnOutput(this, 'apiUrl', {
            description: 'API URL',
            value: api.url,
        });

        // Lambda integration for API method
        const lambdaInteg = new LambdaIntegration(lambdaFnc, {
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

        // Response model for Method Responses
        const jsonResponseModel = api.addModel('JsonResponse', {
            contentType: 'application/json',
            schema: {
                schema: JsonSchemaVersion.DRAFT7,
                title: 'JsonResponse',
                type: JsonSchemaType.OBJECT,
                properties: {
                    state: { type: JsonSchemaType.STRING },
                    greeting: { type: JsonSchemaType.STRING },
                },
            },
        });

        // API method at root
        api.root.addMethod('GET', lambdaInteg, {
            methodResponses: [{
                statusCode: '200',
                responseModels: {
                    'application/json': jsonResponseModel,
                },
            }],
        });
    }
}

interface ApplicationStageProps extends StageProps {
    version: string,
}

export class ApplicationStage extends Stage {
    /**
     * Deploys the API stack via CodePipeline.
     * Stages can deploy many stacks, but keeping it simple here with one.
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StageProps=} props
     */
    constructor(scope: Construct, id: string, props: ApplicationStageProps) {
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
