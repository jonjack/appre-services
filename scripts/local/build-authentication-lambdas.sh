#!/bin/bash

# Build script for Rust Lambda functions
set -e

echo "🦀 Building Rust Lambda functions for authentication..."

# Get the script directory and navigate to authentication workspace
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTH_DIR="$SCRIPT_DIR/../../authentication"

echo "📁 Building from authentication workspace: $AUTH_DIR"

# Change to the main workspace directory
cd "$AUTH_DIR"

# Load environment variables from .env file
if [ -f "../.env" ]; then
    echo "📄 Loading environment variables from ../.env"
    export $(grep -v '^#' ../.env | xargs)
else
    echo "⚠️  Warning: ../.env file not found, using default values"
    export APP_NAME=${APP_NAME:-appre}
fi

echo "🏷️  Building with APP_NAME: $APP_NAME"

# Check if cargo-lambda is installed
if ! command -v cargo-lambda &> /dev/null; then
    echo "❌ cargo-lambda is not installed. Installing..."
    cargo install cargo-lambda
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cargo clean

# Also explicitly clean Lambda build artifacts
echo "🧹 Cleaning Lambda build artifacts..."
rm -rf target/lambda/
rm -rf target/x86_64-unknown-linux-gnu/

# Build all Lambda functions for AWS Lambda (x86_64-unknown-linux-gnu)
echo "🔨 Building Lambda functions..."

# Build each function for AWS Lambda AL2023 runtime
functions=("create-auth-challenge" "verify-auth-challenge" "define-auth-challenge" "pre-signup")

for func in "${functions[@]}"; do
    echo "Building $func for AWS Lambda AL2023..."
    # Pass APP_NAME as environment variable during build
    # Build from the lambda subdirectory but put target in parent directory
    cd lambda
    APP_NAME="$APP_NAME" cargo lambda build --release --bin $func --target-dir ../target
    cd ..
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo "✅ $func built successfully"
        
        # Create the lambda directory structure that CDK expects
        mkdir -p "target/lambda/$func"
        
        # Copy the binary to the expected location and rename to bootstrap
        if [ -f "target/x86_64-unknown-linux-gnu/release/$func" ]; then
            cp "target/x86_64-unknown-linux-gnu/release/$func" "target/lambda/$func/bootstrap"
            echo "📦 Packaged $func to target/lambda/$func/bootstrap"
        else
            echo "❌ Binary not found at target/x86_64-unknown-linux-gnu/release/$func"
            exit 1
        fi
    else
        echo "❌ Failed to build $func"
        exit 1
    fi
done

echo ""
echo "🎉 All Lambda functions built successfully!"
echo ""
echo "📁 Built artifacts are located in:"
echo "   $AUTH_DIR/target/lambda/create-auth-challenge/"
echo "   $AUTH_DIR/target/lambda/verify-auth-challenge/"
echo "   $AUTH_DIR/target/lambda/define-auth-challenge/"
echo "   $AUTH_DIR/target/lambda/pre-signup/"
echo ""
echo "📋 Next steps:"
echo "1. Deploy the CDK infrastructure: $SCRIPT_DIR/../aws/deploy-authentication-stack.sh"
echo "2. Test the authentication flow"