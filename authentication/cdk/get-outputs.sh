#!/bin/bash

# Script to get CDK stack outputs for easy environment variable setup
set -e

ENVIRONMENT=${1:-dev}
REGION=${2:-eu-west-2}

echo "🔍 Getting CDK outputs for environment: $ENVIRONMENT in region: $REGION"

# Get stack outputs
export AWS_DEFAULT_REGION=$REGION
OUTPUTS=$(npx cdk list --context environment=$ENVIRONMENT --context region=$REGION 2>/dev/null | head -1)
STACK_NAME="ApreciataAuth-$ENVIRONMENT"

echo "📋 Stack outputs for $STACK_NAME:"
echo ""

# Get the outputs in a more readable format
npx cdk deploy $STACK_NAME \
    --context environment=$ENVIRONMENT \
    --context region=$REGION \
    --outputs-file outputs.json \
    --require-approval never \
    --no-execute 2>/dev/null || true

if [ -f "outputs.json" ]; then
    echo "🎯 Environment variables for your webapp/.env.development:"
    echo ""
    
    # Parse outputs and format for .env file
    node -e "
    const outputs = require('./outputs.json');
    const stackOutputs = outputs['$STACK_NAME'] || {};
    
    console.log('# CDK Outputs - copy these to your webapp/.env.development');
    console.log('');
    
    if (stackOutputs.UserPoolId) {
        console.log('COGNITO_USER_POOL_ID=' + stackOutputs.UserPoolId);
    }
    if (stackOutputs.UserPoolClientId) {
        console.log('COGNITO_CLIENT_ID=' + stackOutputs.UserPoolClientId);
    }
    if (stackOutputs.SessionTableName) {
        console.log('SESSION_TABLE_NAME=' + stackOutputs.SessionTableName);
    }
    if (stackOutputs.UsersTableName) {
        console.log('USERS_TABLE_NAME=' + stackOutputs.UsersTableName);
    }
    console.log('AWS_REGION=$REGION');
    "
    
    rm -f outputs.json
else
    echo "⚠️  Could not retrieve outputs. Make sure the stack is deployed."
    echo "   Run: ./deploy.sh $ENVIRONMENT $REGION"
fi

echo ""
echo "🔧 Manual verification commands:"
echo "aws dynamodb describe-table --table-name user-sessions-$ENVIRONMENT --region $REGION"
echo "aws cognito-idp describe-user-pool --user-pool-id <pool-id> --region $REGION"