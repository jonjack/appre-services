use aws_sdk_ses::{Client as SesClient, types::{Body, Content, Destination, Message}};
use crate::{AuthError, AuthResult};

pub struct SESService {
    client: SesClient,
    from_email: String,
}

impl SESService {
    pub fn new(client: SesClient, from_email: String) -> Self {
        Self { client, from_email }
    }

    /// Send OTP email to user
    pub async fn send_otp_email(&self, to_email: &str, otp: &str) -> AuthResult<()> {
        let subject = "Your Appreciata Login Code";
        let body_text = format!(
            "Your login code is: {}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.",
            otp
        );
        let body_html = format!(
            r#"
            <html>
            <body>
                <h2>Your Appreciata Login Code</h2>
                <p>Your login code is:</p>
                <h1 style="font-family: monospace; font-size: 32px; color: #2563eb; letter-spacing: 4px;">{}</h1>
                <p>This code will expire in <strong>5 minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    This is an automated message from Appreciata. Please do not reply to this email.
                </p>
            </body>
            </html>
            "#,
            otp
        );

        let destination = Destination::builder()
            .to_addresses(to_email)
            .build();

        let subject_content = Content::builder()
            .data(subject)
            .charset("UTF-8")
            .build()
            .map_err(|e| AuthError::SESError(e.to_string()))?;

        let text_content = Content::builder()
            .data(body_text)
            .charset("UTF-8")
            .build()
            .map_err(|e| AuthError::SESError(e.to_string()))?;

        let html_content = Content::builder()
            .data(body_html)
            .charset("UTF-8")
            .build()
            .map_err(|e| AuthError::SESError(e.to_string()))?;

        let body = Body::builder()
            .text(text_content)
            .html(html_content)
            .build();

        let message = Message::builder()
            .subject(subject_content)
            .body(body)
            .build();

        self.client
            .send_email()
            .source(&self.from_email)
            .destination(destination)
            .message(message)
            .send()
            .await
            .map_err(|e| AuthError::EmailDeliveryFailed(e.to_string()))?;

        tracing::info!("OTP email sent successfully to {}", to_email);
        Ok(())
    }

    /// Send welcome email after successful registration
    pub async fn send_welcome_email(&self, to_email: &str, user_name: &str) -> AuthResult<()> {
        let subject = "Welcome to Appreciata!";
        let body_text = format!(
            "Hi {},\n\nWelcome to Appreciata! Your account has been created successfully.\n\nNext steps:\n1. Complete your profile information\n2. Set up your Stripe Express account\n3. Wait for admin approval\n\nOnce approved, you'll be able to accept payments from your supporters.\n\nBest regards,\nThe Appreciata Team",
            user_name
        );

        let destination = Destination::builder()
            .to_addresses(to_email)
            .build();

        let subject_content = Content::builder()
            .data(subject)
            .charset("UTF-8")
            .build()
            .map_err(|e| AuthError::SESError(e.to_string()))?;

        let text_content = Content::builder()
            .data(body_text)
            .charset("UTF-8")
            .build()
            .map_err(|e| AuthError::SESError(e.to_string()))?;

        let body = Body::builder()
            .text(text_content)
            .build();

        let message = Message::builder()
            .subject(subject_content)
            .body(body)
            .build();

        self.client
            .send_email()
            .source(&self.from_email)
            .destination(destination)
            .message(message)
            .send()
            .await
            .map_err(|e| AuthError::EmailDeliveryFailed(e.to_string()))?;

        tracing::info!("Welcome email sent successfully to {}", to_email);
        Ok(())
    }
}