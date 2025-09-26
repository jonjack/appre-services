use aws_sdk_sqs::Client as SqsClient;
use crate::{EmailRequest, NotificationError, NotificationResult};

/// Service for queuing email requests
pub struct EmailQueueService {
    client: SqsClient,
    queue_url: String,
}

impl EmailQueueService {
    pub fn new(client: SqsClient, queue_url: String) -> Self {
        Self { client, queue_url }
    }

    /// Queue an email request for processing
    pub async fn queue_email(&self, request: EmailRequest) -> NotificationResult<String> {
        let message_body = serde_json::to_string(&request)
            .map_err(NotificationError::from)?;

        // Add message attributes for priority-based processing
        let priority_value = match request.priority {
            crate::EmailPriority::High => "1",
            crate::EmailPriority::Normal => "2", 
            crate::EmailPriority::Low => "3",
        };

        let result = self.client
            .send_message()
            .queue_url(&self.queue_url)
            .message_body(message_body)
            .message_attributes("Priority", 
                aws_sdk_sqs::types::MessageAttributeValue::builder()
                    .data_type("String")
                    .string_value(priority_value)
                    .build()
                    .map_err(|e| NotificationError::SQSError(e.to_string()))?
            )
            .message_attributes("TemplateType",
                aws_sdk_sqs::types::MessageAttributeValue::builder()
                    .data_type("String")
                    .string_value(&request.template_name)
                    .build()
                    .map_err(|e| NotificationError::SQSError(e.to_string()))?
            )
            .send()
            .await
            .map_err(|e| NotificationError::SQSError(e.to_string()))?;

        let message_id = result.message_id()
            .ok_or_else(|| NotificationError::SQSError("No message ID returned".to_string()))?;

        tracing::info!(
            "Queued email request - Message ID: {}, Template: {}, Recipient: {}", 
            message_id, 
            request.template_name, 
            request.recipient
        );

        Ok(message_id.to_string())
    }

    /// Queue multiple email requests in a batch
    pub async fn queue_emails_batch(&self, requests: Vec<EmailRequest>) -> NotificationResult<Vec<String>> {
        if requests.is_empty() {
            return Ok(vec![]);
        }

        if requests.len() > 10 {
            return Err(NotificationError::ConfigurationError(
                "SQS batch size cannot exceed 10 messages".to_string()
            ));
        }

        let mut entries = Vec::new();
        for (i, request) in requests.iter().enumerate() {
            let message_body = serde_json::to_string(request)
                .map_err(NotificationError::from)?;

            let priority_value = match request.priority {
                crate::EmailPriority::High => "1",
                crate::EmailPriority::Normal => "2",
                crate::EmailPriority::Low => "3",
            };

            let entry = aws_sdk_sqs::types::SendMessageBatchRequestEntry::builder()
                .id(format!("msg_{}", i))
                .message_body(message_body)
                .message_attributes("Priority",
                    aws_sdk_sqs::types::MessageAttributeValue::builder()
                        .data_type("String")
                        .string_value(priority_value)
                        .build()
                        .map_err(|e| NotificationError::SQSError(e.to_string()))?
                )
                .message_attributes("TemplateType",
                    aws_sdk_sqs::types::MessageAttributeValue::builder()
                        .data_type("String")
                        .string_value(&request.template_name)
                        .build()
                        .map_err(|e| NotificationError::SQSError(e.to_string()))?
                )
                .build()
                .map_err(|e| NotificationError::SQSError(e.to_string()))?;

            entries.push(entry);
        }

        let result = self.client
            .send_message_batch()
            .queue_url(&self.queue_url)
            .set_entries(Some(entries))
            .send()
            .await
            .map_err(|e| NotificationError::SQSError(e.to_string()))?;

        let mut message_ids = Vec::new();
        
        for success in result.successful {
            message_ids.push(success.message_id);
        }

        for failure in result.failed {
            tracing::error!(
                "Failed to queue email batch entry {}: {} - {}", 
                failure.id,
                failure.code,
                failure.message.unwrap_or_else(|| "Unknown error".to_string())
            );
        }

        tracing::info!("Queued {} emails in batch", message_ids.len());

        Ok(message_ids)
    }
}