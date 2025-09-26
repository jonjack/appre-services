use aws_sdk_ses::Client as SesClient;
use aws_sdk_ses::types::{Destination, MessageTag};
use crate::{EmailRequest, EmailResponse, NotificationError, NotificationResult, RuntimeConfig};

/// Service for sending emails via SES using templates
pub struct EmailService {
    client: SesClient,
    from_email: String,
    template_names: std::collections::HashMap<String, String>,
}

impl EmailService {
    pub fn new(client: SesClient, from_email: String, template_names: std::collections::HashMap<String, String>) -> Self {
        Self { 
            client, 
            from_email,
            template_names,
        }
    }

    /// Create EmailService from environment variables provided by CDK
    pub fn from_env(client: SesClient, from_email: String) -> Result<Self, NotificationError> {
        use std::collections::HashMap;
        
        let mut template_names = HashMap::new();
        
        // Load template names from CDK-provided environment variables
        if let Ok(otp_template) = std::env::var("OTP_TEMPLATE_NAME") {
            template_names.insert("otp".to_string(), otp_template);
        }
        if let Ok(welcome_template) = std::env::var("WELCOME_TEMPLATE_NAME") {
            template_names.insert("welcome".to_string(), welcome_template);
        }
        if let Ok(user_info_template) = std::env::var("COMPLETE_REGISTRATION_USER_INFO_TEMPLATE_NAME") {
            template_names.insert("complete-registration-user-info".to_string(), user_info_template);
        }
        if let Ok(stripe_template) = std::env::var("COMPLETE_REGISTRATION_STRIPE_TEMPLATE_NAME") {
            template_names.insert("complete-registration-stripe".to_string(), stripe_template);
        }
        if let Ok(newsletter_template) = std::env::var("NEWSLETTER_TEMPLATE_NAME") {
            template_names.insert("newsletter".to_string(), newsletter_template);
        }
        
        Ok(Self::new(client, from_email, template_names))
    }

    /// Create EmailService using runtime configuration for dynamic template name construction
    /// This method constructs template names at runtime using APP_NAME and ENVIRONMENT
    pub fn from_runtime_config(client: SesClient, from_email: String, runtime_config: RuntimeConfig) -> Self {
        use std::collections::HashMap;
        
        let mut template_names = HashMap::new();
        
        // Construct template names using runtime configuration
        template_names.insert("otp".to_string(), runtime_config.ses_template("otp"));
        template_names.insert("welcome".to_string(), runtime_config.ses_template("welcome"));
        template_names.insert("complete-registration-user-info".to_string(), runtime_config.ses_template("complete-registration-user-info"));
        template_names.insert("complete-registration-stripe".to_string(), runtime_config.ses_template("complete-registration-stripe"));
        template_names.insert("newsletter".to_string(), runtime_config.ses_template("newsletter"));
        
        Self::new(client, from_email, template_names)
    }

