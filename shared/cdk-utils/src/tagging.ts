import { EnvironmentConfig } from './config';

/**
 * Global tags interface
 */
export interface GlobalTags {
  Application: string;
  Environment: string;
  Domain: string;
  ManagedBy: 'cdk';
  [key: string]: string;
}

/**
 * Create global tags for AWS resources
 */
export function createGlobalTags(
  config: EnvironmentConfig,
  domain: string,
  additionalTags: Record<string, string> = {}
): GlobalTags {
  return {
    Application: config.appName,
    Environment: config.environment,
    Domain: domain,
    ManagedBy: 'cdk',
    ...additionalTags,
  };
}

/**
 * Service domain constants
 */
export const SERVICE_DOMAINS = {
  AUTHENTICATION: 'auth',
  NOTIFICATIONS: 'notifications',
  USER_MANAGEMENT: 'user-management',
  PAYMENTS: 'payments',
  SHARED: 'shared',
} as const;

export type ServiceDomain = typeof SERVICE_DOMAINS[keyof typeof SERVICE_DOMAINS];

/**
 * Utility class for creating consistent tags across services
 */
export class TagBuilder {
  constructor(public readonly config: EnvironmentConfig, private domain: ServiceDomain) {}
  
  /**
   * Get base tags for this service
   */
  getBaseTags(additionalTags: Record<string, string> = {}): GlobalTags {
    return createGlobalTags(this.config, this.domain, additionalTags);
  }
  
  /**
   * Get tags for a specific component within the service
   */
  getComponentTags(component: string, additionalTags: Record<string, string> = {}): GlobalTags {
    return createGlobalTags(this.config, this.domain, {
      Component: component,
      ...additionalTags,
    });
  }
  
  /**
   * Get tags for Lambda functions
   */
  getLambdaTags(functionName: string, additionalTags: Record<string, string> = {}): GlobalTags {
    return this.getComponentTags('lambda', {
      Function: functionName,
      ...additionalTags,
    });
  }
  
  /**
   * Get tags for DynamoDB tables
   */
  getDynamoTags(tableName: string, additionalTags: Record<string, string> = {}): GlobalTags {
    return this.getComponentTags('dynamodb', {
      Table: tableName,
      ...additionalTags,
    });
  }
  
  /**
   * Get tags for SQS queues
   */
  getSqsTags(queueName: string, additionalTags: Record<string, string> = {}): GlobalTags {
    return this.getComponentTags('sqs', {
      Queue: queueName,
      ...additionalTags,
    });
  }
  
  /**
   * Get tags for SES templates
   */
  getSesTags(templateName: string, additionalTags: Record<string, string> = {}): GlobalTags {
    return this.getComponentTags('ses', {
      Template: templateName,
      ...additionalTags,
    });
  }
  
  /**
   * Get tags for IAM roles
   */
  getIamTags(roleName: string, additionalTags: Record<string, string> = {}): GlobalTags {
    return this.getComponentTags('iam', {
      Role: roleName,
      ...additionalTags,
    });
  }
}