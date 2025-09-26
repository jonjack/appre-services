use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailRequest {
    /// SES template name to use
    pub template_name: String,
    /// Recipient email address
    pub recipient: String,
    /// Template variables as key-value pairs
    pub template_data: HashMap<String, String>,
    /// Email priority (affects processing order)
    pub priority: EmailPriority,
    /// Optional reply-to address
    pub reply_to: Option<String>,
    /// Optional custom from address (must be verified in SES)
    pub from_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailPriority {
    /// High priority emails (OTP, password reset, etc.)
    High,
    /// Normal priority emails (welcome, notifications, etc.)
    Normal,
    /// Low priority emails (newsletters, marketing, etc.)
    Low,
}

impl Default for EmailPriority {
    fn default() -> Self {
        EmailPriority::Normal
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailResponse {
    /// Unique message ID from SES
    pub message_id: String,
    /// Whether the email was sent successfully
    pub success: bool,
    /// Error message if sending failed
    pub error: Option<String>,
}

/// Predefined base template names for type safety
/// These are base names without environment suffix - the EmailService will automatically append the environment
pub struct EmailTemplates;

impl EmailTemplates {
    pub const OTP: &'static str = "otp";
    pub const WELCOME: &'static str = "welcome";
    pub const COMPLETE_REGISTRATION_USER_INFO: &'static str = "complete-registration-user-info";
    pub const COMPLETE_REGISTRATION_STRIPE: &'static str = "complete-registration-stripe";
    pub const NEWSLETTER: &'static str = "newsletter";
}

/// Helper functions for creating common email requests
impl EmailRequest {
    /// Create an OTP email request
    pub fn otp(recipient: String, otp: String) -> Self {
        let mut template_data = HashMap::new();
        template_data.insert("otp".to_string(), otp);

        Self {
            template_name: EmailTemplates::OTP.to_string(),
            recipient,
            template_data,
            priority: EmailPriority::High,
            reply_to: None,
            from_address: None,
        }
    }

    /// Create a welcome email request
    pub fn welcome(recipient: String, first_name: String, dashboard_url: String) -> Self {
        let mut template_data = HashMap::new();
        template_data.insert("firstName".to_string(), first_name);
        template_data.insert("dashboardUrl".to_string(), dashboard_url);

        Self {
            template_name: EmailTemplates::WELCOME.to_string(),
            recipient,
            template_data,
            priority: EmailPriority::Normal,
            reply_to: None,
            from_address: None,
        }
    }

    /// Create a complete registration user info reminder email
    pub fn complete_registration_user_info(
        recipient: String,
        first_name: String,
        profile_url: String,
        unsubscribe_url: String,
    ) -> Self {
        let mut template_data = HashMap::new();
        template_data.insert("firstName".to_string(), first_name);
        template_data.insert("profileUrl".to_string(), profile_url);
        template_data.insert("unsubscribeUrl".to_string(), unsubscribe_url);

        Self {
            template_name: EmailTemplates::COMPLETE_REGISTRATION_USER_INFO.to_string(),
            recipient,
            template_data,
            priority: EmailPriority::Normal,
            reply_to: None,
            from_address: None,
        }
    }

    /// Create a complete registration Stripe setup reminder email
    pub fn complete_registration_stripe(
        recipient: String,
        first_name: String,
        stripe_setup_url: String,
        unsubscribe_url: String,
    ) -> Self {
        let mut template_data = HashMap::new();
        template_data.insert("firstName".to_string(), first_name);
        template_data.insert("stripeSetupUrl".to_string(), stripe_setup_url);
        template_data.insert("unsubscribeUrl".to_string(), unsubscribe_url);

        Self {
            template_name: EmailTemplates::COMPLETE_REGISTRATION_STRIPE.to_string(),
            recipient,
            template_data,
            priority: EmailPriority::Normal,
            reply_to: None,
            from_address: None,
        }
    }

    /// Create a newsletter email request
    pub fn newsletter(
        recipient: String,
        subject: String,
        content: String,
        unsubscribe_url: String,
        cta_text: Option<String>,
        cta_url: Option<String>,
    ) -> Self {
        let mut template_data = HashMap::new();
        template_data.insert("subject".to_string(), subject);
        template_data.insert("content".to_string(), content);
        template_data.insert("unsubscribeUrl".to_string(), unsubscribe_url);
        
        if let Some(cta_text) = cta_text {
            template_data.insert("ctaText".to_string(), cta_text);
        }
        if let Some(cta_url) = cta_url {
            template_data.insert("ctaUrl".to_string(), cta_url);
        }

        Self {
            template_name: EmailTemplates::NEWSLETTER.to_string(),
            recipient,
            template_data,
            priority: EmailPriority::Low,
            reply_to: None,
            from_address: None,
        }
    }
}