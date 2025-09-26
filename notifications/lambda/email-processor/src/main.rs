use aws_lambda_events::event::sqs::SqsEvent;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use notifications_shared::{EmailRequest, EmailService, NotificationError, RuntimeConfig};
use std::env;
use tracing::{debug, error, info, warn};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing with DEBUG level for better error visibility
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(true)
        .without_time()
        .init();

    info!("Starting email processor Lambda");

    run(service_fn(function_handler)).await
}

async fn function_handler(event: LambdaEvent<SqsEvent>) -> Result<(), Error> {
    let (event, _context) = event.into_parts();
    
    info!("Processing {} SQS messages", event.records.len());

    // Initialize AWS clients
    let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let ses_client = aws_sdk_ses::Client::new(&config);

    // Get configuration from environment
    let from_email = env::var("FROM_EMAIL")
        .unwrap_or_else(|_| "noreply@appreciata.com".to_string());

    info!("Lambda configuration - FROM_EMAIL: {}", from_email);

    // Initialize runtime configuration for resource name resolution
    let runtime_config = match RuntimeConfig::from_env() {
        Ok(config) => {
            info!("Runtime configuration loaded - APP_NAME: {}, ENVIRONMENT: {}", 
                  config.app_name, config.environment);
            
            // Log example resource names that could be constructed at runtime
            info!("Example runtime resource names:");
            info!("  SES template 'otp': {}", config.ses_template("otp"));
            info!("  SES template 'welcome': {}", config.ses_template("welcome"));
            info!("  SQS queue 'email-queue': {}", config.sqs_queue("email-queue"));
            
            Some(config)
        }
        Err(e) => {
            warn!("Failed to load runtime configuration: {}. Using CDK-provided template names only.", e);
            None
        }
    };

    // Initialize email service using CDK-provided environment variables (preferred method)
    let email_service = match EmailService::from_env(ses_client.clone(), from_email.clone()) {
        Ok(service) => {
            info!("EmailService initialized using CDK-provided template names");
            service
        }
        Err(e) => {
            error!("Failed to initialize EmailService from CDK environment: {}", e);
            
            // Fallback: try runtime configuration approach
            if let Some(config) = runtime_config {
                warn!("Attempting fallback initialization using runtime configuration");
                let service = EmailService::from_runtime_config(ses_client, from_email, config);
                info!("EmailService initialized using runtime configuration fallback");
                service
            } else {
                error!("No fallback configuration available");
                return Err(format!("Configuration error: {}", e).into());
            }
        }
    };

    // Process each SQS message
    let mut successful_count = 0;
    let mut failed_count = 0;

    for (index, record) in event.records.iter().enumerate() {
        info!("Processing SQS record {} of {}", index + 1, event.records.len());
        
        match process_email_record(&email_service, record.clone()).await {
            Ok(_) => {
                successful_count += 1;
                info!("Successfully processed record {}", index + 1);
            }
            Err(e) => {
                error!("Failed to process email record {}: {}", index + 1, e);
                
                // Log additional context about the error
                match &e {
                    NotificationError::EmailDeliveryFailed(msg) => {
                        error!("Email delivery failure details: {}", msg);
                    }
                    NotificationError::SESError(msg) => {
                        error!("SES service error details: {}", msg);
                    }
                    NotificationError::InvalidRecipient(msg) => {
                        error!("Invalid recipient error: {}", msg);
                    }
                    NotificationError::SerializationError(msg) => {
                        error!("JSON parsing error: {}", msg);
                        if let Some(body) = &record.body {
                            error!("Problematic message body: {}", body);
                        }
                    }
                    _ => {
                        error!("Other error type: {:?}", e);
                    }
                }
                
                failed_count += 1;
                // Continue processing other messages even if one fails
            }
        }
    }

    info!(
        "Email processing completed - Success: {}, Failed: {}", 
        successful_count, 
        failed_count
    );

    // If any messages failed, Lambda will retry them based on SQS configuration
    if failed_count > 0 {
        warn!("{} messages failed processing and will be retried", failed_count);
    }

    Ok(())
}

