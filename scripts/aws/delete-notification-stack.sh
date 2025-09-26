#!/bin/bash

# Delete Notification Stack for Test Environment
# This script safely deletes the notification CloudFormation stack

set -e

# Configuration
ENVIRONMENT="test"
REGION="eu-west-2"
APP_NAME="appre"
STACK_NAME="${APP_NAME}-${ENVIRONMENT}-notifications"

echo "🗑️  Notification Stack Deletion Script"
echo "======================================"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Confirmation prompt
read -p "⚠️  Are you sure you want to delete the notification stack? This will remove all email templates and queues. Type 'DELETE' to confirm: " confirmation

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

# Navigate to notifications CDK directory
cd "$(dirname "$0")/../../notifications/cdk"

echo "📦 Installing CDK dependencies..."
if [ ! -d "node_modules" ]; then
    pnpm install
fi

echo "🔨 Building CDK code..."
pnpm run build

echo ""
echo "🗑️  Deleting notification stack..."
echo "This may take several minutes..."

# Delete the stack using CDK
npx cdk destroy "$STACK_NAME" \
    --context environment="$ENVIRONMENT" \
    --context region="$REGION" \
    --force

echo ""
echo "✅ Notification stack deletion completed!"
echo ""
echo "📋 What was deleted:"
echo "   - SES email templates (5): OTP, Welcome, Registration reminders, Newsletter"
echo "   - SQS queues (2): email-queue, email-dlq"
echo "   - Lambda function (1): email-processor"
echo "   - IAM roles and policies"
echo ""
echo "⚠️  Note: Some resources may have been retained based on deletion policies."
echo "   Check the AWS Console to verify complete deletion if needed."