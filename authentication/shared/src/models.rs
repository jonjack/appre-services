use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserStatus {
    #[serde(rename = "REGISTRATION_EMAIL_NOT_VERIFIED")]
    RegistrationEmailNotVerified,
    #[serde(rename = "REGISTRATION_NEED_USER_INFO")]
    RegistrationNeedUserInfo,
    #[serde(rename = "REGISTRATION_NEED_STRIPE")]
    RegistrationNeedStripe,
    #[serde(rename = "AWAITING_REVIEW")]
    AwaitingReview,
    #[serde(rename = "ACTIVE")]
    Active,
    #[serde(rename = "REJECTED")]
    Rejected,
}

impl Default for UserStatus {
    fn default() -> Self {
        UserStatus::RegistrationEmailNotVerified
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub user_id: String,
    pub email: String,
    pub status: UserStatus,
    pub full_name: Option<String>,
    pub content_description: Option<String>,
    pub content_link: Option<String>,
    pub stripe_account_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub reviewed_by: Option<String>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OTPRecord {
    pub email: String,
    pub otp_hash: String,
    pub created_at: i64,
    pub expires_at: i64,
    pub ttl: i64,
    pub challenge_id: String,
    pub attempts: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitRecord {
    pub email: String,
    pub request_timestamp: i64,
    pub ttl: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitoEvent {
    pub request: CognitoRequest,
    pub response: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitoRequest {
    #[serde(rename = "userAttributes")]
    pub user_attributes: HashMap<String, String>,
    #[serde(rename = "challengeName")]
    pub challenge_name: Option<String>,
    pub session: Option<Vec<CognitoSession>>,
    #[serde(rename = "privateChallengeParameters")]
    pub private_challenge_parameters: Option<HashMap<String, String>>,
    #[serde(rename = "challengeAnswer")]
    pub challenge_answer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitoSession {
    #[serde(rename = "challengeName")]
    pub challenge_name: String,
    #[serde(rename = "challengeResult")]
    pub challenge_result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChallengeResponse {
    #[serde(rename = "publicChallengeParameters")]
    pub public_challenge_parameters: HashMap<String, String>,
    #[serde(rename = "privateChallengeParameters")]
    pub private_challenge_parameters: HashMap<String, String>,
    #[serde(rename = "challengeMetadata")]
    pub challenge_metadata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyChallengeResponse {
    #[serde(rename = "answerCorrect")]
    pub answer_correct: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefineChallengeResponse {
    #[serde(rename = "challengeName")]
    pub challenge_name: String,
    #[serde(rename = "issueTokens")]
    pub issue_tokens: bool,
    #[serde(rename = "failAuthentication")]
    pub fail_authentication: bool,
}