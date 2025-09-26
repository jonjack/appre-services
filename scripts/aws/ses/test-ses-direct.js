#!/usr/bin/env node

/**
 * Test script for SES email templates directly (bypassing Lambda/SQS)
 * This script sends emails directly via SES to test template functionality
 * 
 * Usage: node test-ses-direct.js [environment] [template-type] [recipient]
 * 
 * Examples:
 *   node test-ses-direct.js test otp test@example.com
 *   node test-ses-direct.js test all test@example.com
 *   node test-ses-direct.js prod welcome user@company.com
 */

const { SESv2Client, SendEmailCommand, ListEmailTemplatesCommand } = require('@aws-sdk/client-sesv2');

async function testSESDirect(environment = 'test', templateType = 'all', recipient = 'test@example.com') {
  const client = new SESv2Client({ region: process.env.SES_REGION || 'eu-west-2' });

  try {
    const appName = process.env.APP_NAME || 'appre';
    const fromEmail = process.env.FROM_EMAIL || 'noreply@appreciata.com';
    //const fromEmail = process.env.FROM_EMAIL || 'dev@appreciata.com';

    console.log(`📧 Testing SES Templates Directly`);
    console.log(`🌍 Environment: ${environment}`);
    console.log(`📨 From: ${fromEmail}`);
    console.log(`📬 To: ${recipient}`);
    console.log(`🧪 Template Type: ${templateType}`);

    // Define test templates with their data (using actual naming pattern)
    const testTemplates = {
      otp: {
        name: 'OTP Email',
        templateName: `${appName}-${environment}-otp`,
        subject: 'Your verification code',
        templateData: {
          otp: '123456'
        }
      },
      welcome: {
        name: 'Welcome Email',
        templateName: `${appName}-${environment}-welcome`,
        subject: 'Welcome to Appreciata!',
        templateData: {
          firstName: 'Test User',
          dashboardUrl: 'https://app.appreciata.com/dashboard'
        }
      },
      'complete-registration-user-info': {
        name: 'Complete Registration - User Info',
        templateName: `${appName}-${environment}-complete-registration-user-info`,
        subject: 'Complete your profile setup',
        templateData: {
          firstName: 'Test User',
          profileUrl: 'https://app.appreciata.com/profile',
          unsubscribeUrl: 'https://app.appreciata.com/unsubscribe?token=test123'
        }
      },
      'complete-registration-stripe': {
        name: 'Complete Registration - Stripe',
        templateName: `${appName}-${environment}-complete-registration-stripe`,
        subject: 'Set up your payment account',
        templateData: {
          firstName: 'Test User',
          stripeSetupUrl: 'https://app.appreciata.com/stripe-setup',
          unsubscribeUrl: 'https://app.appreciata.com/unsubscribe?token=test123'
        }
      },
      newsletter: {
        name: 'Newsletter',
        templateName: `${appName}-${environment}-newsletter`,
        subject: 'Appreciata Newsletter',
        templateData: {
          subject: 'Welcome to Appreciata Newsletter',
          content: 'This is a test newsletter with exciting updates about our platform!',
          unsubscribeUrl: 'https://app.appreciata.com/unsubscribe?token=test123',
          ctaText: 'Visit Dashboard',
          ctaUrl: 'https://app.appreciata.com/dashboard'
        }
      }
    };

    // First, let's list available templates to verify they exist
    console.log('\n🔍 Checking available SES templates...');
    try {
      const listCommand = new ListEmailTemplatesCommand({});
      const templates = await client.send(listCommand);

      const availableTemplates = templates.TemplatesMetadata?.map(t => t.TemplateName) || [];
      console.log(`✅ Found ${availableTemplates.length} templates:`, availableTemplates.join(', '));

      // Filter test templates to only those that exist
      const existingTestTemplates = Object.entries(testTemplates).filter(([key, template]) =>
        availableTemplates.includes(template.templateName)
      );

      if (existingTestTemplates.length === 0) {
        console.log('❌ No matching templates found for this environment');
        console.log('💡 Make sure templates are deployed. Expected pattern: appre-{env}-{template}');
        return;
      }

      console.log(`📋 Will test ${existingTestTemplates.length} existing templates\n`);

    } catch (error) {
      console.log('⚠️  Could not list templates, proceeding with test anyway...\n');
    }

    // Determine which templates to test
    const templatesToTest = templateType === 'all'
      ? Object.entries(testTemplates)
      : templateType.split(',').map(type => [type.trim(), testTemplates[type.trim()]]).filter(([_, template]) => template);

    if (templatesToTest.length === 0) {
      console.error(`❌ Invalid template type: ${templateType}`);
      console.log(`Available types: ${Object.keys(testTemplates).join(', ')}, all`);
      process.exit(1);
    }

    console.log(`🚀 Sending ${templatesToTest.length} test email(s)...\n`);

    // Send test emails
    for (const [templateKey, template] of templatesToTest) {
      console.log(`📤 Sending: ${template.name}`);
      console.log(`   Template: ${template.templateName}`);
      console.log(`   Subject: ${template.subject}`);
      console.log(`   Data: ${JSON.stringify(template.templateData, null, 2)}`);

      try {
        const sendCommand = new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: {
            ToAddresses: [recipient]
          },
          Content: {
            Template: {
              TemplateName: template.templateName,
              TemplateData: JSON.stringify(template.templateData)
            }
          }
        });

        const result = await client.send(sendCommand);
        console.log(`   ✅ Message ID: ${result.MessageId}\n`);

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);

        if (error.name === 'TemplateDoesNotExistException') {
          console.log(`   💡 Template ${template.templateName} doesn't exist - deploy templates first`);
        } else if (error.name === 'MessageRejected') {
          console.log(`   💡 Message rejected - check SES sandbox mode or email verification`);
        }
        console.log('');
      }
    }

    console.log('🎉 SES direct testing completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Check recipient email inbox');
    console.log('2. Monitor SES sending statistics:');
    console.log('   aws sesv2 get-account-sending-enabled --region eu-west-2');
    console.log('3. Check SES reputation dashboard in AWS console');
    console.log('4. If emails not received, check:');
    console.log('   - SES sandbox mode (production only)');
    console.log('   - Email verification status');
    console.log('   - Spam/junk folders');

  } catch (error) {
    console.error('❌ Error testing SES directly:', error.message);

    if (error.name === 'UnauthorizedOperation') {
      console.log('\n💡 Troubleshooting:');
      console.log('- Check AWS credentials and permissions');
      console.log('- Ensure SES permissions are configured');
    }

    process.exit(1);
  }
}

// Parse command line arguments
const environment = process.argv[2] || 'test';
const templateType = process.argv[3] || 'all';
const recipient = process.argv[4] || 'test@example.com';

// Validate environment
if (!['test', 'prod'].includes(environment)) {
  console.error('❌ Invalid environment. Use "test" or "prod"');
  process.exit(1);
}

// Validate email format (basic check)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipient)) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

// Run the test
testSESDirect(environment, templateType, recipient);