    /// Send an email using SES templates
    pub async fn send_templated_email(&self, request: EmailRequest) -> NotificationResult<EmailResponse> {
        tracing::debug!("Starting send_templated_email for recipient: {}", request.recipient);
        // Validate recipient email
        if !self.is_valid_email(&request.recipient) {
            return Err(NotificationError::InvalidRecipient(
                format!("Invalid email address: {}", request.recipient)
            ));
        }

        // Get template name from CDK-provided environment variables
        let template_name = self.template_names.get(&request.template_name)
            .ok_or_else(|| NotificationError::SESError(
                format!("Template '{}' not configured. Available templates: {:?}", 
                       request.template_name, 
                       self.template_names.keys().collect::<Vec<_>>())
            ))?
            .clone();

        // Convert template data to JSON string
        let template_data = serde_json::to_string(&request.template_data)
            .map_err(NotificationError::from)?;

        // Build destination
        let destination = Destination::builder()
            .to_addresses(&request.recipient)
            .build();

        // Determine from address
        let from_address = request.from_address
            .as_ref()
            .unwrap_or(&self.from_email);

        // Build SES request
        let mut ses_request = self.client
            .send_templated_email()
            .source(from_address)
            .destination(destination)
            .template(&template_name)
            .template_data(&template_data);

        // Add reply-to if specified
        if let Some(reply_to) = &request.reply_to {
            ses_request = ses_request.reply_to_addresses(reply_to);
        }

        // Add message tags for tracking
        let environment = std::env::var("ENVIRONMENT").unwrap_or_else(|_| "unknown".to_string());
        ses_request = ses_request
            .tags(
                MessageTag::builder()
                    .name("Environment")
                    .value(&environment)
                    .build()
                    .map_err(|e| NotificationError::SESError(e.to_string()))?
            )
            .tags(
                MessageTag::builder()
                    .name("TemplateType")
                    .value(&request.template_name)
                    .build()
                    .map_err(|e| NotificationError::SESError(e.to_string()))?
            )
            .tags(
                MessageTag::builder()
                    .name("Priority")
                    .value(&format!("{:?}", request.priority))
                    .build()
                    .map_err(|e| NotificationError::SESError(e.to_string()))?
            );

        // Log the request details before sending
        tracing::info!(
            "Sending SES templated email - Template: {}, Recipient: {}, From: {}", 
            template_name, 
            request.recipient,
            from_address
        );
        
        tracing::debug!(
            "SES request details - Template data: {}, Reply-to: {:?}", 
            template_data,
            request.reply_to
        );

        // Send the email
        match ses_request.send().await {
            Ok(result) => {
                let message_id = result.message_id().to_string();

                tracing::info!(
                    "✅ SES email sent successfully - Message ID: {}, Template: {}, Recipient: {}", 
                    message_id, 
                    template_name, 
                    request.recipient
                );

                Ok(EmailResponse {
                    message_id,
                    success: true,
                    error: None,
                })
            }
            Err(err) => {
                // Extract detailed error information
                let error_msg = format!("{}", err);
                let (error_code, error_message) = match &err {
                    aws_sdk_ses::error::SdkError::ServiceError(service_err) => {
                        let code = service_err.err().meta().code().unwrap_or("UnknownServiceError");
                        let message = service_err.err().meta().message().unwrap_or("No error message provided");
                        (code, message)
                    }
                    aws_sdk_ses::error::SdkError::TimeoutError(_) => {
                        ("TimeoutError", "Request timed out")
                    }
                    aws_sdk_ses::error::SdkError::ResponseError(_) => {
                        ("ResponseError", "HTTP response error")
                    }
                    aws_sdk_ses::error::SdkError::DispatchFailure(_) => {
                        ("DispatchFailure", "Failed to dispatch request")
                    }
                    aws_sdk_ses::error::SdkError::ConstructionFailure(_) => {
                        ("ConstructionFailure", "Failed to construct request")
                    }
                    _ => {
                        ("UnknownError", "Unknown error type")
                    }
                };
                
                tracing::error!(
                    "❌ SES API call failed - Template: {}, Recipient: {}, Error Code: {}, Message: {}, Full Error: {}", 
                    template_name, 
                    request.recipient, 
                    error_code,
                    error_message,
                    error_msg
                );

                // Log additional context for common errors
                match error_code {
                    "TemplateDoesNotExist" => {
                        tracing::error!(
                            "Template '{}' not found in SES. Base template name: '{}'. Check if template exists in SES.", 
                            template_name, 
                            request.template_name
                        );
                        
                        // Try to list available templates for debugging
                        if let Ok(available_templates) = self.list_templates().await {
                            let matching_templates: Vec<_> = available_templates
                                .iter()
                                .filter(|t| t.contains(&request.template_name))
                                .collect();
                            
                            if matching_templates.is_empty() {
                                tracing::error!("No templates found containing base name '{}'. Available templates: {:?}", request.template_name, available_templates);
                            } else {
                                tracing::error!("Found similar templates: {:?}. Expected: {}", matching_templates, template_name);
                            }
                        }
                    }
                    "MessageRejected" => {
                        tracing::error!("SES rejected message. Possible causes: unverified email, content issues, or account restrictions.");
                    }
                    "SendingPausedException" => {
                        tracing::error!("SES sending is paused. Check account status in SES console.");
                    }
                    "ConfigurationSetDoesNotExistException" => {
                        tracing::error!("SES configuration set not found.");
                    }
                    "AccountSendingPausedException" => {
                        tracing::error!("Account-level sending is paused in SES.");
                    }
                    _ => {
                        tracing::error!("Unhandled SES error code: {}", error_code);
                    }
                }

                // Return detailed error response
                let detailed_error = format!("SES Error [{}]: {} (Template: {}, Recipient: {})", 
                                           error_code, error_message, template_name, request.recipient);

                Ok(EmailResponse {
                    message_id: String::new(),
                    success: false,
                    error: Some(detailed_error),
                })
            }
        }
    }

