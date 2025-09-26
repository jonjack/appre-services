# Appreciata Services

Backend services for the Appreciata platform, organized by business domains.

## Architecture

This project follows a **domain-driven architecture** where services are organized by business domains rather than AWS services or technical concerns. See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed information.

## Project Structure

```
appre-services/
├── authentication/           # Authentication domain
│   ├── cdk/                 # CDK infrastructure and constructs
│   ├── lambda/              # Cognito triggers and auth handlers
│   ├── shared/              # Domain-specific Rust library
│   └── cognito/             # Cognito configuration
├── user-management/         # User profiles and management (future)
├── payments/                # Stripe integration and webhooks (future)
└── ARCHITECTURE.md          # Domain-driven architecture documentation
```

## Current Status & TODO

### Completed
- ✅ Registration flow with Cognito and session management
- ✅ DynamoDB session management with TTL
- ✅ Domain-driven architecture restructuring
- ✅ Shared Rust library for authentication domain

### In Progress
- 🔄 Login flow integration (similar to registration)
- 🔄 Session expiration testing (20-minute TTL)

### TODO
- [ ] Implement logout functionality (explicit session removal)
- [ ] Standardize DynamoDB table naming conventions
- [ ] Review and optimize DynamoDB indexes for payment page use cases
- [ ] Test session TTL eviction behavior
- [ ] Consider shortening app/repo names (appreciata → appre)

## Building the Services

### Prerequisites
- **Rust** - Install from https://rustup.rs/
- **cargo-lambda** - For building Lambda functions: `cargo install cargo-lambda`
- **Node.js & pnpm** - For CDK infrastructure
- **AWS CLI** - Configured with appropriate permissions

### Environment Setup
Ensure your environment variables are set in `.env`:
```bash
ENVIRONMENT=dev          # or test/prod
AWS_REGION=eu-west-2    # your preferred region
AWS_ACCOUNT_ID=123456789012  # your AWS account ID
```

### Build Authentication Services
```bash
# Build Lambda functions
cd authentication/lambda
./build.sh

# Build CDK infrastructure
cd ../cdk
pnpm install
pnpm run build
```

### Build Notifications Services
```bash
# Build Lambda functions
cd notifications/lambda
./build.sh

# Build CDK infrastructure
cd ../cdk
pnpm install
pnpm run build
```

### Build All Services (Quick Option)
```bash
# From the appre-services root directory
./build-all.sh
```

## Deploying the Services

### Prerequisites for Deployment
- AWS CLI configured with deployment permissions
- Environment variables set in `.env` file
- Services built (see Building section above)

### Deploy Authentication Stack
```bash
cd authentication/cdk
./deploy.sh [environment] [region]

# Examples:
./deploy.sh dev eu-west-2
./deploy.sh prod us-east-1

# Or use environment variables from .env:
./deploy.sh
```

**What gets deployed:**
- DynamoDB tables: `appreciata-auth-otps-{env}`, `appreciata-users-{env}`, `appreciata-rate-limits-{env}`, `appreciata-user-sessions-{env}`
- Lambda functions: `appreciata-auth-create-challenge-{env}`, `appreciata-auth-verify-challenge-{env}`, `appreciata-auth-define-challenge-{env}`
- Cognito User Pool: `appreciata-users-{env}` with custom authentication flow
- IAM roles and policies for Lambda functions

### Deploy Notifications Stack
```bash
cd notifications/cdk
./deploy.sh [environment] [region]

# Examples:
./deploy.sh dev eu-west-2
./deploy.sh prod us-east-1

# Or use environment variables from .env:
./deploy.sh
```

**What gets deployed:**
- SES email templates: `appreciata-otp-{env}`, `appreciata-welcome-{env}`, etc.
- SQS queues: `appreciata-email-queue-{env}`, `appreciata-email-dlq-{env}`
- Lambda function: `appreciata-email-processor-{env}`
- IAM roles and policies for email processing

### Deploy All Services (Quick Option)
```bash
# From the appre-services root directory
./build-all.sh  # Builds and deploys everything
```

### Post-Deployment Steps

#### After Authentication Deployment:
1. **Verify SES Domain**: Go to AWS SES Console and verify your domain for email sending
2. **Enable Email OTP**: In Cognito User Pool console, enable "Email OTP" authentication method
3. **Update webapp configuration**: Copy the Cognito User Pool ID and Client ID to your webapp `.env`

#### After Notifications Deployment:
1. **Verify SES Templates**: Check that email templates were created successfully
2. **Test Email Queue**: Send a test message to verify email processing works
3. **Monitor CloudWatch Logs**: Ensure Lambda functions are executing without errors

### Deployment Outputs
Both stacks export important values that can be referenced by other stacks or applications:

**Authentication Stack Exports:**
- `ApreciataUserPoolId-{env}` - Cognito User Pool ID
- `ApreciataUserPoolClientId-{env}` - Cognito Client ID
- `ApreciataUsersTable-{env}` - Users table name

**Notifications Stack Exports:**
- `ApreciataOTPTemplateId-{env}` - OTP email template ID
- `ApreciataWelcomeTemplateId-{env}` - Welcome email template ID
- `ApreciataEmailQueueUrl-{env}` - Email processing queue URL

### Troubleshooting Deployment

**Common Issues:**
- **CDK Bootstrap Required**: Run `npx cdk bootstrap` in the CDK directory if you get bootstrap errors
- **Permission Errors**: Ensure your AWS CLI has sufficient permissions for CloudFormation, Lambda, DynamoDB, SES, etc.
- **SES Sandbox**: In development, SES is in sandbox mode - verify recipient email addresses
- **Lambda Build Errors**: Ensure Rust Lambda functions are built before CDK deployment

**Useful Commands:**
```bash
# Check CDK diff before deployment
cd authentication/cdk && pnpm run diff
cd notifications/cdk && pnpm run diff

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name ApreciataAuth-dev

# Check Lambda logs
aws logs tail /aws/lambda/appreciata-auth-create-challenge-dev --follow
```

## Development

Each domain is self-contained and can be developed/deployed independently. See individual domain READMEs for specific setup instructions.


## Manual Infrastructure Tasks

### Cognito

Each time we recreate the Cognito user pool we need to manually update some configuration settings via the console as I did not work out how to do it via CDK 
> TODO: Explore if this can be done with CDK stack definition?
This is a one-off task that we shall rarely need to do however so maybe dont bother trying to automate?

1. Login to the AWS Console and go to Cognito.
2. User Pools -> choose pool -> 
    - "Set up passwordless sign-in" -> Edit "Options for choice-based sign-in"
    Check box for "Email message one-time password"
    - Go to "Sign up" menu and check "Enable self-registration"
