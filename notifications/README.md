# Notifications Domain

The notifications domain handles all email communications for the Appreciata platform using AWS SES templates and SQS queues for reliable delivery.

## Architecture

```
Other Domains → SQS Email Queue → Email Processor Lambda → SES Templates → Recipients
```

## Components

### SES Templates
Pre-defined email templates for consistent branding and easy content updates:

- **OTP Email** (`appre-otp-{env}`) - One-time passcode for authentication
- **Welcome Email** (`appre-welcome-{env}`) - New user welcome message
- **Complete Registration - User Info** (`appre-complete-registration-user-info-{env}`) - Profile completion reminder
- **Complete Registration - Stripe** (`appre-complete-registration-stripe-{env}`) - Payment setup reminder
- **Newsletter** (`appre-newsletter-{env}`) - General updates and announcements

### SQS Email Queue
- **Main Queue**: `appre-email-queue-{env}`
- **Dead Letter Queue**: `appre-email-dlq-{env}`
- **Batch Processing**: Up to 5 emails per Lambda invocation
- **Priority Support**: High/Normal/Low priority message attributes
- **Retry Logic**: 3 attempts before moving to DLQ

### Email Processor Lambda
- **Runtime**: Rust (provided.al2023)
- **Trigger**: SQS queue events
- **Concurrency**: Limited to 10 to respect SES rate limits
- **Timeout**: 5 minutes for reliable processing
- **Memory**: 256MB

## Usage

### From Other Domains

```rust
use notifications_shared::{EmailRequest, EmailQueueService};

// Create email request
let email_request = EmailRequest::otp(
    "user@example.com".to_string(),
    "123456".to_string(),
);

// Queue for processing
let queue_service = EmailQueueService::new(sqs_client, queue_url);
let message_id = queue_service.queue_email(email_request).await?;
```

### Helper Methods

```rust
// OTP email
let request = EmailRequest::otp(recipient, otp_code);

// Welcome email
let request = EmailRequest::welcome(recipient, first_name, dashboard_url);

// Registration reminders
let request = EmailRequest::complete_registration_user_info(
    recipient, first_name, profile_url, unsubscribe_url
);

// Newsletter
let request = EmailRequest::newsletter(
    recipient, subject, content, unsubscribe_url, cta_text, cta_url
);
```

## Development

### Prerequisites
- Rust toolchain
- `cargo-lambda` for building Lambda functions
- Node.js and pnpm for CDK
- AWS CLI configured

### Building Lambda Functions
```bash
cd lambda
./build.sh
```

### Deploying Infrastructure
```bash
cd cdk
pnpm install
pnpm run deploy:dev
```

### Testing Email Templates
Templates can be tested in the AWS SES console or via AWS CLI:

```bash
aws ses send-templated-email \
  --source "noreply@appreciata.com" \
  --destination "ToAddresses=test@example.com" \
  --template "appre-otp-test" \
  --template-data '{"otp":"123456"}'
```

## Configuration

### Environment Variables
- `FROM_EMAIL`: Default sender email address
- `ENVIRONMENT`: Environment name (dev/prod)

### SES Setup Requirements
1. Verify sender domain in SES
2. Move out of SES sandbox for production
3. Set up DKIM signing for better deliverability
4. Configure bounce and complaint handling

## Monitoring

### CloudWatch Metrics
- Lambda invocations and errors
- SQS queue depth and message age
- SES sending statistics

### Logging
- Structured logging with tracing
- Email sending success/failure tracking
- Template usage analytics

## Security

### IAM Permissions
- Lambda has minimal SES and SQS permissions
- No cross-account access
- Encrypted SQS queues

### Email Security
- DKIM signing enabled
- SPF records configured
- Bounce and complaint handling
- Unsubscribe link in all marketing emails

## Future Enhancements

- [ ] Email analytics and tracking
- [ ] A/B testing for email templates
- [ ] SMS notifications via SNS
- [ ] Push notifications
- [ ] Email scheduling and campaigns
- [ ] Unsubscribe management
- [ ] Email preference center