import { Options } from '../types';

export const options: Options = {
    repoName: 'pipeline-demo', // CodeCommit repository name - in the same region as the pipelines
    createRepo: true, // Create the repo, or use existing
    version: '2', // Increment to trigger a pipeline deployment
    defaultRegion: 'ap-southeast-1',
    pipelineName: 'CodeCommitPipelineDemo',
    stackNamePrefix: 'Pipeline', // Prefix for the Pipeline stack names - specified so we have a predictable role name
    codeCommitAccount: '111111111111', // Account with CodeCommit repo
    toolsAccount: '444444444444', // Account where Pipelines are deployed
    appPipelines: [
        {
            name: 'dev', // Dev environment
            account: '111111111111',
            branch: 'dev',
            preApproval: false, // Require approval before Create Change Set
        },
        {
            name: 'uat', // UAT/QA environment
            account: '222222222222',
            branch: 'uat',
            preApproval: false,
        },
        {
            name: 'prod', // Production environment
            account: '333333333333',
            branch: 'main',
            preApproval: true,
        },
        {
            name: 'prod', // Production environment
            account: '333333333333',
            region: 'ap-southeast-2',
            branch: 'main',
            preApproval: true,
        },
    ],
    // You should not need to update below here =============================================
    codeCommitAccessRoleName: 'DemoPipelineCodeCommitAccessRole', // Specified so we can share across stacks, probably no need to change the default here
    cdkBootstrapQualifier: 'hnb659fds', // Do not change this unless you have bootstrapped your Accounts with a custom qualifier
    // CDK resource names specified so we have predictable role structure
    pipelineBaseResourceName: 'PipelineBase',
    pipelineResourceName: 'Pipeline',
    deployStageResourceName: 'DeployStage',
};
