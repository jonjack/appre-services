/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
    appName: string;
    environment: string;
    region: string;
    account?: string;
}
/**
 * Valid environment values
 */
export declare const VALID_ENVIRONMENTS: readonly ["dev", "test", "prod"];
export type Environment = typeof VALID_ENVIRONMENTS[number];
/**
 * Load environment configuration from .env files
 * Looks for .env files in the following order:
 * 1. Service-specific .env file (e.g., appre-services/authentication/.env)
 * 2. Root services .env file (appre-services/.env)
 * 3. Environment variables
 */
export declare function loadEnvironmentConfig(servicePath?: string, skipDotEnv?: boolean): EnvironmentConfig;
/**
 * Get environment configuration with CDK context override support
 */
export declare function getEnvironmentConfig(app: any, servicePath?: string): EnvironmentConfig;
