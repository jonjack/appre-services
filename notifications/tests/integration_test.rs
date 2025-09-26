// Integration test for email queue processing
// Run with: cargo test --test integration_test

use aws_config::BehaviorVersion;
use aws_sdk_sqs::{Client as SqsClient, types::MessageAttributeValue};
use notifications_shared::{EmailRequest, EmailPriority};
use std::collections::HashMap;
use std::env;

#[tokio::test]
async fn test_email_queue_integration() {
    // Load AWS config
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let sqs_client = SqsClient::new(&config);
    
    // Get queue name using correct naming pattern
    let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "test".to_string());
    let queue_name = format!("appre-{}-email-queue", environment);
    
    // Get queue URL
    let queue_url = sqs_client
        .get_queue_url()
        .queue_name(&queue_name)
        .send()
        .await
        .expect("Failed to get queue URL")
        .queue_url
        .expect("Queue URL not found");
    
    println!("Testing queue: {}", queue_url);
    
    // Create test email request with correct variable names
    let mut template_data = HashMap::new();
    template_data.insert("otp".to_string(), "123456".to_string());
    
    let email_request = EmailRequest {
        template_name: "otp".to_string(), // Using base template name - environment suffix will be added automatically
        recipient: "dev@appreciata.com".to_string(), // Use verified email
        template_data,
        priority: EmailPriority::High,
        reply_to: None,
        from_address: None,
    };
    
    // Serialize to JSON
    let message_body = serde_json::to_string(&email_request)
        .expect("Failed to serialize email request");
    
    // Send message to queue
    let result = sqs_client
        .send_message()
        .queue_url(&queue_url)
        .message_body(&message_body)
        .message_attributes(
            "email_type",
            MessageAttributeValue::builder()
                .data_type("String")
                .string_value(&email_request.template_name)
                .build()
                .unwrap()
        )
        .send()
        .await
        .expect("Failed to send message");
    
    println!("Message sent successfully - ID: {:?}", result.message_id);
    
    // Wait a bit for processing
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    println!("Integration test completed - check CloudWatch logs for processing results");
}

#[tokio::test]
async fn test_welcome_email_integration() {
    // Load AWS config
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let sqs_client = SqsClient::new(&config);
    
    // Get queue name using correct naming pattern
    let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "test".to_string());
    let queue_name = format!("appre-{}-email-queue", environment);
    
    // Get queue URL
    let queue_url = sqs_client
        .get_queue_url()
        .queue_name(&queue_name)
        .send()
        .await
        .expect("Failed to get queue URL")
        .queue_url
        .expect("Queue URL not found");
    
    println!("Testing welcome email queue: {}", queue_url);
    
    // Create welcome email request using helper method
    let email_request = EmailRequest::welcome(
        "dev@appreciata.com".to_string(),
        "Integration Test User".to_string(),
        "https://app.appreciata.com/dashboard".to_string(),
    );
    
    // Serialize to JSON
    let message_body = serde_json::to_string(&email_request)
        .expect("Failed to serialize email request");
    
    // Send message to queue
    let result = sqs_client
        .send_message()
        .queue_url(&queue_url)
        .message_body(&message_body)
        .message_attributes(
            "email_type",
            MessageAttributeValue::builder()
                .data_type("String")
                .string_value(&email_request.template_name)
                .build()
                .unwrap()
        )
        .send()
        .await
        .expect("Failed to send message");
    
    println!("Welcome email message sent successfully - ID: {:?}", result.message_id);
    
    // Wait a bit for processing
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    println!("Welcome email integration test completed");
}