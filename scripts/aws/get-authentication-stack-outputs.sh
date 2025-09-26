#!/bin/bash

# Script to get Authentication CDK stack outputs for easy environment variable setup
# Usage: ./get-authentication-outputs.sh [environment] [region]
# Examples:
#   ./get-authentication-outputs.sh                    # Uses test environment, eu-west-2 region
#   ./get-authentication-outputs.sh prod               # Uses prod environment, eu-west-2 region  
#   ./get-authentication-outputs.sh test us-east-1     # Uses test environment, us-east-1 region

set -e

ENVIRONMENT=${1:-test}
REGION=${2:-eu-west-2}

echo "🔍 Getting Authentication CDK outputs for environment: $ENVIRONMENT in region: $REGION"

# Navigate to authentication CDK directory
cd "$(dirname "$0")/../../authentication/cdk"

# Get stack outputs
export AWS_DEFAULT_REGION=$REGION
STACK_NAME="${APP_NAME:-appre}-$ENVIRONMENT-authentication"

echo "📋 Stack outputs for $STACK_NAME:"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    pnpm install
fi

# Build if needed
echo "🔨 Building CDK code..."
pnpm run build

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
    
    console.log('# Authentication CDK Outputs - copy these to your webapp/.env.development');
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
    console.log('AWS_REGION=' + '$REGION');
    "
    
    rm -f outputs.json
else
    echo "⚠️  Could not retrieve outputs. Make sure the stack is deployed."
    echo "   Run: cd ../../authentication/cdk && ./deploy.sh $ENVIRONMENT $REGION"
fi

echo ""
echo "🔧 Manual verification commands:"
echo "aws dynamodb describe-table --table-name appre-users-$ENVIRONMENT --region $REGION"
echo "aws cognito-idp list-user-pools --max-items 10 --region $REGION"