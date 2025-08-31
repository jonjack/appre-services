#!/bin/bash

# Build script for Rust Lambda functions
set -e

echo "🦀 Building Rust Lambda functions for authentication..."

# Check if cargo-lambda is installed
if ! command -v cargo-lambda &> /dev/null; then
    echo "❌ cargo-lambda is not installed. Installing..."
    cargo install cargo-lambda
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cargo clean

# Build all Lambda functions for AWS Lambda (x86_64-unknown-linux-gnu)
echo "🔨 Building Lambda functions..."

# Build each function for AWS Lambda AL2023 runtime
functions=("create-auth-challenge" "verify-auth-challenge" "define-auth-challenge")

for func in "${functions[@]}"; do
    echo "Building $func for AWS Lambda AL2023..."
    cargo lambda build --release --bin $func
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo "✅ $func built successfully"
    else
        echo "❌ Failed to build $func"
        exit 1
    fi
done

echo ""
echo "🎉 All Lambda functions built successfully!"
echo ""
echo "📁 Built artifacts are located in:"
echo "   target/lambda/create-auth-challenge/"
echo "   target/lambda/verify-auth-challenge/"
echo "   target/lambda/define-auth-challenge/"
echo ""
echo "📋 Next steps:"
echo "1. Deploy the CDK infrastructure: cd ../cdk && ./deploy.sh"
echo "2. Test the authentication flow"