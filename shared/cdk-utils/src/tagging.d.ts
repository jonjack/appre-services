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
export declare function createGlobalTags(config: EnvironmentConfig, domain: string, additionalTags?: Record<string, string>): GlobalTags;
/**
 * Service domain constants
 */
export declare const SERVICE_DOMAINS: {
    readonly AUTHENTICATION: "auth";
    readonly NOTIFICATIONS: "notifications";
    readonly USER_MANAGEMENT: "user-management";
    readonly PAYMENTS: "payments";
    readonly SHARED: "shared";
};
export type ServiceDomain = typeof SERVICE_DOMAINS[keyof typeof SERVICE_DOMAINS];
/**
 * Utility class for creating consistent tags across services
 */
export declare class TagBuilder {
    readonly config: EnvironmentConfig;
    private domain;
    constructor(config: EnvironmentConfig, domain: ServiceDomain);
    /**
     * Get base tags for this service
     */
    getBaseTags(additionalTags?: Record<string, string>): GlobalTags;
    /**
     * Get tags for a specific component within the service
     */
    getComponentTags(component: string, additionalTags?: Record<string, string>): GlobalTags;
    /**
     * Get tags for Lambda functions
     */
    getLambdaTags(functionName: string, additionalTags?: Record<string, string>): GlobalTags;
    /**
     * Get tags for DynamoDB tables
     */
    getDynamoTags(tableName: string, additionalTags?: Record<string, string>): GlobalTags;
    /**
     * Get tags for SQS queues
     */
    getSqsTags(queueName: string, additionalTags?: Record<string, string>): GlobalTags;
    /**
     * Get tags for SES templates
     */
    getSesTags(templateName: string, additionalTags?: Record<string, string>): GlobalTags;
    /**
     * Get tags for IAM roles
     */
    getIamTags(roleName: string, additionalTags?: Record<string, string>): GlobalTags;
}
