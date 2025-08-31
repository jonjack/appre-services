use aws_lambda_events::{
    cognito::CognitoEventUserPoolsChallengeResult,
    event::cognito::CognitoEventUserPoolsDefineAuthChallenge,
};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use tracing::{error, info};
use serde_json;

use auth_shared::AuthResult;

async fn function_handler(
    event: LambdaEvent<CognitoEventUserPoolsDefineAuthChallenge>,
) -> Result<CognitoEventUserPoolsDefineAuthChallenge, Error> {
    let mut response_event = event.payload;

    match handle_define_challenge(&mut response_event).await {
        Ok(_) => {
            info!("Successfully defined auth challenge");
            Ok(response_event)
        }
        Err(e) => {
            error!("Failed to define auth challenge: {}", e);
            // For debugging - still issue a challenge instead of failing
            info!("Issuing challenge despite error for debugging");
            response_event.response.challenge_name = Some(CUSTOM.to_string());
            response_event.response.issue_tokens = false;
            response_event.response.fail_authentication = false;
            Ok(response_event)
        }
    }
}

const CUSTOM: &str = "CUSTOM_CHALLENGE";



async fn handle_define_challenge(
    event: &mut CognitoEventUserPoolsDefineAuthChallenge,
) -> AuthResult<()> {
    // Debug: Log the entire event structure
    info!("=== FULL EVENT DEBUG ===");
    info!("Event request:");
    info!("  - User attributes: {:?}", event.request.user_attributes);
    info!("  - Session: {:?}", event.request.session);
    info!("  - Client metadata: {:?}", event.request.client_metadata);
    info!("  - User not found: {:?}", event.request.user_not_found);
    
    info!("Event header:");
    info!("  - Header user_name: {:?}", event.cognito_event_user_pools_header.user_name);
    info!("  - Header region: {:?}", event.cognito_event_user_pools_header.region);
    info!("  - Header user_pool_id: {:?}", event.cognito_event_user_pools_header.user_pool_id);
    
    info!("Event response (before modification):");
    info!("  - Challenge name: {:?}", event.response.challenge_name);
    info!("  - Issue tokens: {:?}", event.response.issue_tokens);
    info!("  - Fail authentication: {:?}", event.response.fail_authentication);
    
    // Try to serialize the entire event for debugging
    match serde_json::to_string_pretty(&event) {
        Ok(json) => info!("Full event JSON: {}", json),
        Err(e) => info!("Failed to serialize event: {}", e),
    }
    info!("=== END EVENT DEBUG ===");

    // Extract email from various sources
    let email = if let Some(email) = event.request.user_attributes.get("email") {
        email.clone()
    } else if let Some(email) = event.request.client_metadata.get("email") {
        email.clone()
    } else if let Some(ref user_name) = event.cognito_event_user_pools_header.user_name {
        user_name.clone()
    } else {
        // Use placeholder to continue the flow and debug further
        info!("WARNING: No email found anywhere, using placeholder to continue debugging");
        "debug@placeholder.com".to_string()
    };

    info!("Defining auth challenge for email: {}", email);

    // NOTE: In aws_lambda_events, this is typically Vec<Option<CognitoEventUserPoolsChallengeResult>>
    let session: &[Option<CognitoEventUserPoolsChallengeResult>] = &event.request.session;

    // Have we ever issued a CUSTOM_CHALLENGE?
    let has_custom_challenge = session
        .iter()
        .filter_map(|o| o.as_ref())
        .any(|r| r.challenge_name.as_deref() == Some(CUSTOM));

    // Find the most recent CUSTOM_CHALLENGE entry (if any)
    let last_custom = session
        .iter()
        .rev()
        .filter_map(|o| o.as_ref())
        .find(|r| r.challenge_name.as_deref() == Some(CUSTOM));

    // Debug session analysis
    info!("Session analysis:");
    info!("  - has_custom_challenge: {}", has_custom_challenge);
    info!("  - last_custom challenge_result: {:?}", last_custom.and_then(|r| Some(r.challenge_result)));
    info!("  - Session entries count: {}", session.len());
    for (i, entry) in session.iter().enumerate() {
        if let Some(entry) = entry {
            info!("  - Session[{}]: challenge_name={:?}, challenge_result={:?}", 
                  i, entry.challenge_name, entry.challenge_result);
        }
    }

    match (
        has_custom_challenge,
        last_custom.and_then(|r| Some(r.challenge_result)),
    ) {
        // First time — issue a custom challenge
        (false, _) => {
            info!("🔄 BRANCH: Issuing first {CUSTOM} for email: {}", email);
            event.response.challenge_name = Some(CUSTOM.to_string());
            event.response.issue_tokens = false;
            event.response.fail_authentication = false;
            info!("✅ SET: challenge_name={CUSTOM}, issue_tokens=false");
        }

        // Last CUSTOM_CHALLENGE succeeded — issue tokens
        // We trust that verify-auth-challenge properly validated the OTP and set email_verified=true
        // Don't rely on event attributes due to timing issues
        (true, Some(true)) => {
            info!("🎉 BRANCH: Previous {CUSTOM} succeeded for {}; issuing tokens (trusting OTP verification)", email);
            info!("Note: Event attributes may be stale due to timing, but OTP was verified successfully");
            event.response.challenge_name = None;
            event.response.issue_tokens = true;
            event.response.fail_authentication = false;
            info!("✅ SET: issue_tokens=true, fail_authentication=false");
        }

        // Last CUSTOM_CHALLENGE failed — fail auth (your chosen policy)
        (true, Some(false)) => {
            info!("❌ BRANCH: Previous {CUSTOM} failed; failing auth for {}", email);
            event.response.challenge_name = None;
            event.response.issue_tokens = false;
            event.response.fail_authentication = true;
            info!("✅ SET: issue_tokens=false, fail_authentication=true");
        }

        // Unexpected/missing state — safe fail
        _ => {
            error!("⚠️ BRANCH: Unexpected challenge state for {}", email);
            error!("Session state: has_custom_challenge={}, last_result={:?}", 
                   has_custom_challenge, last_custom.and_then(|r| Some(r.challenge_result)));
            event.response.challenge_name = None;
            event.response.issue_tokens = false;
            event.response.fail_authentication = true;
            info!("✅ SET: issue_tokens=false, fail_authentication=true (fallback)");
        }
    }

    // Final response logging
    info!("=== FINAL RESPONSE ===");
    info!("  - challenge_name: {:?}", event.response.challenge_name);
    info!("  - issue_tokens: {:?}", event.response.issue_tokens);
    info!("  - fail_authentication: {:?}", event.response.fail_authentication);
    info!("=== END FINAL RESPONSE ===");

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
