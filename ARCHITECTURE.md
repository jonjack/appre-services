# Appreciata Services Architecture

## Domain-Driven Structure

This project follows a domain-driven architecture where services are organized by business domains rather than AWS services or technical concerns.

### Current Domains

#### Authentication (`/authentication`)
Handles all user authentication, registration, and session management.

**Components:**
- **CDK Infrastructure** (`/cdk`) - CloudFormation stacks and constructs
  - `authentication-stack.ts` - Main stack with Cognito, Lambda triggers, and DynamoDB tables
  - `constructs/` - Reusable CDK constructs for domain-specific resources
    - `session-table.ts` - User session management table
    - `otp-table.ts` - OTP storage and verification
    - `rate-limit-table.ts` - Rate limiting for OTP requests
    - `users-table.ts` - User profile and status management
- **Lambda Functions** (`/lambda`) - Cognito triggers and auth handlers
  - `create-auth-challenge/` - Generates and sends OTP codes
  - `verify-auth-challenge/` - Validates OTP codes and creates sessions
  - `define-auth-challenge/` - Defines custom auth flow logic
- **Shared Library** (`/shared`) - Common Rust code for authentication domain
  - `models.rs` - Data structures and types
  - `services/` - Business logic services
    - `dynamodb_service.rs` - Database operations
    - `ses_service.rs` - Email delivery
    - `rate_limit_service.rs` - Rate limiting logic
  - `utils.rs` - Utility functions (OTP generation, hashing, etc.)
  - `errors.rs` - Domain-specific error types

### Design Principles

1. **Domain Boundaries**: Each domain is self-contained with its own infrastructure, business logic, and data models
2. **Shared Resources**: Only truly cross-cutting concerns should be in shared libraries
3. **Infrastructure as Code**: All AWS resources are defined in CDK within their respective domains
4. **Reusable Constructs**: Common infrastructure patterns are extracted into reusable CDK constructs
5. **Type Safety**: Rust shared libraries provide compile-time guarantees across Lambda functions

### Future Domains

As the application grows, additional domains will be added:
- **User Management** - Profile management, preferences, admin operations
- **Payments** - Stripe integration, subscription logic, webhooks
- **Content** - Creator content, media handling, approval workflows
- **Analytics** - Usage tracking, reporting, insights

### Benefits of This Structure

- **Clear Ownership**: Each domain has clear boundaries and responsibilities
- **Independent Deployment**: Domains can be deployed independently
- **Scalable Team Structure**: Teams can own entire domains end-to-end
- **Reduced Coupling**: Changes in one domain don't affect others
- **Technology Flexibility**: Each domain can choose appropriate technologies
- **Easier Testing**: Domain boundaries make integration testing more focused