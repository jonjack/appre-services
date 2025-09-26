#!/bin/bash

# Deployment script for Authentication Infrastructure
set -e

# Get the script directory and navigate to CDK directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$SCRIPT_DIR/../../authentication/cdk"

echo "🚀 Deploying Authentication Infrastructure from $CDK_DIR"

# Change to CDK directory
cd "$CDK_DIR"

# Load environment variables from services .env file
if [ -f "../../.env" ]; then
    echo "📄 Loading environment variables from services/.env"
    set -a  # automatically export all variables
    source ../../.env
    set +a  # stop automatically exporting
    echo "✅ Loaded environment variables: AWS_REGION=$AWS_REGION, ENVIRONMENT=$ENVIRONMENT"
else
    echo "⚠️  No .env file found in services directory"
fi

ENVIRONMENT=${1:-${ENVIRONMENT}}
REGION=${2:-${AWS_REGION}}

# Validate required environment variables
if [ -z "$ENVIRONMENT" ]; then
    echo "❌ Error: ENVIRONMENT not set. Please set it in .env file or pass as argument."
    exit 1
fi

if [ -z "$REGION" ]; then
    echo "❌ Error: AWS_REGION not set. Please set it in .env file or pass as argument."
    exit 1
fi

echo "🌍 Using region: $REGION"
echo "🏷️  Using environment: $ENVIRONMENT"

echo "🚀 Deploying Authentication Infrastructure for environment: $ENVIRONMENT in region: $REGION"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    pnpm install
fi

# Build TypeScript
echo "🔨 Building CDK code..."
pnpm run build

# Bootstrap CDK if needed (only run once per account/region)
echo "🏗️  Bootstrapping CDK (if needed)..."
export AWS_DEFAULT_REGION=$REGION
npx cdk bootstrap --context environment=$ENVIRONMENT --context region=$REGION

# Deploy the stack
STACK_NAME="${APP_NAME:-appre}-${ENVIRONMENT}-authentication"
echo "🚀 Deploying stack: $STACK_NAME"
export AWS_DEFAULT_REGION=$REGION
npx cdk deploy $STACK_NAME \
    --context environment=$ENVIRONMENT \
    --context region=$REGION \
    --require-approval never

echo "✅ Authentication infrastructure deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update webapp/.env with new Cognito configuration"
echo "2. Verify SES domain for email sending"
echo "3. Test the authentication flow"