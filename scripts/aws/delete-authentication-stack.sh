#!/bin/bash

# Delete Authentication Stack for Test Environment
# This script safely deletes the authentication CloudFormation stack

set -e

# Configuration
ENVIRONMENT="test"
REGION="eu-west-2"
APP_NAME="appre"
STACK_NAME="${APP_NAME}-${ENVIRONMENT}-authentication"

echo "🗑️  Authentication Stack Deletion Script"
echo "========================================"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Confirmation prompt
read -p "⚠️  Are you sure you want to delete the authentication stack? This will remove all authentication resources including user data. Type 'DELETE' to confirm: " confirmation

if [ "$confirmation" != "DELETE" ]; then
    echo "❌ Deletion cancelled. Stack not deleted."
    exit 0
fi

echo ""
echo "🔍 Checking if stack exists..."

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "ℹ️  Stack '$STACK_NAME' does not exist or is already deleted."
    exit 0
fi

echo "✅ Stack found. Proceeding with deletion..."
echo ""

# Set AWS region
export AWS_DEFAULT_REGION=$REGION

# Navigate to authentication CDK directory
cd "$(dirname "$0")/../../authentication/cdk"

echo "📦 Installing CDK dependencies..."
if [ ! -d "node_modules" ]; then
    pnpm install
fi

echo "🔨 Building CDK code..."
pnpm run build

echo ""
echo "🗑️  Deleting authentication stack..."
echo "This may take several minutes..."

# Delete the stack using CDK
npx cdk destroy "$STACK_NAME" \
    --context environment="$ENVIRONMENT" \
    --context region="$REGION" \
    --force

echo ""
echo "✅ Authentication stack deletion completed!"
echo ""
echo "📋 What was deleted:"
echo "   - Cognito User Pool and Client"
echo "   - Lambda functions (3): create-challenge, verify-challenge, define-challenge"
echo "   - DynamoDB tables (4): users, auth-otps, rate-limits, user-sessions"
echo "   - IAM roles and policies"
echo ""
echo "⚠️  Note: Some resources may have been retained based on deletion policies."
echo "   Check the AWS Console to verify complete deletion if needed."