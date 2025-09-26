#!/bin/bash

# Build script for Authentication Infrastructure CDK
set -e

echo "🔨 Building Authentication CDK Infrastructure..."

# Get the script directory and navigate to CDK directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$SCRIPT_DIR/../../authentication/cdk"

echo "📁 Building CDK from: $CDK_DIR"

# Change to CDK directory
cd "$CDK_DIR"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in $CDK_DIR"
    echo "Make sure the authentication CDK directory exists at the expected location."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    pnpm install
fi

# Build TypeScript
echo "🏗️  Compiling TypeScript..."
pnpm run build

# Check for TypeScript errors
if [ $? -eq 0 ]; then
    echo "✅ Authentication CDK built successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Run '$SCRIPT_DIR/deploy.sh' to deploy the infrastructure"
    echo "2. Or run 'npx cdk synth' from $CDK_DIR to see the generated CloudFormation"
    echo "3. Or run 'npx cdk diff' from $CDK_DIR to see changes before deployment"
else
    echo "❌ Build failed. Please fix TypeScript errors and try again."
    exit 1
fi