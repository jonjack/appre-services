use aws_sdk_ses::Client as SesClient;
use crate::{AuthError, AuthResult};
use notifications_shared::{EmailRequest, EmailService, EmailPriority};
use std::collections::HashMap;

pub struct SESService {
    email_service: EmailService,
}

impl SESService {
    pub fn new(client: SesClient, from_email: String) -> Result<Self, AuthError> {
        let email_service = EmailService::from_env(client, from_email)
            .map_err(|e| AuthError::InternalError(format!("Failed to initialize EmailService: {}", e)))?;
        Ok(Self { email_service })
    }

    /// Send OTP email to user using SES template
    pub async fn send_otp_email(&self, to_email: &str, otp: &str) -> AuthResult<()> {
        let mut template_data = HashMap::new();
        template_data.insert("otp".to_string(), otp.to_string());

        let email_request = EmailRequest {
            template_name: "otp".to_string(), // Base template name, environment suffix will be added automatically
            recipient: to_email.to_string(),
            template_data,
            priority: EmailPriority::High,
            reply_to: None,
            from_address: None,
        };

        let response = self.email_service.send_templated_email(email_request).await
            .map_err(|e| AuthError::EmailDeliveryFailed(e.to_string()))?;

        if !response.success {
            let error_msg = response.error.unwrap_or_else(|| "Unknown SES error".to_string());
            return Err(AuthError::EmailDeliveryFailed(error_msg));
        }

        tracing::info!("OTP email sent successfully to {} with message ID: {}", to_email, response.message_id);
        Ok(())
    }

    /// Send welcome email after successful registration using SES template
    pub async fn send_welcome_email(&self, to_email: &str, user_name: &str, dashboard_url: &str) -> AuthResult<()> {
        let mut template_data = HashMap::new();
        template_data.insert("firstName".to_string(), user_name.to_string());
        template_data.insert("dashboardUrl".to_string(), dashboard_url.to_string());

        let email_request = EmailRequest {
            template_name: "welcome".to_string(), // Base template name, environment suffix will be added automatically
            recipient: to_email.to_string(),
            template_data,
            priority: EmailPriority::Normal,
            reply_to: None,
            from_address: None,
        };

        let response = self.email_service.send_templated_email(email_request).await
            .map_err(|e| AuthError::EmailDeliveryFailed(e.to_string()))?;

        if !response.success {
            let error_msg = response.error.unwrap_or_else(|| "Unknown SES error".to_string());
            return Err(AuthError::EmailDeliveryFailed(error_msg));
        }

        tracing::info!("Welcome email sent successfully to {} with message ID: {}", to_email, response.message_id);
        Ok(())
    }
}