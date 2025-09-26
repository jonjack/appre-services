use thiserror::Error;

#[derive(Error, Debug)]
pub enum NotificationError {
    #[error("Email delivery failed: {0}")]
    EmailDeliveryFailed(String),
    
    #[error("Invalid template: {0}")]
    InvalidTemplate(String),
    
    #[error("Invalid recipient: {0}")]
    InvalidRecipient(String),
    
    #[error("SQS error: {0}")]
    SQSError(String),
    
    #[error("SES error: {0}")]
    SESError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<aws_sdk_sqs::Error> for NotificationError {
    fn from(err: aws_sdk_sqs::Error) -> Self {
        NotificationError::SQSError(err.to_string())
    }
}

impl From<aws_sdk_ses::Error> for NotificationError {
    fn from(err: aws_sdk_ses::Error) -> Self {
        NotificationError::SESError(err.to_string())
    }
}

impl From<serde_json::Error> for NotificationError {
    fn from(err: serde_json::Error) -> Self {
        NotificationError::SerializationError(err.to_string())
    }
}

pub type NotificationResult<T> = Result<T, NotificationError>;