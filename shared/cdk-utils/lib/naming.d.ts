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
export declare function createResourceName(resourceName: string, config: EnvironmentConfig): string;
/**
 * Create a detailed resource naming object
 */
export declare function createResourceNaming(resourceName: string, config: EnvironmentConfig): ResourceNaming;
/**
 * Utility functions for common AWS resource types
 */
export declare class ResourceNames {
    private config;
    constructor(config: EnvironmentConfig);
    lambda(functionName: string): string;
    dynamoTable(tableName: string): string;
    sqsQueue(queueName: string): string;
    sesTemplate(templateName: string): string;
    s3Bucket(bucketName: string): string;
    iamRole(roleName: string): string;
    logGroup(logGroupName: string): string;
    stack(stackName: string): string;
}