async fn process_email_record(
    email_service: &EmailService,
    record: aws_lambda_events::event::sqs::SqsMessage,
) -> Result<(), NotificationError> {
    // Log SQS message metadata
    debug!("SQS Record - Message ID: {:?}, Receipt Handle: {:?}", 
           record.message_id, record.receipt_handle);
    
    // Parse the email request from SQS message body
    let body = record.body.as_ref().ok_or_else(|| {
        error!("SQS message body is empty for message ID: {:?}", record.message_id);
        NotificationError::SerializationError("SQS message body is empty".to_string())
    })?;
    
    debug!("Raw SQS message body: {}", body);
    
    let email_request: EmailRequest = serde_json::from_str(body)
        .map_err(|e| {
            error!("Failed to parse JSON from SQS message. Error: {}, Body: {}", e, body);
            NotificationError::SerializationError(
                format!("Failed to parse email request: {} | Body: {}", e, body)
            )
        })?;

    info!(
        "Processing email - Template: {}, Recipient: {}, Priority: {:?}, Template Data Keys: {:?}",
        email_request.template_name,
        email_request.recipient,
        email_request.priority,
        email_request.template_data.keys().collect::<Vec<_>>()
    );

    // Log template data (be careful not to log sensitive info)
    for (key, value) in &email_request.template_data {
        if key.to_lowercase().contains("password") || key.to_lowercase().contains("secret") {
            debug!("Template data - {}: [REDACTED]", key);
        } else {
            debug!("Template data - {}: {}", key, value);
        }
    }

    // Send the email
    info!("Calling email service to send templated email...");
    let response = match email_service.send_templated_email(email_request.clone()).await {
        Ok(resp) => resp,
        Err(e) => {
            error!("Email service returned error: {:?}", e);
            
            // Provide more specific error context
            match &e {
                NotificationError::SESError(ses_err) => {
                    error!("SES API Error Details: {}", ses_err);
                    
                    // Check for common SES errors
                    if ses_err.contains("TemplateDoesNotExist") {
                        error!("Template with base name '{}' does not exist in SES.", email_request.template_name);
                        
                        // Try to list available templates for debugging
                        match email_service.list_templates().await {
                            Ok(templates) => {
                                error!("Available SES templates: {:?}", templates);
                            }
                            Err(list_err) => {
                                error!("Could not list SES templates: {:?}", list_err);
                            }
                        }
                    } else if ses_err.contains("MessageRejected") {
                        error!("SES rejected the message. Check email address verification and content.");
                    } else if ses_err.contains("SendingPausedException") {
                        error!("SES sending is paused for this account.");
                    }
                }
                NotificationError::InvalidRecipient(msg) => {
                    error!("Recipient validation failed: {}", msg);
                }
                _ => {
                    error!("Unexpected error from email service: {:?}", e);
                }
            }
            
            return Err(e);
        }
    };

    if response.success {
        info!("✅ Email sent successfully - Message ID: {}, Template: {}, Recipient: {}", 
              response.message_id, email_request.template_name, email_request.recipient);
    } else {
        let error_msg = response.error.unwrap_or_else(|| "Unknown SES error".to_string());
        error!("❌ Email sending failed - Template: {}, Recipient: {}, Error: {}", 
               email_request.template_name, email_request.recipient, error_msg);
        
        // Log additional debugging info
        error!("Failed email request details: Template: {}, Recipient: {}, From: {:?}, Reply-to: {:?}", 
               email_request.template_name, 
               email_request.recipient,
               email_request.from_address,
               email_request.reply_to);
        
        return Err(NotificationError::EmailDeliveryFailed(
            format!("SES error for template '{}' to '{}': {}", 
                   email_request.template_name, email_request.recipient, error_msg)
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use notifications_shared::{EmailRequest, EmailPriority};
    use std::collections::HashMap;

    #[test]
    fn test_email_request_parsing() {
        let mut template_data = HashMap::new();
        template_data.insert("otp".to_string(), "123456".to_string());

        let request = EmailRequest {
            template_name: "otp".to_string(), // Using base template name - environment suffix will be added automatically
            recipient: "test@example.com".to_string(),
            template_data,
            priority: EmailPriority::High,
            reply_to: None,
            from_address: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: EmailRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.template_name, request.template_name);
        assert_eq!(parsed.recipient, request.recipient);
        assert_eq!(parsed.template_data, request.template_data);
    }
}