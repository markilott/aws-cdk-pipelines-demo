export type Options = {
    repoName: string,
    createRepo?: boolean,
    version: string,
    defaultRegion: string,
    pipelineName: string,
    stackNamePrefix: string,
    codeCommitAccount: string,
    toolsAccount: string,
    appPipelines: {
        name: string,
        account: string,
        region?: string, // Use the default region if not specified
        branch: string,
        preApproval?: boolean,
    }[],
    codeCommitAccessRoleName: string,
    cdkBootstrapQualifier: string,
    pipelineBaseResourceName: string,
    pipelineResourceName: string,
    deployStageResourceName: string,
};
