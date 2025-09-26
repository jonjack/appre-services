import { createGlobalTags, TagBuilder, SERVICE_DOMAINS } from './tagging';
import { EnvironmentConfig } from './config';

describe('Tagging utilities', () => {
  const mockConfig: EnvironmentConfig = {
    appName: 'appre',
    environment: 'test',
    region: 'us-east-1',
    account: '123456789012',
  };
  
  describe('createGlobalTags', () => {
    it('should create global tags with required fields', () => {
      const tags = createGlobalTags(mockConfig, 'auth');
      
      expect(tags).toEqual({
        Application: 'appre',
        Environment: 'test',
        Domain: 'auth',
        ManagedBy: 'cdk',
      });
    });
    
    it('should include additional tags', () => {
      const tags = createGlobalTags(mockConfig, 'auth', { Component: 'lambda' });
      
      expect(tags).toEqual({
        Application: 'appre',
        Environment: 'test',
        Domain: 'auth',
        ManagedBy: 'cdk',
        Component: 'lambda',
      });
    });
  });
  
  describe('TagBuilder', () => {
    let tagBuilder: TagBuilder;
    
    beforeEach(() => {
      tagBuilder = new TagBuilder(mockConfig, SERVICE_DOMAINS.AUTHENTICATION);
    });
    
    it('should create base tags', () => {
      const tags = tagBuilder.getBaseTags();
      
      expect(tags).toEqual({
        Application: 'appre',
        Environment: 'test',
        Domain: 'auth',
        ManagedBy: 'cdk',
      });
    });
    
    it('should create component tags', () => {
      const tags = tagBuilder.getComponentTags('lambda');
      
      expect(tags).toEqual({
        Application: 'appre',
        Environment: 'test',
        Domain: 'auth',
        ManagedBy: 'cdk',
        Component: 'lambda',
      });
    });
    
    it('should create Lambda-specific tags', () => {
      const tags = tagBuilder.getLambdaTags('email-processor');
      
      expect(tags).toEqual({
        Application: 'appre',
        Environment: 'test',
        Domain: 'auth',
        ManagedBy: 'cdk',
        Component: 'lambda',
        Function: 'email-processor',
      });
    });
    
    it('should create DynamoDB-specific tags', () => {
      const tags = tagBuilder.getDynamoTags('users');
      
      expect(tags).toEqual({
        Application: 'appre',
        Environment: 'test',
        Domain: 'auth',
        ManagedBy: 'cdk',
        Component: 'dynamodb',
        Table: 'users',
      });
    });
  });
});