use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
    
    #[error("Invalid OTP: {0}")]
    InvalidOTP(String),
    
    #[error("OTP expired")]
    OTPExpired,
    
    #[error("User not found: {0}")]
    UserNotFound(String),
    
    #[error("Email delivery failed: {0}")]
    EmailDeliveryFailed(String),
    
    #[error("DynamoDB error: {0}")]
    DynamoDBError(String),
    
    #[error("SES error: {0}")]
    SESError(String),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<aws_sdk_dynamodb::Error> for AuthError {
    fn from(err: aws_sdk_dynamodb::Error) -> Self {
        AuthError::DynamoDBError(err.to_string())
    }
}

impl From<aws_sdk_ses::Error> for AuthError {
    fn from(err: aws_sdk_ses::Error) -> Self {
        AuthError::SESError(err.to_string())
    }
}

pub type AuthResult<T> = Result<T, AuthError>;