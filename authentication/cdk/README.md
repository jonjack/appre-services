# Authentication Infrastructure

This CDK stack creates the AWS infrastructure for the passwordless authentication system.

## Components Created

### Cognito User Pool
- **Custom Authentication Flow** enabled for OTP-based login
- **Email as username** - no traditional passwords
- **Lambda triggers** for OTP generation and validation
- **Custom attributes** for user status and Stripe account ID

### DynamoDB Tables
- **`{APP_NAME}-auth-otps-{env}`** - OTP storage with TTL
- **`{APP_NAME}-auth-rate-limits-{env}`** - Rate limiting with TTL  
- **`{APP_NAME}-users-{env}`** - User profiles with GSI for email and status

### Lambda Functions (Rust)
- **CreateAuthChallenge** - Generates and sends OTP via SES
- **VerifyAuthChallenge** - Validates OTP submissions
- **DefineAuthChallenge** - Orchestrates the custom auth flow

## Deployment

### Prerequisites
1. AWS CLI configured with appropriate permissions
2. Node.js and npm installed
3. Rust Lambda functions built (see ../lambda/README.md)

### Deploy to Development
```bash
./deploy.sh dev us-east-1
```

### Deploy to Production
```bash
./deploy.sh prod us-east-1
```

## Configuration

### Environment Variables
The Lambda functions receive these environment variables:
- `OTP_TABLE_NAME` - DynamoDB table for OTP storage
- `RATE_LIMIT_TABLE_NAME` - DynamoDB table for rate limiting
- `USERS_TABLE_NAME` - DynamoDB table for user profiles
- `FROM_EMAIL` - SES verified email for sending OTPs
- `ENVIRONMENT` - Current environment (dev/prod)

### SES Setup
Before deployment, verify your domain in SES:
1. Go to AWS SES Console
2. Add and verify your domain (e.g., appre.com)
3. Update `FROM_EMAIL` in the stack to use your verified domain

## Outputs

The stack exports these values for use in other stacks:
- `AppreUserPoolId-{env}` - Cognito User Pool ID
- `AppreUserPoolClientId-{env}` - Cognito Client ID  
- `AppreUsersTable-{env}` - Users table name

## Security Features

- **Encryption at rest** for all DynamoDB tables
- **IAM roles** with minimal required permissions
- **TTL** for automatic cleanup of temporary data
- **Rate limiting** to prevent abuse
- **X-Ray tracing** enabled for debugging

## Monitoring

CloudWatch metrics are automatically created for:
- Lambda function execution and errors
- DynamoDB read/write capacity and throttling
- Cognito authentication attempts and failures

Set up CloudWatch alarms for production monitoring.