    /// Send multiple emails in sequence (not batch - SES doesn't support batch templated emails)
    pub async fn send_templated_emails(&self, requests: Vec<EmailRequest>) -> NotificationResult<Vec<EmailResponse>> {
        let mut responses = Vec::new();
        
        for request in requests {
            let response = self.send_templated_email(request).await?;
            responses.push(response);
        }

        Ok(responses)
    }

    /// Validate email address format (basic validation)
    fn is_valid_email(&self, email: &str) -> bool {
        email.contains('@') 
            && email.contains('.') 
            && email.len() > 5 
            && !email.starts_with('@') 
            && !email.ends_with('@')
            && !email.starts_with('.')
            && !email.ends_with('.')
    }

    /// Get available SES templates (for debugging/validation)
    pub async fn list_templates(&self) -> NotificationResult<Vec<String>> {
        let result = self.client
            .list_templates()
            .send()
            .await
            .map_err(|e| NotificationError::SESError(e.to_string()))?;

        let template_names = result.templates_metadata()
            .iter()
            .filter_map(|template| template.name().map(|name| name.to_string()))
            .collect();

        Ok(template_names)
    }

    /// Validate that a template exists before attempting to send
    pub async fn validate_template_exists(&self, base_template_name: &str) -> NotificationResult<bool> {
        let template_name = self.template_names.get(base_template_name)
            .ok_or_else(|| NotificationError::SESError(
                format!("Template '{}' not configured", base_template_name)
            ))?;
            
        let available_templates = self.list_templates().await?;
        let exists = available_templates.contains(template_name);
        
        if !exists {
            tracing::warn!(
                "Template validation failed - Expected: '{}', Available templates: {:?}",
                template_name,
                available_templates
            );
        }
        
        Ok(exists)
    }

