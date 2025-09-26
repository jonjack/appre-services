# CDK Utilities

Shared CDK utilities for consistent resource naming, configuration loading, and tagging across all Appre services.

## Features

- **Environment Configuration**: Load configuration from .env files with CDK context override support
- **Resource Naming**: Consistent naming following the `{APP_NAME}-{ENVIRONMENT}-{RESOURCE_NAME}` pattern
- **Global Tagging**: Standardized tagging with Application, Environment, Domain, and ManagedBy tags
- **Unified Interface**: Single utility class that combines all functionality

## Installation

```bash
pnpm install @appre/cdk-utils
```

## Usage

### Basic Usage with AppResourceBuilder

The `AppResourceBuilder` class provides a unified interface for all utilities:

```typescript
import * as cdk from 'aws-cdk-lib';
import { AppResourceBuilder, SERVICE_DOMAINS } from '@appre/cdk-utils';

const app = new cdk.App();

// Create resource builder for authentication service
const builder = new AppResourceBuilder(app, SERVICE_DOMAINS.AUTHENTICATION);

// Create stack with consistent naming and tagging
const stack = new cdk.Stack(app, builder.getStackName('auth'), builder.getStackProps());

// Create resources with consistent naming
const userTable = new dynamodb.Table(stack, 'UserTable', {
  tableName: builder.names.dynamoTable('users'),
  // ... other props
});

// Apply consistent tags
cdk.Tags.of(userTable).add('Table', 'users');
```

### Environment Configuration

Load configuration from .env files with CDK context override support:

```typescript
import { getEnvironmentConfig } from '@appre/cdk-utils';

const config = getEnvironmentConfig(app);
console.log(config.appName);     // 'appre'
console.log(config.environment); // 'test' or 'prod'
console.log(config.region);      // 'eu-west-2'
```

### Resource Naming

Generate consistent resource names:

```typescript
import { ResourceNames } from '@appre/cdk-utils';

const names = new ResourceNames(config);

names.lambda('email-processor');        // 'appre-test-email-processor'
names.dynamoTable('users');            // 'appre-test-users'
names.sqsQueue('email-queue');          // 'appre-test-email-queue'
names.sesTemplate('otp');               // 'appre-test-otp'
names.logGroup('email-processor');      // '/aws/lambda/appre-test-email-processor'
```

### Global Tagging

Create consistent tags across all resources:

```typescript
import { TagBuilder, SERVICE_DOMAINS } from '@appre/cdk-utils';

const tags = new TagBuilder(config, SERVICE_DOMAINS.AUTHENTICATION);

// Base service tags
const baseTags = tags.getBaseTags();
// {
//   Application: 'appre',
//   Environment: 'test',
//   Domain: 'auth',
//   ManagedBy: 'cdk'
// }

// Component-specific tags
const lambdaTags = tags.getLambdaTags('email-processor');
// {
//   Application: 'appre',
//   Environment: 'test',
//   Domain: 'auth',
//   ManagedBy: 'cdk',
//   Component: 'lambda',
//   Function: 'email-processor'
// }
```

## Service Domains

Available service domains:

- `SERVICE_DOMAINS.AUTHENTICATION` - 'auth'
- `SERVICE_DOMAINS.NOTIFICATIONS` - 'notifications'
- `SERVICE_DOMAINS.USER_MANAGEMENT` - 'user-management'
- `SERVICE_DOMAINS.PAYMENTS` - 'payments'
- `SERVICE_DOMAINS.SHARED` - 'shared'

## Environment Variables

The utilities expect these environment variables (loaded from .env files):

```bash
# Required
APP_NAME=appre
ENVIRONMENT=test  # or 'dev', 'prod'
AWS_REGION=eu-west-2

# Optional
AWS_ACCOUNT_ID=123456789012
CDK_DEFAULT_REGION=eu-west-2  # fallback for AWS_REGION
CDK_DEFAULT_ACCOUNT=123456789012  # fallback for AWS_ACCOUNT_ID
```

## CDK Context Override

You can override environment variables using CDK context:

```bash
cdk deploy --context environment=prod --context region=us-east-1
```

## File Structure

```
src/
├── config.ts      # Environment configuration loading
├── naming.ts      # Resource naming utilities
├── tagging.ts     # Global tagging utilities
├── utils.ts       # AppResourceBuilder main class
└── index.ts       # Public API exports
```

## Testing

```bash
pnpm test
```

## Building

```bash
pnpm run build
```