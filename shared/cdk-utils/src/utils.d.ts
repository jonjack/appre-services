import { EnvironmentConfig } from './config';
import { ResourceNames } from './naming';
import { TagBuilder, ServiceDomain } from './tagging';
/**
 * Comprehensive utility class that combines configuration, naming, and tagging
 * This is the main class that CDK stacks should use
 */
export declare class AppResourceBuilder {
    readonly config: EnvironmentConfig;
    readonly names: ResourceNames;
    readonly tags: TagBuilder;
    constructor(app: any, domain: ServiceDomain, servicePath?: string);
    /**
     * Get stack name following the naming convention
     */
    getStackName(stackBaseName: string): string;
    /**
     * Get stack props with environment and base tags
     */
    getStackProps(additionalTags?: Record<string, string>): {
        env: {
            account: string | undefined;
            region: string;
        };
        tags: import("./tagging").GlobalTags;
    };
    /**
     * Get environment-specific configuration for Lambda functions
     * This provides the ENVIRONMENT variable that Lambda functions need at runtime
     */
    getLambdaEnvironment(additionalEnv?: Record<string, string>): Record<string, string>;
    /**
     * Get build-time configuration that can be embedded in Lambda functions
     * This provides APP_NAME at build time for resource name construction
     */
    getBuildTimeConfig(): {
        appName: string;
        environment: string;
    };
}
