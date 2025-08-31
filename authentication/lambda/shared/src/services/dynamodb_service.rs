use aws_sdk_dynamodb::{Client as DynamoClient, types::AttributeValue};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

use crate::{AuthError, AuthResult, OTPRecord, UserProfile, UserStatus};

pub struct DynamoDBService {
    client: DynamoClient,
    otp_table: String,
    users_table: String,
}

impl DynamoDBService {
    pub fn new(client: DynamoClient, otp_table: String, users_table: String) -> Self {
        Self {
            client,
            otp_table,
            users_table,
        }
    }

    /// Store OTP record in DynamoDB
    pub async fn store_otp(&self, record: &OTPRecord) -> AuthResult<()> {
        let mut item = HashMap::new();
        item.insert("email".to_string(), AttributeValue::S(record.email.clone()));
        item.insert("otp_hash".to_string(), AttributeValue::S(record.otp_hash.clone()));
        item.insert("created_at".to_string(), AttributeValue::N(record.created_at.to_string()));
        item.insert("expires_at".to_string(), AttributeValue::N(record.expires_at.to_string()));
        item.insert("ttl".to_string(), AttributeValue::N(record.ttl.to_string()));
        item.insert("challenge_id".to_string(), AttributeValue::S(record.challenge_id.clone()));
        item.insert("attempts".to_string(), AttributeValue::N(record.attempts.to_string()));

        self.client
            .put_item()
            .table_name(&self.otp_table)
            .set_item(Some(item))
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        Ok(())
    }

