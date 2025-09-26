# IAM Security Enhancements with Environment-Based Tag Conditions

## Overview

This document describes the IAM security enhancements implemented to ensure proper environment isolation using AWS resource tags. The implementation prevents cross-environment access by requiring matching Environment tags between IAM roles and the resources they access.

## Security Model

### Tag-Based Access Control

All IAM policies now include conditions that restrict access based on the `Environment` tag:

```json
{
  "Condition": {
    "StringEquals": {
      "aws:ResourceTag/Environment": "${ENVIRONMENT}"
    }
  }
}
```

This ensures that:
- Test environment Lambda functions can only access test environment resources
- Production environment Lambda functions can only access production environment resources
- Cross-environment access is explicitly denied

## Implementation Details

### Authentication Stack Security Enhancements

#### DynamoDB Access Control
- **Resources**: OTP table, Rate limit table, Users table, Session table, and indexes
- **Actions**: All CRUD operations (GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan, Batch operations)
- **Condition**: `aws:ResourceTag/Environment` must match the Lambda's environment

#### Cognito Access Control
- **Resources**: Cognito User Pools
- **Actions**: AdminConfirmSignUp, AdminGetUser, AdminUpdateUserAttributes
- **Condition**: `aws:ResourceTag/Environment` must match the Lambda's environment

#### SES Access Control
- **Resources**: All SES resources (sending operations)
- **Actions**: SendEmail, SendRawEmail, SendTemplatedEmail
- **Condition**: `ses:FromAddress` restriction (domain-based control)

### Notifications Stack Security Enhancements

#### SES Template Access Control
- **Resources**: SES templates
- **Actions**: GetTemplate, ListTemplates
- **Condition**: `aws:ResourceTag/Environment` must match the Lambda's environment

#### SQS Access Control
- **Resources**: Email queue and dead letter queue
- **Actions**: ReceiveMessage, DeleteMessage, GetQueueAttributes
- **Condition**: `aws:ResourceTag/Environment` must match the Lambda's environment

#### SES Sending Control
- **Resources**: All SES resources (sending operations)
- **Actions**: SendEmail, SendRawEmail, SendTemplatedEmail
- **Condition**: `ses:FromAddress` restriction to approved domain

## Environment Isolation Verification

### Automated Testing

Run the IAM conditions test:

```bash
cd appre-services
node test-iam-conditions.js
```

This test verifies that all IAM policies include the required environment-based tag conditions.

### Manual Verification Steps

1. **Deploy to Test Environment**:
   ```bash
   cd authentication/cdk
   ENVIRONMENT=test npm run deploy
   
   cd ../../notifications/cdk
   ENVIRONMENT=test npm run deploy
   ```

2. **Deploy to Production Environment**:
   ```bash
   cd authentication/cdk
   ENVIRONMENT=prod npm run deploy
   
   cd ../../notifications/cdk
   ENVIRONMENT=prod npm run deploy
   ```

3. **Verify Resource Tags**:
   Check that all resources have the correct Environment tags:
   - DynamoDB tables: `Environment=test` or `Environment=prod`
   - Lambda functions: `Environment=test` or `Environment=prod`
   - SES templates: `Environment=test` or `Environment=prod`
   - SQS queues: `Environment=test` or `Environment=prod`

4. **Test Cross-Environment Access**:
   - Attempt to invoke a test Lambda function against production resources
   - Verify that access is denied due to tag mismatch
   - Check CloudWatch logs for access denied errors

### Expected Behavior

#### Successful Access (Same Environment)
- Test Lambda → Test DynamoDB table: ✅ Allowed
- Prod Lambda → Prod DynamoDB table: ✅ Allowed
- Test Lambda → Test SES template: ✅ Allowed
- Prod Lambda → Prod SES template: ✅ Allowed

#### Blocked Access (Cross Environment)
- Test Lambda → Prod DynamoDB table: ❌ Denied
- Prod Lambda → Test DynamoDB table: ❌ Denied
- Test Lambda → Prod SES template: ❌ Denied
- Prod Lambda → Test SES template: ❌ Denied

## Security Benefits

1. **Environment Isolation**: Prevents accidental cross-environment data access
2. **Compliance**: Supports regulatory requirements for data separation
3. **Operational Safety**: Reduces risk of test operations affecting production
4. **Audit Trail**: Clear access patterns based on resource tags
5. **Principle of Least Privilege**: IAM roles can only access resources in their environment

## Monitoring and Alerting

### CloudWatch Metrics
Monitor for access denied errors that might indicate:
- Misconfigured resources (missing tags)
- Attempted cross-environment access
- IAM policy issues

### Recommended Alarms
1. **IAM Access Denied**: Alert on repeated access denied errors
2. **Missing Tags**: Alert when resources are created without proper tags
3. **Cross-Environment Attempts**: Alert on specific error patterns

## Troubleshooting

### Common Issues

1. **Access Denied Errors**:
   - Verify resource has correct Environment tag
   - Check IAM policy conditions
   - Confirm Lambda environment variables

2. **Missing Tags**:
   - Ensure TagBuilder is used for all resources
   - Verify tag application in CDK code
   - Check tag inheritance for child resources

3. **Policy Conflicts**:
   - Review all attached policies
   - Check for conflicting conditions
   - Validate policy syntax

### Debug Commands

```bash
# Check resource tags
aws dynamodb describe-table --table-name appre-test-users --query 'Table.Tags'

# Check IAM role policies
aws iam get-role-policy --role-name appre-test-auth-lambda-role --policy-name policy-name

# Check Lambda environment variables
aws lambda get-function-configuration --function-name appre-test-auth-create-challenge
```

## Maintenance

### Regular Reviews
1. **Quarterly**: Review all IAM policies for compliance
2. **Monthly**: Audit resource tags for consistency
3. **Weekly**: Monitor access denied metrics
4. **Daily**: Check deployment logs for tag-related issues

### Updates
When adding new resources or permissions:
1. Include environment-based tag conditions
2. Update the test script to verify new conditions
3. Document any exceptions or special cases
4. Test cross-environment isolation