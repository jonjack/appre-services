import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

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
export const VALID_ENVIRONMENTS = ['dev', 'test', 'prod'] as const;
export type Environment = typeof VALID_ENVIRONMENTS[number];

/**
 * Load environment configuration from .env files
 * Looks for .env files in the following order:
 * 1. Service-specific .env file (e.g., appre-services/authentication/.env)
 * 2. Root services .env file (appre-services/.env)
 * 3. Environment variables
 */
export function loadEnvironmentConfig(servicePath?: string, skipDotEnv = false): EnvironmentConfig {
  // Load environment variables from .env files (unless skipped for testing)
  if (!skipDotEnv) {
    const envPaths = [];
    
    // Add service-specific .env if servicePath is provided
    if (servicePath) {
      const serviceEnvPath = path.join(servicePath, '.env');
      if (fs.existsSync(serviceEnvPath)) {
        envPaths.push(serviceEnvPath);
      }
    }
    
    // Add root services .env
    const rootEnvPath = path.join(process.cwd(), '../../.env');
    if (fs.existsSync(rootEnvPath)) {
      envPaths.push(rootEnvPath);
    }
    
    // Alternative root path for when running from service directory
    const altRootEnvPath = path.join(process.cwd(), '../../../appre-services/.env');
    if (fs.existsSync(altRootEnvPath)) {
      envPaths.push(altRootEnvPath);
    }
    
    // Load all found .env files (later files override earlier ones)
    envPaths.forEach(envPath => {
      dotenv.config({ path: envPath });
    });
  }
  
  // Extract required configuration
  const appName = process.env.APP_NAME;
  const environment = process.env.ENVIRONMENT;
  const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION;
  const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
  
  // Validate required fields
  if (!appName) {
    throw new Error('APP_NAME environment variable is required');
  }
  
  if (!environment) {
    throw new Error('ENVIRONMENT environment variable is required');
  }
  
  if (!region) {
    throw new Error('AWS_REGION or CDK_DEFAULT_REGION environment variable is required');
  }
  
  // Validate environment value
  if (!VALID_ENVIRONMENTS.includes(environment as Environment)) {
    throw new Error(`ENVIRONMENT must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
  }
  
  return {
    appName,
    environment,
    region,
    account,
  };
}

/**
 * Get environment configuration with CDK context override support
 */
export function getEnvironmentConfig(app: any, servicePath?: string): EnvironmentConfig {
  // Load base configuration from .env files
  const baseConfig = loadEnvironmentConfig(servicePath);
  
  // Allow CDK context to override values
  const environment = app.node.tryGetContext('environment') || baseConfig.environment;
  const account = app.node.tryGetContext('account') || baseConfig.account;
  const region = app.node.tryGetContext('region') || baseConfig.region;
  
  // Validate environment if overridden
  if (!VALID_ENVIRONMENTS.includes(environment as Environment)) {
    throw new Error(`ENVIRONMENT must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
  }
  
  return {
    ...baseConfig,
    environment,
    account,
    region,
  };
}