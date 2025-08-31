#!/bin/bash

# Script to sync configuration from services to webapp
set -e

echo "🔄 Syncing configuration from services to webapp..."

# Load services environment
if [ ! -f ".env" ]; then
    echo "❌ No .env file found in services directory"
    exit 1
fi

source .env

# Update webapp .env file
WEBAPP_ENV="../appreciata-webapp/app/.env"

if [ ! -f "$WEBAPP_ENV" ]; then
    echo "❌ Webapp .env file not found at $WEBAPP_ENV"
    exit 1
fi

echo "📝 Updating webapp configuration..."

# Use sed to update specific values in webapp .env
sed -i.bak "s/AWS_REGION=.*/AWS_REGION=$AWS_REGION/" "$WEBAPP_ENV"
sed -i.bak "s/COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID/" "$WEBAPP_ENV"
sed -i.bak "s/COGNITO_CLIENT_ID=.*/COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID/" "$WEBAPP_ENV"

# Remove backup file
rm "$WEBAPP_ENV.bak"

echo "✅ Configuration synced successfully!"
echo ""
echo "📋 Updated values:"
echo "  AWS_REGION: $AWS_REGION"
echo "  COGNITO_USER_POOL_ID: $COGNITO_USER_POOL_ID"
echo "  COGNITO_CLIENT_ID: $COGNITO_CLIENT_ID"