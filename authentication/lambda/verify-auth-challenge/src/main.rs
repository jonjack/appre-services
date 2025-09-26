use aws_config::BehaviorVersion;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tracing::{error, info, warn};

use auth_shared::{current_timestamp, verify_otp, AuthError, AuthResult, DynamoDBService};

// Custom structs to handle Cognito's null values properly
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CognitoVerifyAuthChallengeRequest {
    pub user_attributes: HashMap<String, String>,
    pub challenge_answer: Option<String>,
    pub client_metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CognitoVerifyAuthChallengeResponse {
    pub answer_correct: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CognitoVerifyAuthChallengeEvent {
    pub version: String,
    pub region: String,
    pub user_pool_id: String,
    pub user_name: String,
    pub caller_context: HashMap<String, Value>,
    pub trigger_source: String,
    pub request: CognitoVerifyAuthChallengeRequest,
    pub response: CognitoVerifyAuthChallengeResponse,
}

async fn function_handler(
    event: LambdaEvent<CognitoVerifyAuthChallengeEvent>,
) -> Result<CognitoVerifyAuthChallengeEvent, Error> {
    let mut response_event = event.payload;

    info!("Received verify auth challenge event");
    info!("User: {}", response_event.user_name);
    info!("Trigger source: {}", response_event.trigger_source);

    let is_correct = match handle_verify_challenge(&response_event).await {
        Ok(result) => {
            info!("Challenge verification result: {}", result);
            result
        }
        Err(e) => {
            error!("Failed to verify auth challenge: {}", e);
            false
        }
    };

    // Set the response
    response_event.response.answer_correct = Some(is_correct);

    info!(
        "Final response - answer_correct: {:?}",
        response_event.response.answer_correct
    );

    Ok(response_event)
}



async fn handle_verify_challenge(event: &CognitoVerifyAuthChallengeEvent) -> AuthResult<bool> {
    // Extract email from user attributes or client metadata
    let email = if let Some(email) = event.request.user_attributes.get("email") {
        email
    } else if let Some(client_metadata) = &event.request.client_metadata {
        if let Some(email) = client_metadata.get("email") {
            email
        } else {
            return Err(AuthError::ValidationError(
                "Email not found in user attributes or client metadata".to_string(),
            ));
        }
    } else {
        return Err(AuthError::ValidationError(
            "Email not found in user attributes or client metadata".to_string(),
        ));
    };

    let challenge_answer =
        event.request.challenge_answer.as_ref().ok_or_else(|| {
            AuthError::ValidationError("Challenge answer not provided".to_string())
        })?;

    info!("Verifying challenge for email: {}", email);

    // Validate OTP format (should be 6 digits)
    if challenge_answer.len() != 6 || !challenge_answer.chars().all(|c| c.is_ascii_digit()) {
        warn!("Invalid OTP format for email: {}", email);
        return Ok(false);
    }

    // Initialize AWS clients
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);

    // Initialize service using naming utilities
    let dynamodb_service = DynamoDBService::from_env(dynamodb_client)
        .map_err(|e| AuthError::InternalError(format!("Failed to initialize DynamoDBService: {}", e)))?;

    // Retrieve OTP record
    let otp_record = match dynamodb_service.get_otp(email).await? {
        Some(record) => record,
        None => {
            warn!("No OTP record found for email: {}", email);
            return Ok(false);
        }
    };

    // Check if OTP has expired
    let now = current_timestamp();
    if now > otp_record.expires_at {
        warn!("OTP expired for email: {}", email);
        // Clean up expired OTP
        let _ = dynamodb_service.delete_otp(email).await;
        return Ok(false);
    }

    // Verify OTP using constant-time comparison
    if !verify_otp(challenge_answer, &otp_record.otp_hash) {
        warn!("Invalid OTP provided for email: {}", email);

        // TODO: Implement attempt counting and lockout after too many failed attempts
        // For now, we'll just return false
        return Ok(false);
    }

    // OTP is valid - clean up the record
    dynamodb_service.delete_otp(email).await?;

    // Update user status in DynamoDB to need user info (next step after email verification)
    if let Err(e) = dynamodb_service
        .update_user_status_to_need_user_info(email)
        .await
    {
        warn!(
            "Failed to update user status in DynamoDB for {}: {}",
            email, e
        );
        // Don't fail the authentication - the OTP was valid
    }

    // User should already be confirmed by create-auth-challenge
    // Now set email_verified=true since they proved email ownership with OTP
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let cognito_client = aws_sdk_cognitoidentityprovider::Client::new(&config);
    
    info!("Setting email_verified=true for user: {} after OTP verification", email);
    match cognito_client
        .admin_update_user_attributes()
        .user_pool_id(&event.user_pool_id)
        .username(email)
        .user_attributes(
            aws_sdk_cognitoidentityprovider::types::AttributeType::builder()
                .name("email_verified")
                .value("true")
                .build()
                .map_err(|e| {
                    AuthError::InternalError(format!("Failed to build attribute: {}", e))
                })?,
        )
        .send()
        .await
    {
        Ok(_) => {
            info!("Successfully set email_verified=true for user: {}", email);
        }
        Err(e) => {
            error!("Failed to set email_verified for user {}: {:?}", email, e);
            // Don't fail the authentication - the OTP was valid
            warn!("Continuing with authentication despite email_verified update failure");
        }
    }

    info!("OTP verification successful for email: {}", email);
    Ok(true)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    info!("Starting verify-auth-challenge Lambda function");

    run(service_fn(function_handler)).await
}
