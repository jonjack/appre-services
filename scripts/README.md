# Authentication Scripts

This directory contains utility scripts for managing the authentication system.

## delete-user-by-email.sh

A comprehensive script to completely remove a user from the authentication system.

### What it deletes:

1. **DynamoDB Tables:**
   - User profile from `USERS_TABLE_NAME` (queries by email via GSI, deletes by user_id)
   - OTP records from `OTP_TABLE_NAME` (deletes by email)
   - Rate limit records from `RATE_LIMIT_TABLE_NAME` (deletes by email)

2. **Cognito User Pool:**
   - User account from `COGNITO_USER_POOL_ID` (deletes by email/username)

### Prerequisites:

1. **AWS CLI installed and configured:**
   ```bash
   aws configure
   ```

2. **Environment variables set** (either in `.env` file or exported):
   - `USERS_TABLE_NAME`
   - `OTP_TABLE_NAME`
   - `RATE_LIMIT_TABLE_NAME`
   - `COGNITO_USER_POOL_ID`
   - `AWS_REGION`

3. **Appropriate AWS permissions** for:
   - DynamoDB: `dynamodb:DeleteItem`, `dynamodb:Query`
   - Cognito: `cognito-idp:AdminDeleteUser`, `cognito-idp:AdminGetUser`

### Usage:

```bash
# Navigate to the script directory
cd appre-services/scripts/authentication

# Run the script with an email address
./delete-user-by-email.sh user@example.com
```

### Features:

- ✅ **Email validation** - Checks email format before proceeding
- ✅ **Environment validation** - Verifies all required variables are set
- ✅ **AWS credentials check** - Ensures AWS CLI is configured
- ✅ **Confirmation prompt** - Asks for confirmation before deletion
- ✅ **Colored output** - Easy to read success/error messages
- ✅ **Error handling** - Gracefully handles missing items
- ✅ **Smart deletion** - Handles Users table primary key lookup via GSI
- ✅ **Comprehensive logging** - Shows exactly what was deleted

### Example Output:

```
ℹ️  Starting deletion process for user: test@example.com

ℹ️  Environment variables loaded:
ℹ️    - Users Table: {APP_NAME}-users-{ENVIRONMENT}
ℹ️    - OTP Table: {APP_NAME}-auth-otps-{ENVIRONMENT}
ℹ️    - Rate Limit Table: {APP_NAME}-auth-rate-limits-{ENVIRONMENT}
ℹ️    - Cognito User Pool: eu-west-2_ABC123DEF
ℹ️    - AWS Region: eu-west-2

✅ AWS CLI is configured and ready

⚠️  This will permanently delete all data for user: test@example.com
Are you sure you want to continue? (y/N): y

ℹ️  Looking up user in Users table...
ℹ️  Found user with ID: 12345678-1234-1234-1234-123456789abc
✅ Deleted user from Users table
✅ Deleted item from OTP table
⚠️  No item found in Rate Limit table for email: test@example.com
✅ Deleted user from Cognito User Pool

✨ User deletion completed successfully for: test@example.com
ℹ️  All traces of the user have been removed from the authentication system
```

### Safety Features:

- Requires explicit confirmation before deletion
- Validates email format
- Checks AWS credentials before starting
- Handles cases where items don't exist gracefully
- Provides detailed feedback on what was deleted

### Use Cases:

- **Development/Testing:** Clean up test users
- **GDPR Compliance:** Complete user data removal
- **Account Issues:** Reset problematic user accounts
- **Data Migration:** Clean slate for user re-registration