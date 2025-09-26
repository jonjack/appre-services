import { EnvironmentConfig } from './config';

/**
 * Resource naming interface
 */
export interface ResourceNaming {
  pattern: string;
  appName: string;
  environment: string;
  resourceName: string;
  fullName: string;
}

/**
 * Create a resource name following the {APP_NAME}-{ENVIRONMENT}-{RESOURCE_NAME} pattern
 */
export function createResourceName(resourceName: string, config: EnvironmentConfig): string {
  return `${config.appName}-${config.environment}-${resourceName}`;
}

/**
 * Create a detailed resource naming object
 */
export function createResourceNaming(resourceName: string, config: EnvironmentConfig): ResourceNaming {
  const pattern = '{APP_NAME}-{ENVIRONMENT}-{RESOURCE_NAME}';
  const fullName = createResourceName(resourceName, config);
  
  return {
    pattern,
    appName: config.appName,
    environment: config.environment,
    resourceName,
    fullName,
  };
}

/**
 * Utility functions for common AWS resource types
 */
export class ResourceNames {
  constructor(private config: EnvironmentConfig) {}
  
  // Lambda function names
  lambda(functionName: string): string {
    return createResourceName(functionName, this.config);
  }
  
  // DynamoDB table names
  dynamoTable(tableName: string): string {
    return createResourceName(tableName, this.config);
  }
  
  // SQS queue names
  sqsQueue(queueName: string): string {
    return createResourceName(queueName, this.config);
  }
  
  // SES template names
  sesTemplate(templateName: string): string {
    return createResourceName(templateName, this.config);
  }
  
  // S3 bucket names (note: S3 buckets have global namespace requirements)
  s3Bucket(bucketName: string): string {
    // For S3, we might need to include region or account for uniqueness
    return createResourceName(bucketName, this.config);
  }
  
  // IAM role names
  iamRole(roleName: string): string {
    return createResourceName(roleName, this.config);
  }
  
  // CloudWatch log group names
  logGroup(logGroupName: string): string {
    return `/aws/lambda/${createResourceName(logGroupName, this.config)}`;
  }
  
  // Stack names
  stack(stackName: string): string {
    return createResourceName(stackName, this.config);
  }
}