use aws_sdk_dynamodb::{Client as DynamoClient, types::AttributeValue};
use std::collections::HashMap;
use crate::{AuthError, AuthResult, RateLimitRecord, current_timestamp};

pub struct RateLimitService {
    client: DynamoClient,
    table_name: String,
}

impl RateLimitService {
    pub fn new(client: DynamoClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    /// Create RateLimitService using CDK-provided table name from environment variable
    pub fn from_env(client: DynamoClient) -> Result<Self, AuthError> {
        // Use exact table name provided by CDK
        let table_name = std::env::var("RATE_LIMIT_TABLE_NAME")
            .map_err(|e| {
                tracing::error!("RATE_LIMIT_TABLE_NAME environment variable not set: {:?}", e);
                AuthError::InternalError("RATE_LIMIT_TABLE_NAME not set".to_string())
            })?;
        
        tracing::info!("RateLimitService initialized with table: {}", table_name);
        Ok(Self::new(client, table_name))
    }

    /// Check if email is rate limited (max 3 requests per 15 minutes)
    pub async fn check_rate_limit(&self, email: &str) -> AuthResult<bool> {
        let now = current_timestamp();
        let fifteen_minutes_ago = now - (15 * 60); // 15 minutes in seconds

        tracing::info!("Checking rate limit for email: {} using table: {}", email, self.table_name);

        // Query recent requests for this email
        let result = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("email = :email AND request_timestamp > :timestamp")
            .expression_attribute_values(":email", AttributeValue::S(email.to_string()))
            .expression_attribute_values(":timestamp", AttributeValue::N(fifteen_minutes_ago.to_string()))
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Rate limit query failed: {}", e);
                AuthError::DynamoDBError(format!("Rate limit query failed: {}", e))
            })?;

        let request_count = result.items.as_ref().map(|items| items.len()).unwrap_or(0);
        
        if request_count >= 3 {
            tracing::warn!("Rate limit exceeded for email: {}", email);
            return Ok(false); // Rate limited
        }

        Ok(true) // Not rate limited
    }

    /// Record a new OTP request for rate limiting
    pub async fn record_request(&self, email: &str) -> AuthResult<()> {
        let now = current_timestamp();
        let ttl = now + (15 * 60); // TTL 15 minutes from now

        let record = RateLimitRecord {
            email: email.to_string(),
            request_timestamp: now,
            ttl,
        };

        let mut item = HashMap::new();
        item.insert("email".to_string(), AttributeValue::S(record.email));
        item.insert("request_timestamp".to_string(), AttributeValue::N(record.request_timestamp.to_string()));
        item.insert("ttl".to_string(), AttributeValue::N(record.ttl.to_string()));

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        tracing::info!("Recorded OTP request for email: {}", email);
        Ok(())
    }

    /// Get remaining time until rate limit resets (in seconds)
    pub async fn get_rate_limit_reset_time(&self, email: &str) -> AuthResult<Option<i64>> {
        let now = current_timestamp();
        let fifteen_minutes_ago = now - (15 * 60);

        let result = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("email = :email AND request_timestamp > :timestamp")
            .expression_attribute_values(":email", AttributeValue::S(email.to_string()))
            .expression_attribute_values(":timestamp", AttributeValue::N(fifteen_minutes_ago.to_string()))
            .scan_index_forward(false) // Get most recent first
            .limit(1)
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        if let Some(items) = result.items {
            if let Some(item) = items.first() {
                if let Some(timestamp_attr) = item.get("request_timestamp") {
                    if let Ok(timestamp_str) = timestamp_attr.as_n() {
                        if let Ok(timestamp) = timestamp_str.parse::<i64>() {
                            let reset_time = timestamp + (15 * 60) - now;
                            return Ok(Some(reset_time.max(0)));
                        }
                    }
                }
            }
        }

        Ok(None)
    }
}