    /// Get the full template name that will be used for a base template name
    pub fn get_full_template_name(&self, base_template_name: &str) -> Option<String> {
        self.template_names.get(base_template_name).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{EmailRequest, EmailPriority};
    use std::collections::HashMap;

    fn create_test_email_service() -> EmailService {
        use std::collections::HashMap;
        
        // Create a properly configured mock SES client
        let ses_config = aws_sdk_ses::Config::builder()
            .behavior_version(aws_sdk_ses::config::BehaviorVersion::latest())
            .region(aws_sdk_ses::config::Region::new("us-east-1"))
            .credentials_provider(aws_sdk_ses::config::SharedCredentialsProvider::new(
                aws_sdk_ses::config::Credentials::new("test", "test", None, None, "test")
            ))
            .build();
        
        let mut template_names = HashMap::new();
        template_names.insert("otp".to_string(), "appre-otp-test".to_string());
        template_names.insert("welcome".to_string(), "appre-welcome-test".to_string());
        template_names.insert("newsletter".to_string(), "appre-newsletter-test".to_string());
        
        EmailService::new(
            SesClient::from_conf(ses_config),
            "test@example.com".to_string(),
            template_names,
        )
    }

    #[test]
    fn test_email_validation() {
        let service = create_test_email_service();

        assert!(service.is_valid_email("user@example.com"));
        assert!(service.is_valid_email("test.user+tag@domain.co.uk"));
        
        assert!(!service.is_valid_email("invalid"));
        assert!(!service.is_valid_email("@example.com"));
        assert!(!service.is_valid_email("user@"));
        assert!(!service.is_valid_email(".user@example.com"));
        assert!(!service.is_valid_email("user@example."));
    }

    #[test]
    fn test_template_name_resolution() {
        let service = create_test_email_service();
        
        // Test that base template names resolve to CDK-provided names
        assert_eq!(service.get_full_template_name("otp"), Some("appre-otp-test".to_string()));
        assert_eq!(service.get_full_template_name("welcome"), Some("appre-welcome-test".to_string()));
        assert_eq!(service.get_full_template_name("newsletter"), Some("appre-newsletter-test".to_string()));
        assert_eq!(service.get_full_template_name("nonexistent"), None);
    }

    #[test]
    fn test_email_request_template_resolution() {
        let service = create_test_email_service();
        let mut template_data = HashMap::new();
        template_data.insert("otp".to_string(), "123456".to_string());

        let email_request = EmailRequest {
            template_name: "otp".to_string(), // Base template name
            recipient: "test@example.com".to_string(),
            template_data,
            priority: EmailPriority::High,
            reply_to: None,
            from_address: None,
        };

        // Verify that the service would use the correct full template name
        let expected_full_name = service.get_full_template_name(&email_request.template_name);
        assert_eq!(expected_full_name, Some("appre-otp-test".to_string()));
    }

    #[test]
    fn test_template_constants_are_base_names() {
        use crate::models::EmailTemplates;
        
        // Verify that template constants are base names (no environment suffix)
        assert_eq!(EmailTemplates::OTP, "otp");
        assert_eq!(EmailTemplates::WELCOME, "welcome");
        assert_eq!(EmailTemplates::COMPLETE_REGISTRATION_USER_INFO, "complete-registration-user-info");
        assert_eq!(EmailTemplates::COMPLETE_REGISTRATION_STRIPE, "complete-registration-stripe");
        assert_eq!(EmailTemplates::NEWSLETTER, "newsletter");
        
        // Verify none of them contain hardcoded prefixes
        assert!(!EmailTemplates::OTP.contains("appre"));
        assert!(!EmailTemplates::WELCOME.contains("appre"));
        assert!(!EmailTemplates::OTP.contains("appre-"));
        assert!(!EmailTemplates::WELCOME.contains("appre-"));
    }

    #[test]
    fn test_helper_methods_create_correct_template_names() {
        let service = create_test_email_service();
        
        // Test OTP email helper
        let otp_request = EmailRequest::otp("test@example.com".to_string(), "123456".to_string());
        assert_eq!(otp_request.template_name, "otp");
        assert_eq!(service.get_full_template_name(&otp_request.template_name), Some("appre-otp-test".to_string()));
        
        // Test welcome email helper
        let welcome_request = EmailRequest::welcome(
            "test@example.com".to_string(),
            "John".to_string(),
            "https://app.example.com".to_string()
        );
        assert_eq!(welcome_request.template_name, "welcome");
        assert_eq!(service.get_full_template_name(&welcome_request.template_name), Some("appre-welcome-test".to_string()));
    }

    #[test]
    fn test_template_mapping_with_different_environments() {
        use std::collections::HashMap;
        
        // Test with different template mappings
        let ses_config = aws_sdk_ses::Config::builder()
            .behavior_version(aws_sdk_ses::config::BehaviorVersion::latest())
            .region(aws_sdk_ses::config::Region::new("us-east-1"))
            .credentials_provider(aws_sdk_ses::config::SharedCredentialsProvider::new(
                aws_sdk_ses::config::Credentials::new("test", "test", None, None, "test")
            ))
            .build();
        
        let mut test_templates = HashMap::new();
        test_templates.insert("otp".to_string(), "appre-otp-test".to_string());
        test_templates.insert("welcome".to_string(), "appre-welcome-test".to_string());
        
        let mut prod_templates = HashMap::new();
        prod_templates.insert("otp".to_string(), "appre-otp-prod".to_string());
        prod_templates.insert("welcome".to_string(), "appre-welcome-prod".to_string());
        
        let test_service = EmailService::new(
            SesClient::from_conf(ses_config.clone()),
            "test@example.com".to_string(),
            test_templates,
        );
        
        let prod_service = EmailService::new(
            SesClient::from_conf(ses_config),
            "test@example.com".to_string(),
            prod_templates,
        );
        
        // Verify template mappings work correctly
        assert_eq!(test_service.get_full_template_name("otp"), Some("appre-otp-test".to_string()));
        assert_eq!(prod_service.get_full_template_name("otp"), Some("appre-otp-prod".to_string()));
        
        assert_eq!(test_service.get_full_template_name("welcome"), Some("appre-welcome-test".to_string()));
        assert_eq!(prod_service.get_full_template_name("welcome"), Some("appre-welcome-prod".to_string()));
    }
}