use aws_config::BehaviorVersion;
use aws_lambda_events::event::cognito::CognitoEventUserPoolsCreateAuthChallenge;
use aws_sdk_cognitoidentityprovider::Client as CognitoClient;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use std::collections::HashMap;
use tracing::{error, info, warn};

use auth_shared::{
    current_timestamp, generate_challenge_id, generate_otp, hash_otp, is_valid_email, AuthError,
    AuthResult, DynamoDBService, OTPRecord, RateLimitService, SESService,
};

async fn confirm_user_in_cognito(
    email: &str,
    user_pool_id: &str,
    config: &aws_config::SdkConfig,
) -> AuthResult<()> {
    let cognito_client = CognitoClient::new(config);

    info!("Confirming user: {} in pool: {}", email, user_pool_id);

    // Confirm the user (this changes their status from UNCONFIRMED to CONFIRMED)
    match cognito_client
        .admin_confirm_sign_up()
        .user_pool_id(user_pool_id)
        .username(email)
        .send()
        .await
    {
        Ok(_) => {
            info!("Successfully confirmed user: {}", email);
        }
        Err(e) => {
            let error_string = format!("{:?}", e);
            if error_string.contains("NotAuthorizedException") {
                info!("User {} may already be confirmed", email);
            } else {
                return Err(AuthError::InternalError(format!(
                    "Failed to confirm user: {:?}",
                    e
                )));
            }
        }
    }

    // DO NOT set email_verified=true here - only after OTP verification
    info!("User confirmed but email_verified will be set only after OTP verification");
    Ok(())
}

async fn function_handler(
    event: LambdaEvent<CognitoEventUserPoolsCreateAuthChallenge>,
) -> Result<CognitoEventUserPoolsCreateAuthChallenge, Error> {
    let mut response_event = event.payload;

    match handle_create_challenge(&mut response_event).await {
        Ok(_) => {
            info!("Successfully created auth challenge");
            Ok(response_event)
        }
        Err(e) => {
            error!("Failed to create auth challenge: {}", e);
            // Don't fail the Lambda - return empty challenge to let Cognito handle gracefully
            response_event.response.public_challenge_parameters = HashMap::<String, String>::new();
            response_event.response.private_challenge_parameters = HashMap::<String, String>::new();
            response_event.response.challenge_metadata = Some("ERROR".to_string());
            Ok(response_event)
        }
    }
}

