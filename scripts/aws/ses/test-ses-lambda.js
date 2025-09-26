#!/usr/bin/env node

/**
 * Test script for SES Email processor Lambda via SQS queue
 * This script sends properly formatted EmailRequest messages \
 *                 to SQS to test the Lambda function
 * 
 * Usage: node test-ses-lambda.js [environment] [test-type]
 * 
 * Examples:
 *   node test-ses-lambda.js test otp
 *   node test-ses-lambda.js test all
 *   node test-ses-lambda.js prod welcome
 */

const { SQSClient, SendMessageCommand, GetQueueUrlCommand } = require('@aws-sdk/client-sqs');

async function testSESLambda(environment = 'test', testType = 'all') {
  const client = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-2' });
  
  try {
    // Use the actual naming pattern from AWS
    const appName = process.env.APP_NAME || 'appre';
    const queueName = `${appName}-${environment}-email-queue`;
    
    console.log(`📧 Testing SES Email Processor Lambda`);
    console.log(`🔗 Queue: ${queueName}`);
    console.log(`🌍 Environment: ${environment}`);
    console.log(`🧪 Test Type: ${testType}`);
    
    // Get queue URL
    const getUrlCommand = new GetQueueUrlCommand({ QueueName: queueName });
    const { QueueUrl } = await client.send(getUrlCommand);
    console.log(`✅ Queue URL: ${QueueUrl}`);
    
    // Define test messages using the Rust EmailRequest structure
    const testMessages = {
      otp: {
        name: 'OTP Email',
        emailRequest: {
          template_name: 'otp',
          recipient: 'dev@appreciata.com',
          template_data: {
            otp: '123456'
          },
          priority: 'High',
          reply_to: null,
          from_address: null
        }
      },
      welcome: {
        name: 'Welcome Email',
        emailRequest: {
          template_name: 'welcome',
          recipient: 'dev@appreciata.com',
          template_data: {
            firstName: 'Test User',
            dashboardUrl: 'https://app.appreciata.com/dashboard'
          },
          priority: 'Normal',
          reply_to: null,
          from_address: null
        }
      },
      'complete-registration-user-info': {
        name: 'Complete Registration - User Info',
        emailRequest: {
          template_name: 'complete-registration-user-info',
          recipient: 'dev@appreciata.com',
          template_data: {
            firstName: 'Test User',
            profileUrl: 'https://app.appreciata.com/profile',
            unsubscribeUrl: 'https://app.appreciata.com/unsubscribe?token=abc123'
          },
          priority: 'Normal',
          reply_to: null,
          from_address: null
        }
      },
      'complete-registration-stripe': {
        name: 'Complete Registration - Stripe',
        emailRequest: {
          template_name: 'complete-registration-stripe',
          recipient: 'dev@appreciata.com',
          template_data: {
            firstName: 'Test User',
            stripeSetupUrl: 'https://app.appreciata.com/stripe-setup',
            unsubscribeUrl: 'https://app.appreciata.com/unsubscribe?token=abc123'
          },
          priority: 'Normal',
          reply_to: null,
          from_address: null
        }
      },
      newsletter: {
        name: 'Newsletter',
        emailRequest: {
          template_name: 'newsletter',
          recipient: 'dev@appreciata.com',
          template_data: {
            subject: 'Welcome to Appreciata Newsletter',
            content: 'This is a test newsletter content with exciting updates!',
            unsubscribeUrl: 'https://app.appreciata.com/unsubscribe?token=abc123',
            ctaText: 'Visit Dashboard',
            ctaUrl: 'https://app.appreciata.com/dashboard'
          },
          priority: 'Low',
          reply_to: null,
          from_address: null
        }
      }
    };
    
    // Determine which tests to run
    const testsToRun = testType === 'all' 
      ? Object.entries(testMessages)
      : testType.split(',').map(type => [type.trim(), testMessages[type.trim()]]).filter(([_, test]) => test);
    
    if (testsToRun.length === 0) {
      console.error(`❌ Invalid test type: ${testType}`);
      console.log(`Available types: ${Object.keys(testMessages).join(', ')}, all`);
      process.exit(1);
    }
    
    console.log(`\n🚀 Sending ${testsToRun.length} test message(s)...\n`);
    
    // Send test messages
    for (const [testKey, test] of testsToRun) {
      console.log(`📤 Sending: ${test.name}`);
      console.log(`   Template: ${test.emailRequest.template_name}`);
      console.log(`   Priority: ${test.emailRequest.priority}`);
      console.log(`   Recipient: ${test.emailRequest.recipient}`);
      
      // Convert priority enum to string for message attributes
      const priorityValue = test.emailRequest.priority === 'High' ? '1' 
                          : test.emailRequest.priority === 'Normal' ? '2' 
                          : '3';
      
      const sendCommand = new SendMessageCommand({
        QueueUrl,
        MessageBody: JSON.stringify(test.emailRequest),
        MessageAttributes: {
          'Priority': {
            DataType: 'String',
            StringValue: priorityValue
          },
          'TemplateType': {
            DataType: 'String',
            StringValue: test.emailRequest.template_name
          }
        }
      });
      
      const result = await client.send(sendCommand);
      console.log(`   ✅ Message ID: ${result.MessageId}\n`);
    }
    
    console.log('🎉 All test messages sent successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Check CloudWatch logs for Lambda execution:');
    console.log(`   aws logs tail /aws/lambda/${appName}-${environment}-email-processor --follow`);
    console.log('2. Verify emails were sent in SES console');
    console.log('3. Check DLQ for any failed messages:');
    console.log(`   aws sqs receive-message --queue-url $(aws sqs get-queue-url --queue-name ${appName}-${environment}-email-dlq --query 'QueueUrl' --output text)`);
    console.log('4. Monitor SQS queue depth:');
    console.log(`   aws sqs get-queue-attributes --queue-url ${QueueUrl} --attribute-names ApproximateNumberOfMessages`);
    
  } catch (error) {
    console.error('❌ Error testing SES Lambda:', error.message);
    
    if (error.name === 'QueueDoesNotExist') {
      console.log('\n💡 Troubleshooting:');
      console.log('- Ensure the notifications service is deployed');
      console.log('- Check if the queue name pattern is correct');
      console.log('- Verify AWS credentials and region');
    }
    
    process.exit(1);
  }
}

// Parse command line arguments
const environment = process.argv[2] || 'test';
const testType = process.argv[3] || 'all';

// Validate environment
if (!['test', 'prod'].includes(environment)) {
  console.error('❌ Invalid environment. Use "test" or "prod"');
  process.exit(1);
}

// Run the test
testSESLambda(environment, testType);