    /// Retrieve OTP record by email
    pub async fn get_otp(&self, email: &str) -> AuthResult<Option<OTPRecord>> {
        let result = self.client
            .get_item()
            .table_name(&self.otp_table)
            .key("email", AttributeValue::S(email.to_string()))
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        if let Some(item) = result.item {
            let record = OTPRecord {
                email: item.get("email")
                    .and_then(|v| v.as_s().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing email".to_string()))?
                    .clone(),
                otp_hash: item.get("otp_hash")
                    .and_then(|v| v.as_s().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing otp_hash".to_string()))?
                    .clone(),
                created_at: item.get("created_at")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing created_at".to_string()))?,
                expires_at: item.get("expires_at")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing expires_at".to_string()))?,
                ttl: item.get("ttl")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing ttl".to_string()))?,
                challenge_id: item.get("challenge_id")
                    .and_then(|v| v.as_s().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing challenge_id".to_string()))?
                    .clone(),
                attempts: item.get("attempts")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .ok_or_else(|| AuthError::InternalError("Missing attempts".to_string()))?,
            };
            Ok(Some(record))
        } else {
            Ok(None)
        }
    }

    /// Delete OTP record after successful verification
    pub async fn delete_otp(&self, email: &str) -> AuthResult<()> {
        self.client
            .delete_item()
            .table_name(&self.otp_table)
            .key("email", AttributeValue::S(email.to_string()))
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        Ok(())
    }

    /// Get user by email using GSI
    pub async fn get_user_by_email(&self, email: &str) -> AuthResult<Option<UserProfile>> {
        let result = self.client
            .query()
            .table_name(&self.users_table)
            .index_name("email-index")
            .key_condition_expression("email = :email")
            .expression_attribute_values(":email", AttributeValue::S(email.to_string()))
            .limit(1)
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        if let Some(items) = result.items {
            if let Some(item) = items.first() {
                let user = self.parse_user_from_item(item)?;
                return Ok(Some(user));
            }
        }

        Ok(None)
    }

    /// Create new user
    pub async fn create_user(&self, email: &str) -> AuthResult<UserProfile> {
        let user_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        let user = UserProfile {
            user_id: user_id.clone(),
            email: email.to_string(),
            status: UserStatus::default(), // Uses RegistrationEmailNotVerified
            full_name: None,
            content_description: None,
            content_link: None,
            stripe_account_id: None,
            created_at: now,
            updated_at: now,
            reviewed_by: None,
            reviewed_at: None,
            rejection_reason: None,
        };

        let mut item = HashMap::new();
        item.insert("user_id".to_string(), AttributeValue::S(user.user_id.clone()));
        item.insert("email".to_string(), AttributeValue::S(user.email.clone()));
        item.insert("status".to_string(), AttributeValue::S("REGISTRATION_EMAIL_NOT_VERIFIED".to_string()));
        item.insert("created_at".to_string(), AttributeValue::S(user.created_at.to_rfc3339()));
        item.insert("updated_at".to_string(), AttributeValue::S(user.updated_at.to_rfc3339()));

        self.client
            .put_item()
            .table_name(&self.users_table)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(user_id)")
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        Ok(user)
    }

    /// Update user status after email verification to need user info
    pub async fn update_user_status_to_need_user_info(&self, email: &str) -> AuthResult<()> {
        // First, get the user to find their user_id
        let user = self.get_user_by_email(email).await?
            .ok_or_else(|| AuthError::ValidationError("User not found".to_string()))?;
        
        let now = Utc::now();
        
        self.client
            .update_item()
            .table_name(&self.users_table)
            .key("user_id", AttributeValue::S(user.user_id))
            .update_expression("SET #status = :status, updated_at = :updated_at")
            .expression_attribute_names("#status", "status")
            .expression_attribute_values(":status", AttributeValue::S("REGISTRATION_NEED_USER_INFO".to_string()))
            .expression_attribute_values(":updated_at", AttributeValue::S(now.to_rfc3339()))
            .condition_expression("attribute_exists(user_id)")
            .send()
            .await
            .map_err(|e| AuthError::DynamoDBError(e.to_string()))?;

        Ok(())
    }

    fn parse_user_from_item(&self, item: &HashMap<String, AttributeValue>) -> AuthResult<UserProfile> {
        let status_str = item.get("status")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| AuthError::InternalError("Missing status".to_string()))?;

        let status = match status_str.as_str() {
            "REGISTRATION_EMAIL_NOT_VERIFIED" => UserStatus::RegistrationEmailNotVerified,
            "REGISTRATION_NEED_USER_INFO" => UserStatus::RegistrationNeedUserInfo,
            "REGISTRATION_NEED_STRIPE" => UserStatus::RegistrationNeedStripe,
            "AWAITING_REVIEW" => UserStatus::AwaitingReview,
            "ACTIVE" => UserStatus::Active,
            "REJECTED" => UserStatus::Rejected,
            _ => return Err(AuthError::InternalError("Invalid status".to_string())),
        };

        let created_at = item.get("created_at")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .ok_or_else(|| AuthError::InternalError("Missing created_at".to_string()))?;

        let updated_at = item.get("updated_at")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .ok_or_else(|| AuthError::InternalError("Missing updated_at".to_string()))?;

        Ok(UserProfile {
            user_id: item.get("user_id")
                .and_then(|v| v.as_s().ok())
                .ok_or_else(|| AuthError::InternalError("Missing user_id".to_string()))?
                .clone(),
            email: item.get("email")
                .and_then(|v| v.as_s().ok())
                .ok_or_else(|| AuthError::InternalError("Missing email".to_string()))?
                .clone(),
            status,
            full_name: item.get("full_name").and_then(|v| v.as_s().ok()).cloned(),
            content_description: item.get("content_description").and_then(|v| v.as_s().ok()).cloned(),
            content_link: item.get("content_link").and_then(|v| v.as_s().ok()).cloned(),
            stripe_account_id: item.get("stripe_account_id").and_then(|v| v.as_s().ok()).cloned(),
            created_at,
            updated_at,
            reviewed_by: item.get("reviewed_by").and_then(|v| v.as_s().ok()).cloned(),
            reviewed_at: item.get("reviewed_at")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            rejection_reason: item.get("rejection_reason").and_then(|v| v.as_s().ok()).cloned(),
        })
    }
}