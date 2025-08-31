#!/bin/bash

# Build script for Authentication Infrastructure CDK
set -e

echo "🔨 Building Authentication CDK Infrastructure..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the CDK directory."
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
    echo "1. Run './deploy.sh' to deploy the infrastructure"
    echo "2. Or run 'npx cdk synth' to see the generated CloudFormation"
    echo "3. Or run 'npx cdk diff' to see changes before deployment"
else
    echo "❌ Build failed. Please fix TypeScript errors and try again."
    exit 1
fi