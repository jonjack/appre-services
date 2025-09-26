#!/bin/bash

# CDK Operations Script for Authentication Infrastructure
set -e

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

OPERATION=${1:-help}

# Validate required environment variables (only if not help)
if [ "$OPERATION" != "help" ]; then
    if [ -z "$ENVIRONMENT" ]; then
        echo "❌ Error: ENVIRONMENT not set. Please set it in .env file."
        exit 1
    fi

    if [ -z "$AWS_REGION" ]; then
        echo "❌ Error: AWS_REGION not set. Please set it in .env file."
        exit 1
    fi
    
    echo "🌍 Using region: $AWS_REGION"
    echo "🏷️  Using environment: $ENVIRONMENT"
fi

REGION=$AWS_REGION

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    pnpm install
fi

# Build TypeScript
echo "🔨 Building CDK code..."
pnpm run build

# Set AWS region for CDK operations
export AWS_DEFAULT_REGION=$REGION

case $OPERATION in
    "build")
        echo "✅ Build completed successfully!"
        ;;
    "synth")
        echo "🔍 Synthesizing CloudFormation template..."
        STACK_NAME="${APP_NAME:-appre}-$ENVIRONMENT-authentication"
        npx cdk synth $STACK_NAME \
            --context environment=$ENVIRONMENT \
            --context region=$REGION
        ;;
    "diff")
        echo "📊 Showing differences..."
        STACK_NAME="${APP_NAME:-appre}-$ENVIRONMENT-authentication"
        npx cdk diff $STACK_NAME \
            --context environment=$ENVIRONMENT \
            --context region=$REGION
        ;;
    "deploy")
        echo "🚀 Deploying stack..."
        STACK_NAME="${APP_NAME:-appre}-$ENVIRONMENT-authentication"
        npx cdk deploy $STACK_NAME \
            --context environment=$ENVIRONMENT \
            --context region=$REGION \
            --require-approval never
        ;;
    "destroy")
        echo "💥 Destroying stack..."
        STACK_NAME="${APP_NAME:-appre}-$ENVIRONMENT-authentication"
        npx cdk destroy $STACK_NAME \
            --context environment=$ENVIRONMENT \
            --context region=$REGION \
            --force
        ;;
    "bootstrap")
        echo "🏗️  Bootstrapping CDK..."
        npx cdk bootstrap \
            --context environment=$ENVIRONMENT \
            --context region=$REGION
        ;;
    "list")
        echo "📋 Listing stacks..."
        npx cdk list \
            --context environment=$ENVIRONMENT \
            --context region=$REGION
        ;;
    "help"|*)
        echo "🔧 CDK Operations for Authentication Infrastructure"
        echo ""
        echo "Usage: ./cdk.sh <operation>"
        echo ""
        echo "Available operations:"
        echo "  build      - Build TypeScript code only"
        echo "  synth      - Synthesize CloudFormation template"
        echo "  diff       - Show differences between deployed and local"
        echo "  deploy     - Deploy the stack"
        echo "  destroy    - Destroy the stack"
        echo "  bootstrap  - Bootstrap CDK in the account/region"
        echo "  list       - List all stacks"
        echo "  help       - Show this help message"
        echo ""
        echo "Environment variables (from ../../.env):"
        echo "  ENVIRONMENT: $ENVIRONMENT"
        echo "  AWS_REGION: $REGION"
        ;;
esac