async fn handle_create_challenge(
    event: &mut CognitoEventUserPoolsCreateAuthChallenge,
) -> AuthResult<()> {
    // Debug: Log the entire event structure
    info!("  - User attributes: {:?}", event.request.user_attributes);

    // Extract email from user attributes or client metadata
    let email = if let Some(email) = event.request.user_attributes.get("email") {
        email
    } else if let Some(email) = event.request.client_metadata.get("email") {
        email
    } else {
        return Err(AuthError::ValidationError(
            "Email not found in user attributes or client metadata".to_string(),
        ));
    };

    // Validate email format
    if !is_valid_email(email) {
        return Err(AuthError::ValidationError(
            "Invalid email format".to_string(),
        ));
    }

    info!("Creating auth challenge for email: {}", email);

    // Log all environment variables for debugging
    info!("=== ENVIRONMENT VARIABLES DEBUG ===");
    for (key, value) in std::env::vars() {
        if key.contains("TABLE") || key.contains("EMAIL") || key.contains("APP") || key.contains("ENVIRONMENT") {
            info!("  {}={}", key, value);
        }
    }
    info!("=== END ENVIRONMENT VARIABLES DEBUG ===");

    // Initialize AWS clients
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let ses_client = aws_sdk_ses::Client::new(&config);

    // Get environment variables
    let from_email = std::env::var("FROM_EMAIL")
        .map_err(|e| {
            error!("FROM_EMAIL environment variable not set: {:?}", e);
            AuthError::InternalError("FROM_EMAIL not set".to_string())
        })?;

    // Initialize services using naming utilities
    info!("Initializing RateLimitService...");
    let rate_limit_service = RateLimitService::from_env(dynamodb_client.clone())
        .map_err(|e| {
            error!("Failed to initialize RateLimitService: {}", e);
            AuthError::InternalError(format!("Failed to initialize RateLimitService: {}", e))
        })?;
    
    info!("Initializing DynamoDBService...");
    let dynamodb_service = DynamoDBService::from_env(dynamodb_client.clone())
        .map_err(|e| {
            error!("Failed to initialize DynamoDBService: {}", e);
            AuthError::InternalError(format!("Failed to initialize DynamoDBService: {}", e))
        })?;
    
    info!("Initializing SESService...");
    let ses_service = SESService::new(ses_client, from_email)
        .map_err(|e| {
            error!("Failed to initialize SESService: {}", e);
            AuthError::InternalError(format!("Failed to initialize SESService: {}", e))
        })?;
    
    info!("All services initialized successfully");

    // Check rate limiting
    info!("Checking rate limit for email: {}", email);
    match rate_limit_service.check_rate_limit(email).await {
        Ok(allowed) => {
            if !allowed {
                warn!("Rate limit exceeded for email: {}", email);

                // Get reset time for user feedback
                let reset_time = rate_limit_service.get_rate_limit_reset_time(email).await?;
                let reset_minutes = reset_time.unwrap_or(0) / 60;

                return Err(AuthError::RateLimitExceeded(format!(
                    "Too many requests. Try again in {} minutes.",
                    reset_minutes.max(1)
                )));
            }
            info!("Rate limit check passed for email: {}", email);
        }
        Err(e) => {
            error!("Rate limit check failed: {}", e);
            return Err(e);
        }
    }

    // Check if user exists, create if new registration
    info!("Checking if user exists for email: {}", email);
    let user = match dynamodb_service.get_user_by_email(email).await {
        Ok(user_opt) => match user_opt {
            Some(user) => {
                info!("Existing user found for email: {}", email);
                user
            }
            None => {
                info!("Creating new user for email: {}", email);
                // Use the Cognito user_name (which is the Cognito sub) as the user_id
                let cognito_user_id = event
                    .cognito_event_user_pools_header
                    .user_name
                    .as_ref()
                    .ok_or_else(|| {
                        AuthError::InternalError("Cognito user_name not available".to_string())
                    })?;
                match dynamodb_service.create_user(email, cognito_user_id).await {
                    Ok(user) => {
                        info!("Successfully created new user for email: {}", email);
                        user
                    }
                    Err(e) => {
                        error!("Failed to create user: {}", e);
                        return Err(e);
                    }
                }
            }
        }
        Err(e) => {
            error!("Failed to get user by email: {}", e);
            return Err(e);
        }
    };

    // Generate OTP and challenge ID
    let otp = generate_otp();
    let otp_hash = hash_otp(&otp);
    let challenge_id = generate_challenge_id();
    let now = current_timestamp();
    let expires_at = now + (5 * 60); // 5 minutes
    let ttl = expires_at + (60 * 60); // TTL 1 hour after expiration for cleanup

    // Store OTP record
    let otp_record = OTPRecord {
        email: email.clone(),
        otp_hash,
        created_at: now,
        expires_at,
        ttl,
        challenge_id: challenge_id.clone(),
        attempts: 0,
    };

    dynamodb_service.store_otp(&otp_record).await?;

    // CRITICAL: Confirm the user BEFORE sending OTP
    // This ensures the user is confirmed by the time they verify the OTP
    if let Some(ref user_pool_id) = event.cognito_event_user_pools_header.user_pool_id {
        match confirm_user_in_cognito(email, user_pool_id, &config).await {
            Ok(_) => {
                info!("User confirmed successfully before OTP challenge");
            }
            Err(e) => {
                warn!("Failed to confirm user before OTP challenge: {}", e);
                // Continue anyway - the user might already be confirmed
            }
        }
    }

    // Send OTP email
    ses_service.send_otp_email(email, &otp).await?;

    // Record this request for rate limiting
    rate_limit_service.record_request(email).await?;

    // Set response parameters
    let mut public_params = HashMap::new();
    public_params.insert("email".to_string(), email.clone());
    public_params.insert("challenge_type".to_string(), "OTP_EMAIL".to_string());

    let mut private_params = HashMap::new();
    private_params.insert("challenge_id".to_string(), challenge_id);
    private_params.insert("user_id".to_string(), user.user_id);
    private_params.insert("user_status".to_string(), format!("{:?}", user.status));

    event.response.public_challenge_parameters = public_params;
    event.response.private_challenge_parameters = private_params;
    event.response.challenge_metadata = Some("OTP_EMAIL_SENT".to_string());

    info!("Auth challenge created successfully for email: {}", email);
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(function_handler)).await
}
