# Authentication Lambda Functions

This directory contains the Rust Lambda functions that implement the custom authentication flow for Cognito.

## Functions

### 1. CreateAuthChallenge
**Purpose**: Generates and sends OTP via email when a user attempts to authenticate.

**Responsibilities**:
- Validates email format and rate limiting
- Generates 6-digit OTP and stores securely in DynamoDB
- Sends OTP email via SES
- Creates new user accounts for registration flow
- Records request for rate limiting

**Environment Variables**:
- `OTP_TABLE_NAME` - DynamoDB table for OTP storage
- `RATE_LIMIT_TABLE_NAME` - DynamoDB table for rate limiting
- `USERS_TABLE_NAME` - DynamoDB table for user profiles
- `FROM_EMAIL` - SES verified email for sending OTPs

### 2. VerifyAuthChallenge
**Purpose**: Validates the OTP submitted by the user.

**Responsibilities**:
- Validates OTP format and existence
- Checks OTP expiration (5 minutes)
- Uses constant-time comparison to prevent timing attacks
- Cleans up OTP record after successful verification

**Environment Variables**:
- `OTP_TABLE_NAME` - DynamoDB table for OTP storage
- `USERS_TABLE_NAME` - DynamoDB table for user profiles

### 3. DefineAuthChallenge
**Purpose**: Orchestrates the custom authentication flow.

**Responsibilities**:
- Determines when to issue custom challenges
- Decides when to issue JWT tokens
- Handles authentication success/failure states
- Manages the challenge sequence

## Building

### Prerequisites
1. **Rust** installed (https://rustup.rs/)
2. **cargo-lambda** for building Lambda functions:
   ```bash
   cargo install cargo-lambda
   ```

### Build All Functions
```bash
./build.sh
```

This will:
- Install cargo-lambda if not present
- Build all functions for AWS Lambda runtime
- Create deployment packages in `target/lambda/`

### Build Individual Functions
```bash
cargo lambda build --release --bin create-auth-challenge
cargo lambda build --release --bin verify-auth-challenge
cargo lambda build --release --bin define-auth-challenge
```

## Testing

### Unit Tests
```bash
cargo test
```

### Integration Tests
The functions can be tested with the AWS Lambda runtime locally:
```bash
cargo lambda watch --bin create-auth-challenge
```

## Security Features

### OTP Security
- **6-digit codes** with 1,000,000 combinations
- **5-minute expiration** limits attack window
- **SHA-256 hashing** for secure storage
- **Constant-time comparison** prevents timing attacks

### Rate Limiting
- **3 requests per 15 minutes** per email address
- **Automatic cleanup** via DynamoDB TTL
- **Graceful error handling** with retry information

### Input Validation
- **Email format validation**
- **OTP format validation** (6 digits only)
- **Comprehensive error handling**

## Monitoring

### CloudWatch Logs
Each function logs to CloudWatch with structured logging:
- Info level for normal operations
- Warn level for rate limiting and invalid attempts
- Error level for system failures

### Metrics
Monitor these CloudWatch metrics:
- Lambda invocation count and duration
- DynamoDB read/write operations
- SES email sending success/failure
- Custom metrics for authentication success rates

### Alarms
Set up CloudWatch alarms for:
- High error rates
- DynamoDB throttling
- SES bounce rates
- Unusual authentication patterns

## Authentication Flow Integration

### Registration Journey

When a new user registers with their email address:

1. **Frontend** calls Cognito `InitiateAuth` with email and `CUSTOM_AUTH` flow
2. **DefineAuthChallenge** determines this is the first attempt and issues a `CUSTOM_CHALLENGE`
3. **CreateAuthChallenge** is triggered:
   - Validates email format and rate limiting
   - **Creates new user account** in DynamoDB with `pending_verification` status
   - Generates 6-digit OTP and stores it securely
   - Sends welcome email with OTP via SES
4. **Frontend** prompts user to enter OTP from email
5. **Frontend** calls Cognito `RespondToAuthChallenge` with the OTP
6. **VerifyAuthChallenge** validates the OTP:
   - Checks OTP format, existence, and expiration
   - **Updates user status** to `verified` in DynamoDB
   - Returns success to continue the flow
7. **DefineAuthChallenge** sees successful verification and issues JWT tokens
8. **User is now registered and authenticated** with valid tokens

### Login Journey

When an existing user logs in with their email address:

1. **Frontend** calls Cognito `InitiateAuth` with email and `CUSTOM_AUTH` flow
2. **DefineAuthChallenge** determines this is the first attempt and issues a `CUSTOM_CHALLENGE`
3. **CreateAuthChallenge** is triggered:
   - Validates email format and rate limiting
   - **Verifies user exists** in DynamoDB (no new account creation)
   - Generates 6-digit OTP and stores it securely
   - Sends login email with OTP via SES
4. **Frontend** prompts user to enter OTP from email
5. **Frontend** calls Cognito `RespondToAuthChallenge` with the OTP
6. **VerifyAuthChallenge** validates the OTP:
   - Checks OTP format, existence, and expiration
   - **Updates user's last_login** timestamp in DynamoDB
   - Returns success to continue the flow
7. **DefineAuthChallenge** sees successful verification and issues JWT tokens
8. **User is now authenticated** with valid tokens

### Key Differences

**Registration vs Login**:
- **Registration**: Creates new user record in DynamoDB with `pending_verification` status
- **Login**: Validates existing user and updates `last_login` timestamp
- **Email Content**: Welcome message for registration, login notification for existing users
- **User Status**: Registration updates status from `pending_verification` to `verified`

**Common Flow Elements**:
- Both use the same 3-Lambda sequence: Define → Create → Verify → Define
- Same OTP generation, storage, and validation logic
- Same rate limiting and security measures
- Same JWT token issuance upon successful verification

## Deployment

The Lambda functions are deployed via the CDK stack in `../cdk/`. The CDK references the built artifacts from `target/lambda/`.

Build order:
1. Build Lambda functions: `./build.sh`
2. Deploy CDK infrastructure: `cd ../cdk && ./deploy.sh`

## Environment Configuration

### Development
- Lower memory allocation (256MB)
- Shorter timeout (30s)
- Debug logging enabled

### Production
- Optimized memory allocation based on profiling
- Appropriate timeout settings
- Info level logging
- Enhanced monitoring and alerting