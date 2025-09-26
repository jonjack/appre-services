import { createResourceName, createResourceNaming, ResourceNames } from './naming';
import { EnvironmentConfig } from './config';

describe('Naming utilities', () => {
  const mockConfig: EnvironmentConfig = {
    appName: 'appre',
    environment: 'test',
    region: 'us-east-1',
    account: '123456789012',
  };
  
  describe('createResourceName', () => {
    it('should create resource name with correct pattern', () => {
      const name = createResourceName('email-processor', mockConfig);
      expect(name).toBe('appre-test-email-processor');
    });
  });
  
  describe('createResourceNaming', () => {
    it('should create detailed resource naming object', () => {
      const naming = createResourceNaming('email-processor', mockConfig);
      
      expect(naming).toEqual({
        pattern: '{APP_NAME}-{ENVIRONMENT}-{RESOURCE_NAME}',
        appName: 'appre',
        environment: 'test',
        resourceName: 'email-processor',
        fullName: 'appre-test-email-processor',
      });
    });
  });
  
  describe('ResourceNames', () => {
    let resourceNames: ResourceNames;
    
    beforeEach(() => {
      resourceNames = new ResourceNames(mockConfig);
    });
    
    it('should create Lambda function names', () => {
      expect(resourceNames.lambda('email-processor')).toBe('appre-test-email-processor');
    });
    
    it('should create DynamoDB table names', () => {
      expect(resourceNames.dynamoTable('users')).toBe('appre-test-users');
    });
    
    it('should create SQS queue names', () => {
      expect(resourceNames.sqsQueue('email-queue')).toBe('appre-test-email-queue');
    });
    
    it('should create SES template names', () => {
      expect(resourceNames.sesTemplate('otp')).toBe('appre-test-otp');
    });
    
    it('should create IAM role names', () => {
      expect(resourceNames.iamRole('lambda-role')).toBe('appre-test-lambda-role');
    });
    
    it('should create CloudWatch log group names', () => {
      expect(resourceNames.logGroup('email-processor')).toBe('/aws/lambda/appre-test-email-processor');
    });
    
    it('should create stack names', () => {
      expect(resourceNames.stack('authentication')).toBe('appre-test-authentication');
    });
  });
});