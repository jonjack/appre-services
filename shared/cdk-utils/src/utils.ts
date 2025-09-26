import { EnvironmentConfig, getEnvironmentConfig } from './config';
import { ResourceNames } from './naming';
import { TagBuilder, ServiceDomain } from './tagging';

/**
 * Comprehensive utility class that combines configuration, naming, and tagging
 * This is the main class that CDK stacks should use
 */
export class AppResourceBuilder {
  public readonly config: EnvironmentConfig;
  public readonly names: ResourceNames;
  public readonly tags: TagBuilder;
  
  constructor(app: any, domain: ServiceDomain, servicePath?: string) {
    this.config = getEnvironmentConfig(app, servicePath);
    this.names = new ResourceNames(this.config);
    this.tags = new TagBuilder(this.config, domain);
  }
  
  /**
   * Get stack name following the naming convention
   */
  getStackName(stackBaseName: string): string {
    return this.names.stack(stackBaseName);
  }
  
  /**
   * Get stack props with environment and base tags
   */
  getStackProps(additionalTags: Record<string, string> = {}) {
    return {
      env: {
        account: this.config.account,
        region: this.config.region,
      },
      tags: this.tags.getBaseTags(additionalTags),
    };
  }
  
  /**
   * Get environment-specific configuration for Lambda functions
   * This provides the ENVIRONMENT variable that Lambda functions need at runtime
   */
  getLambdaEnvironment(additionalEnv: Record<string, string> = {}): Record<string, string> {
    return {
      ENVIRONMENT: this.config.environment,
      AWS_REGION: this.config.region,
      ...additionalEnv,
    };
  }
  
  /**
   * Get build-time configuration that can be embedded in Lambda functions
   * This provides APP_NAME at build time for resource name construction
   */
  getBuildTimeConfig(): { appName: string; environment: string } {
    return {
      appName: this.config.appName,
      environment: this.config.environment,
    };
  }
}