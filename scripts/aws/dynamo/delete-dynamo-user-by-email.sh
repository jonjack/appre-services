#!/bin/bash

# Delete User by Email Script
# This script removes all traces of a user from the authentication system
# Usage: ./delete-user-by-email.sh <email>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if email argument is provided
if [ $# -eq 0 ]; then
    print_error "Usage: $0 <email>"
    print_info "Example: $0 user@example.com"
    exit 1
fi

EMAIL="$1"

# Validate email format (basic check)
if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    print_error "Invalid email format: $EMAIL"
    exit 1
fi

print_info "Starting deletion process for user: $EMAIL"
echo

# Load environment variables from .env file if it exists
# Get the script directory to find the correct .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../../.env"

if [ -f "$ENV_FILE" ]; then
    print_info "Loading environment variables from $ENV_FILE..."
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    print_warning "No .env file found at $ENV_FILE. Make sure environment variables are set."
fi

# Check required environment variables
REQUIRED_VARS=("USERS_TABLE_NAME" "OTP_TABLE_NAME" "RATE_LIMIT_TABLE_NAME" "SESSION_TABLE_NAME" "COGNITO_USER_POOL_ID" "AWS_REGION")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Environment variable $var is not set"
        exit 1
    fi
done

print_info "Environment variables loaded:"
print_info "  - Users Table: $USERS_TABLE_NAME"
print_info "  - OTP Table: $OTP_TABLE_NAME"
print_info "  - Rate Limit Table: $RATE_LIMIT_TABLE_NAME"
print_info "  - Session Table: $SESSION_TABLE_NAME"
print_info "  - Cognito User Pool: $COGNITO_USER_POOL_ID"
print_info "  - AWS Region: $AWS_REGION"
echo

# Check if required tools are installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    print_info "Install guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it first."
    print_info "Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    exit 1
fi

# Check AWS credentials with detailed error reporting
print_info "Checking AWS credentials..."
aws_identity_output=$(aws sts get-caller-identity 2>&1)
aws_identity_exit_code=$?

if [ $aws_identity_exit_code -ne 0 ]; then
    print_error "AWS credentials not configured or invalid."
    print_error "AWS error details: $aws_identity_output"
    print_info "Please run 'aws configure' to set up your credentials."
    exit 1
fi

print_success "AWS CLI is configured and ready"
print_info "AWS Identity: $(echo "$aws_identity_output" | jq -r '.Arn' 2>/dev/null || echo "Could not parse identity")"
echo

# Confirmation prompt
print_warning "This will permanently delete all data for user: $EMAIL"
print_warning "This includes:"
print_warning "  - User profile from DynamoDB"
print_warning "  - OTP records from DynamoDB"
print_warning "  - Rate limit records from DynamoDB"
print_warning "  - Session records from DynamoDB"
print_warning "  - User account from Cognito"
echo
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Operation cancelled"
    exit 0
fi

echo
print_info "Starting deletion process..."
echo

# Function to delete DynamoDB item by email (for tables with email as partition key only)
delete_dynamodb_item() {
    local table_name=$1
    local email=$2
    local description=$3
    
    print_info "Deleting from $description ($table_name)..."
    
    # Try to delete the item, capture both stdout and stderr
    local delete_output
    local delete_error
    delete_output=$(aws dynamodb delete-item \
        --region "$AWS_REGION" \
        --table-name "$table_name" \
        --key "{\"email\":{\"S\":\"$email\"}}" \
        --return-values ALL_OLD \
        --output json 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        # Check if an item was actually deleted
        if [ -n "$delete_output" ] && [ "$delete_output" != "{}" ]; then
            print_success "Deleted item from $description"
        else
            print_warning "No item found in $description for email: $email"
        fi
    else
        print_error "Failed to delete from $description"
        print_error "Error details: $delete_output"
        return 1
    fi
}

# Function to delete all rate limit records for an email (composite key table)
delete_rate_limit_records() {
    local email=$1
    
    print_info "Deleting rate limit records for email: $email"
    
    # First, query all rate limit records for this email
    local query_output
    query_output=$(aws dynamodb query \
        --region "$AWS_REGION" \
        --table-name "$RATE_LIMIT_TABLE_NAME" \
        --key-condition-expression "email = :email" \
        --expression-attribute-values "{\":email\":{\"S\":\"$email\"}}" \
        --output json 2>&1)
    local query_exit_code=$?
    
    if [ $query_exit_code -ne 0 ]; then
        print_error "Failed to query Rate Limit table"
        print_error "Query error details: $query_output"
        return 1
    fi
    
    # Check if any records exist
    local item_count
    item_count=$(echo "$query_output" | jq -r '.Count' 2>/dev/null)
    if [ $? -ne 0 ]; then
        print_error "Failed to parse rate limit query response"
        print_error "Response was: $query_output"
        return 1
    fi
    
    if [ "$item_count" -eq 0 ]; then
        print_warning "No rate limit records found for email: $email"
        return 0
    fi
    
    print_info "Found $item_count rate limit record(s) to delete"
    
    # Extract and delete each record
    local deleted_count=0
    local failed_count=0
    
    # Use jq to extract each item and delete it
    echo "$query_output" | jq -r '.Items[] | @base64' | while read -r item; do
        # Decode the base64 item
        local decoded_item
        decoded_item=$(echo "$item" | base64 --decode)
        
        # Extract email and request_timestamp
        local item_email
        local request_timestamp
        item_email=$(echo "$decoded_item" | jq -r '.email.S')
        request_timestamp=$(echo "$decoded_item" | jq -r '.request_timestamp.N')
        
        if [ "$item_email" != "null" ] && [ "$request_timestamp" != "null" ]; then
            # Delete this specific record
            local delete_output
            delete_output=$(aws dynamodb delete-item \
                --region "$AWS_REGION" \
                --table-name "$RATE_LIMIT_TABLE_NAME" \
                --key "{\"email\":{\"S\":\"$item_email\"},\"request_timestamp\":{\"N\":\"$request_timestamp\"}}" \
                --output json 2>&1)
            local delete_exit_code=$?
            
            if [ $delete_exit_code -eq 0 ]; then
                ((deleted_count++))
            else
                ((failed_count++))
                print_error "Failed to delete rate limit record with timestamp $request_timestamp"
                print_error "Delete error: $delete_output"
            fi
        fi
    done
    
    # Note: The while loop runs in a subshell, so we can't access the counters here
    # Instead, we'll do a final check to see if records were deleted
    local final_query_output
    final_query_output=$(aws dynamodb query \
        --region "$AWS_REGION" \
        --table-name "$RATE_LIMIT_TABLE_NAME" \
        --key-condition-expression "email = :email" \
        --expression-attribute-values "{\":email\":{\"S\":\"$email\"}}" \
        --select COUNT \
        --output json 2>&1)
    
    if [ $? -eq 0 ]; then
        local remaining_count
        remaining_count=$(echo "$final_query_output" | jq -r '.Count' 2>/dev/null)
        if [ "$remaining_count" -eq 0 ]; then
            print_success "Deleted all rate limit records for email: $email"
        else
            print_warning "Some rate limit records may still remain ($remaining_count found)"
        fi
    else
        print_warning "Could not verify rate limit record deletion"
    fi
}

# Function to delete user from DynamoDB users table (uses user_id as primary key)
# Returns the user_id via global variable USER_ID for use in session deletion
delete_user_from_users_table() {
    local email=$1
    USER_ID=""  # Global variable to store user_id
    
    print_info "Looking up user in Users table..."
    
    # First, find the user by email using GSI, capture errors
    local query_output
    local query_error
    query_output=$(aws dynamodb query \
        --region "$AWS_REGION" \
        --table-name "$USERS_TABLE_NAME" \
        --index-name "email-index" \
        --key-condition-expression "email = :email" \
        --expression-attribute-values "{\":email\":{\"S\":\"$email\"}}" \
        --output json 2>&1)
    local query_exit_code=$?
    
    if [ $query_exit_code -ne 0 ]; then
        print_error "Failed to query Users table"
        print_error "Query error details: $query_output"
        return 1
    fi
    
    # Check if jq is available for JSON parsing
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install jq to parse JSON responses."
        print_error "Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
        return 1
    fi
    
    # Check if user exists
    local item_count
    item_count=$(echo "$query_output" | jq -r '.Count' 2>/dev/null)
    if [ $? -ne 0 ]; then
        print_error "Failed to parse query response"
        print_error "Response was: $query_output"
        return 1
    fi
    
    if [ "$item_count" -eq 0 ]; then
        print_warning "No user found in Users table for email: $email"
        return 0
    fi
    
    # Extract user_id
    local user_id
    user_id=$(echo "$query_output" | jq -r '.Items[0].user_id.S' 2>/dev/null)
    if [ $? -ne 0 ] || [ "$user_id" = "null" ] || [ -z "$user_id" ]; then
        print_error "Could not extract user_id from Users table"
        print_error "Query response was: $query_output"
        return 1
    fi
    
    print_info "Found user with ID: $user_id"
    USER_ID="$user_id"  # Store for session deletion
    
    # Delete the user by user_id, capture errors
    local delete_output
    delete_output=$(aws dynamodb delete-item \
        --region "$AWS_REGION" \
        --table-name "$USERS_TABLE_NAME" \
        --key "{\"user_id\":{\"S\":\"$user_id\"}}" \
        --return-values ALL_OLD \
        --output json 2>&1)
    local delete_exit_code=$?
    
    if [ $delete_exit_code -eq 0 ]; then
        if [ -n "$delete_output" ] && [ "$delete_output" != "{}" ]; then
            print_success "Deleted user from Users table"
        else
            print_warning "User may have already been deleted from Users table"
        fi
    else
        print_error "Failed to delete user from Users table"
        print_error "Delete error details: $delete_output"
        return 1
    fi
}

# Function to delete all session records for a user_id
delete_user_sessions() {
    local user_id=$1
    
    if [ -z "$user_id" ]; then
        print_warning "No user_id provided, skipping session deletion"
        return 0
    fi
    
    print_info "Deleting session records for user_id: $user_id"
    
    # Query all sessions for this user using the user-sessions-index GSI
    local query_output
    query_output=$(aws dynamodb query \
        --region "$AWS_REGION" \
        --table-name "$SESSION_TABLE_NAME" \
        --index-name "user-sessions-index" \
        --key-condition-expression "user_id = :user_id" \
        --expression-attribute-values "{\":user_id\":{\"S\":\"$user_id\"}}" \
        --output json 2>&1)
    local query_exit_code=$?
    
    if [ $query_exit_code -ne 0 ]; then
        print_error "Failed to query Session table"
        print_error "Query error details: $query_output"
        return 1
    fi
    
    # Check if any sessions exist
    local item_count
    item_count=$(echo "$query_output" | jq -r '.Count' 2>/dev/null)
    if [ $? -ne 0 ]; then
        print_error "Failed to parse session query response"
        print_error "Response was: $query_output"
        return 1
    fi
    
    if [ "$item_count" -eq 0 ]; then
        print_warning "No session records found for user_id: $user_id"
        return 0
    fi
    
    print_info "Found $item_count session record(s) to delete"
    
    # Extract and delete each session record
    local deleted_count=0
    local failed_count=0
    
    # Use jq to extract each item and delete it
    echo "$query_output" | jq -r '.Items[] | @base64' | while read -r item; do
        # Decode the base64 item
        local decoded_item
        decoded_item=$(echo "$item" | base64 --decode)
        
        # Extract session_id (primary key)
        local session_id
        session_id=$(echo "$decoded_item" | jq -r '.session_id.S')
        
        if [ "$session_id" != "null" ] && [ -n "$session_id" ]; then
            # Delete this specific session record
            local delete_output
            delete_output=$(aws dynamodb delete-item \
                --region "$AWS_REGION" \
                --table-name "$SESSION_TABLE_NAME" \
                --key "{\"session_id\":{\"S\":\"$session_id\"}}" \
                --output json 2>&1)
            local delete_exit_code=$?
            
            if [ $delete_exit_code -eq 0 ]; then
                ((deleted_count++))
            else
                ((failed_count++))
                print_error "Failed to delete session record with ID $session_id"
                print_error "Delete error: $delete_output"
            fi
        fi
    done
    
    # Verify deletion by checking if any sessions remain
    local final_query_output
    final_query_output=$(aws dynamodb query \
        --region "$AWS_REGION" \
        --table-name "$SESSION_TABLE_NAME" \
        --index-name "user-sessions-index" \
        --key-condition-expression "user_id = :user_id" \
        --expression-attribute-values "{\":user_id\":{\"S\":\"$user_id\"}}" \
        --select COUNT \
        --output json 2>&1)
    
    if [ $? -eq 0 ]; then
        local remaining_count
        remaining_count=$(echo "$final_query_output" | jq -r '.Count' 2>/dev/null)
        if [ "$remaining_count" -eq 0 ]; then
            print_success "Deleted all session records for user_id: $user_id"
        else
            print_warning "Some session records may still remain ($remaining_count found)"
        fi
    else
        print_warning "Could not verify session record deletion"
    fi
}

# Function to delete user from Cognito
delete_cognito_user() {
    local email=$1
    
    print_info "Deleting user from Cognito User Pool..."
    
    # Try to delete user, capture errors
    local delete_output
    delete_output=$(aws cognito-idp admin-delete-user \
        --region "$AWS_REGION" \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --username "$email" 2>&1)
    local delete_exit_code=$?
    
    if [ $delete_exit_code -eq 0 ]; then
        print_success "Deleted user from Cognito User Pool"
    else
        # Check if the error is because user doesn't exist
        if echo "$delete_output" | grep -q "UserNotFoundException"; then
            print_warning "User not found in Cognito User Pool (may have already been deleted)"
        else
            print_error "Failed to delete user from Cognito User Pool"
            print_error "Cognito error details: $delete_output"
            
            # Try to get more info about the user to help diagnose
            print_info "Attempting to get user info for diagnosis..."
            local user_info
            user_info=$(aws cognito-idp admin-get-user \
                --region "$AWS_REGION" \
                --user-pool-id "$COGNITO_USER_POOL_ID" \
                --username "$email" 2>&1)
            local get_user_exit_code=$?
            
            if [ $get_user_exit_code -eq 0 ]; then
                print_info "User exists in Cognito but deletion failed"
                print_info "User status: $(echo "$user_info" | jq -r '.UserStatus' 2>/dev/null || echo "Could not parse status")"
            else
                print_info "Could not retrieve user info: $user_info"
            fi
            return 1
        fi
    fi
}

# Execute deletions
ERRORS=0
USER_ID=""  # Global variable to store user_id for session deletion

# Delete from Users table (special handling for user_id primary key)
# This also populates USER_ID for session deletion
if ! delete_user_from_users_table "$EMAIL"; then
    ((ERRORS++))
fi

# Delete from Session table (uses user_id from Users table lookup)
if ! delete_user_sessions "$USER_ID"; then
    ((ERRORS++))
fi

# Delete from OTP table
if ! delete_dynamodb_item "$OTP_TABLE_NAME" "$EMAIL" "OTP table"; then
    ((ERRORS++))
fi

# Delete from Rate Limit table (composite key table)
if ! delete_rate_limit_records "$EMAIL"; then
    ((ERRORS++))
fi

# Delete from Cognito
if ! delete_cognito_user "$EMAIL"; then
    ((ERRORS++))
fi

# Clean up any temporary files (none used in current version, but keeping for future use)
# rm -f /tmp/delete_*.json

echo
if [ $ERRORS -eq 0 ]; then
    print_success "✨ User deletion completed successfully for: $EMAIL"
    print_info "All traces of the user have been removed from the authentication system"
else
    print_warning "User deletion completed with $ERRORS errors for: $EMAIL"
    print_info "Some items may not have existed or may have already been deleted"
fi

echo
print_info "Deletion process finished"