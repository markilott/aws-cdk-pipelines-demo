#!/bin/bash
# Used in CodeBuild pipeline to install Npm modules.
# Can also be used locally to prepare for cdk deploy.
# Does not update npm modules to new versions.
echo Installing npm modules...

(cd lib/application/lambda-src && npm ci --production)