#!/bin/bash

# Master build script for all appre-services
set -e

echo "🚀 Building all appre-services components..."

# Load environment variables
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env"
    set -a
    source .env
    set +a
    echo "✅ Environment: $ENVIRONMENT, Region: $AWS_REGION"
else
    echo "⚠️  No .env file found. Using defaults."
    export ENVIRONMENT=${ENVIRONMENT:-dev}
    export AWS_REGION=${AWS_REGION:-eu-west-2}
fi

echo ""
echo "🦀 Step 1: Building Authentication Lambda functions..."
cd authentication/lambda
./build.sh
cd ../..

echo ""
echo "🦀 Step 2: Building Notifications Lambda functions..."
cd notifications/lambda
./build.sh
cd ../..

echo ""
echo "🏗️  Step 3: Deploying Authentication Infrastructure..."
cd authentication/cdk
./deploy.sh
cd ../..

echo ""
echo "🏗️  Step 4: Deploying Notifications Infrastructure..."
cd notifications/cdk
./deploy.sh
cd ../..

echo ""
echo "🎉 All services built and deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update webapp/.env with new Cognito configuration"
echo "2. Verify SES domain for email sending"
echo "3. Test the authentication and notification flows"