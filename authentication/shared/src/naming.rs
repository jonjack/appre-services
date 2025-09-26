use crate::AuthError;

/// Configuration for resource naming at runtime
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub app_name: String,
    pub environment: String,
}

impl RuntimeConfig {
    /// Create runtime config from environment variables
    /// Both APP_NAME and ENVIRONMENT come from Lambda environment variables set by CDK
    pub fn from_env() -> Result<Self, AuthError> {
        // APP_NAME comes from Lambda environment variable set by CDK
        let app_name = std::env::var("APP_NAME")
            .map_err(|_| AuthError::InternalError("APP_NAME not set".to_string()))?;
        
        // ENVIRONMENT comes from Lambda environment variable set by CDK
        let environment = std::env::var("ENVIRONMENT")
            .map_err(|_| AuthError::InternalError("ENVIRONMENT not set".to_string()))?;
        
        Ok(Self {
            app_name,
            environment,
        })
    }
    
    /// Create a resource name following the {APP_NAME}-{ENVIRONMENT}-{RESOURCE_NAME} pattern
    pub fn resource_name(&self, resource_name: &str) -> String {
        format!("{}-{}-{}", self.app_name, self.environment, resource_name)
    }
    
    /// Get DynamoDB table name
    pub fn dynamo_table(&self, table_name: &str) -> String {
        self.resource_name(table_name)
    }
    
    /// Get Lambda function name
    pub fn lambda_function(&self, function_name: &str) -> String {
        self.resource_name(function_name)
    }
    
    /// Get SQS queue name
    pub fn sqs_queue(&self, queue_name: &str) -> String {
        self.resource_name(queue_name)
    }
    
    /// Get SES template name
    pub fn ses_template(&self, template_name: &str) -> String {
        self.resource_name(template_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_resource_naming() {
        let config = RuntimeConfig {
            app_name: "appre".to_string(),
            environment: "test".to_string(),
        };
        
        assert_eq!(config.resource_name("users"), "appre-test-users");
        assert_eq!(config.dynamo_table("auth-otps"), "appre-test-auth-otps");
        assert_eq!(config.lambda_function("email-processor"), "appre-test-email-processor");
        assert_eq!(config.sqs_queue("email-queue"), "appre-test-email-queue");
        assert_eq!(config.ses_template("otp"), "appre-test-otp");
    }
}