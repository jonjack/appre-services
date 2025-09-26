pub mod dynamodb_service;
pub mod ses_service;
pub mod rate_limit_service;

pub use dynamodb_service::*;
pub use ses_service::*;
pub use rate_limit_service::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_initialization_with_hardcoded_names() {
        // Create mock AWS clients (these won't actually connect to AWS)
        let config = aws_sdk_dynamodb::Config::builder()
            .behavior_version(aws_sdk_dynamodb::config::BehaviorVersion::latest())
            .region(aws_sdk_dynamodb::config::Region::new("us-east-1"))
            .credentials_provider(aws_sdk_dynamodb::config::SharedCredentialsProvider::new(
                aws_sdk_dynamodb::config::Credentials::new("test", "test", None, None, "test")
            ))
            .build();
        let dynamodb_client = aws_sdk_dynamodb::Client::from_conf(config);
        
        // Test direct service initialization with hardcoded table names
        let environment = "test";
        let otp_table = format!("appre-auth-otps-{}", environment);
        let users_table = format!("appre-users-{}", environment);
        let rate_limit_table = format!("appre-rate-limits-{}", environment);
        
        // Test that table names are generated correctly
        assert_eq!(otp_table, "appre-auth-otps-test");
        assert_eq!(users_table, "appre-users-test");
        assert_eq!(rate_limit_table, "appre-rate-limits-test");
        
        // Test service initialization with explicit table names
        let _dynamodb_service = DynamoDBService::new(dynamodb_client.clone(), otp_table, users_table);
        let _rate_limit_service = RateLimitService::new(dynamodb_client, rate_limit_table);
        
        // Services should be created successfully (we can't test much more without actual AWS resources)
        // The fact that they compile and create without panicking is the main test
        assert!(true, "Services initialized successfully with hardcoded names");
    }
}