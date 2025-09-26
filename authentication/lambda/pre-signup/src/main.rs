use aws_lambda_events::event::cognito::CognitoEventUserPoolsPreSignup;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use tracing::{error, info};

async fn function_handler(
    event: LambdaEvent<CognitoEventUserPoolsPreSignup>,
) -> Result<CognitoEventUserPoolsPreSignup, Error> {
    let mut response_event = event.payload;

    match handle_pre_signup(&mut response_event).await {
        Ok(_) => {
            info!("Successfully handled pre-signup");
            Ok(response_event)
        }
        Err(e) => {
            error!("Failed to handle pre-signup: {}", e);
            // For pre-signup, we should allow the signup to continue
            // even if there are errors, to avoid blocking user registration
            Ok(response_event)
        }
    }
}

async fn handle_pre_signup(
    event: &mut CognitoEventUserPoolsPreSignup,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Extract email from user attributes
    let email = event
        .request
        .user_attributes
        .get("email")
        .ok_or("Email not found in user attributes")?;

    info!("Pre-signup trigger for email: {}", email);

    // Auto-confirm the user for passwordless auth
    // This allows the custom auth flow to work immediately
    event.response.auto_confirm_user = true;
    event.response.auto_verify_email = false; // We'll verify via OTP

    info!("Auto-confirmed user for passwordless auth: {}", email);
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