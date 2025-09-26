#!/bin/bash

# Build script for notifications Lambda functions
set -e

echo "📧 Building notifications Lambda functions..."

# Get the script directory and navigate to notifications workspace
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFICATIONS_DIR="$SCRIPT_DIR/../../notifications"

echo "📁 Building from notifications workspace: $NOTIFICATIONS_DIR"

# Change to the notifications workspace directory
cd "$NOTIFICATIONS_DIR"

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

# Build email processor Lambda
echo "🔨 Building email-processor Lambda..."
APP_NAME="$APP_NAME" cargo lambda build --release --package email-processor

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ email-processor built successfully"
else
    echo "❌ Failed to build email-processor"
    exit 1
fi

echo ""
echo "🎉 Notifications Lambda functions built successfully!"
echo ""
echo "📁 Built artifacts are located in:"
echo "   $NOTIFICATIONS_DIR/target/lambda/email-processor/"
echo ""
echo "📋 Next steps:"
echo "1. Deploy the CDK infrastructure for notifications"
echo "2. Test the email processing flow"