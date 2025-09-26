import { loadEnvironmentConfig, getEnvironmentConfig, VALID_ENVIRONMENTS } from './config';

describe('Configuration utilities', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    // Clear all environment variables for clean test state
    process.env = {};
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  describe('loadEnvironmentConfig', () => {
    it('should load configuration from environment variables', () => {
      process.env.APP_NAME = 'test-app';
      process.env.ENVIRONMENT = 'test';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCOUNT_ID = '123456789012';
      
      const config = loadEnvironmentConfig(undefined, true);
      
      expect(config).toEqual({
        appName: 'test-app',
        environment: 'test',
        region: 'us-east-1',
        account: '123456789012',
      });
    });
    
    it('should throw error when APP_NAME is missing', () => {
      process.env.ENVIRONMENT = 'test';
      process.env.AWS_REGION = 'us-east-1';
      
      expect(() => loadEnvironmentConfig(undefined, true)).toThrow('APP_NAME environment variable is required');
    });
    
    it('should throw error when ENVIRONMENT is missing', () => {
      process.env.APP_NAME = 'test-app';
      process.env.AWS_REGION = 'us-east-1';
      
      expect(() => loadEnvironmentConfig(undefined, true)).toThrow('ENVIRONMENT environment variable is required');
    });
    
    it('should throw error when AWS_REGION is missing', () => {
      process.env.APP_NAME = 'test-app';
      process.env.ENVIRONMENT = 'test';
      
      expect(() => loadEnvironmentConfig(undefined, true)).toThrow('AWS_REGION or CDK_DEFAULT_REGION environment variable is required');
    });
    
    it('should throw error for invalid environment', () => {
      process.env.APP_NAME = 'test-app';
      process.env.ENVIRONMENT = 'invalid';
      process.env.AWS_REGION = 'us-east-1';
      
      expect(() => loadEnvironmentConfig(undefined, true)).toThrow(`ENVIRONMENT must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
    });
    
    it('should accept CDK_DEFAULT_REGION as fallback', () => {
      process.env.APP_NAME = 'test-app';
      process.env.ENVIRONMENT = 'test';
      process.env.CDK_DEFAULT_REGION = 'eu-west-1';
      
      const config = loadEnvironmentConfig(undefined, true);
      expect(config.region).toBe('eu-west-1');
    });
  });
  
  describe('getEnvironmentConfig', () => {
    it('should allow CDK context to override environment variables', () => {
      process.env.APP_NAME = 'test-app';
      process.env.ENVIRONMENT = 'test';
      process.env.AWS_REGION = 'us-east-1';
      
      const mockApp = {
        node: {
          tryGetContext: jest.fn((key: string) => {
            if (key === 'environment') return 'prod';
            if (key === 'region') return 'eu-west-1';
            return undefined;
          }),
        },
      };
      
      const config = getEnvironmentConfig(mockApp);
      
      expect(config.environment).toBe('prod');
      expect(config.region).toBe('eu-west-1');
    });
  });
});