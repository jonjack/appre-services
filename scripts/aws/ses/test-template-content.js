#!/usr/bin/env node

/**
 * Test SES Template Content
 * This script tests templates by sending a simple email first, then template emails
 */

const { SESv2Client, SendEmailCommand, GetEmailTemplateCommand } = require('@aws-sdk/client-sesv2');

async function testTemplateContent(environment = 'test') {
  const client = new SESv2Client({ region: process.env.SES_REGION || 'eu-west-2' });
  const appName = process.env.APP_NAME || 'appre';
  const fromEmail = 'noreply@appreciata.com';
  const toEmail = 'dev@appreciata.com';
  
  try {
    console.log('🧪 Testing SES Template Content\n');
    
    // 1. First test a simple email (no template)
    console.log('📤 Step 1: Testing simple email (no template)...');
    try {
      const simpleEmailResult = await client.send(new SendEmailCommand({
        FromEmailAddress: fromEmail,
        Destination: {
          ToAddresses: [toEmail]
        },
        Content: {
          Simple: {
            Subject: {
              Data: 'Test Email - Simple',
              Charset: 'UTF-8'
            },
            Body: {
              Text: {
                Data: 'This is a simple test email to verify SES is working.',
                Charset: 'UTF-8'
              },
              Html: {
                Data: '<h1>Test Email</h1><p>This is a simple test email to verify SES is working.</p>',
                Charset: 'UTF-8'
              }
            }
          }
        }
      }));
      
      console.log(`✅ Simple email sent - Message ID: ${simpleEmailResult.MessageId}\n`);
      
    } catch (error) {
      console.log(`❌ Simple email failed: ${error.message}\n`);
      return;
    }
    
    // 2. Test template content
    const templateName = `${appName}-${environment}-otp`;
    console.log(`📋 Step 2: Checking template content for: ${templateName}`);
    
    try {
      const templateInfo = await client.send(new GetEmailTemplateCommand({
        TemplateName: templateName
      }));
      
      console.log('✅ Template found:');
      console.log(`   Subject: ${templateInfo.Subject || 'No subject'}`);
      console.log(`   HTML Part: ${templateInfo.HtmlPart ? 'Present' : 'Missing'}`);
      console.log(`   Text Part: ${templateInfo.TextPart ? 'Present' : 'Missing'}`);
      
      if (templateInfo.HtmlPart) {
        console.log(`   HTML Preview (first 200 chars): ${templateInfo.HtmlPart.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`❌ Could not get template: ${error.message}\n`);
      return;
    }
    
    // 3. Test template email with minimal data
    console.log('\n📤 Step 3: Testing template email with minimal data...');
    try {
      const templateEmailResult = await client.send(new SendEmailCommand({
        FromEmailAddress: fromEmail,
        Destination: {
          ToAddresses: [toEmail]
        },
        Content: {
          Template: {
            TemplateName: templateName,
            TemplateData: JSON.stringify({
              otp: '333333'
            })
          }
        }
      }));
      
      console.log(`✅ Template email sent - Message ID: ${templateEmailResult.MessageId}`);
      
    } catch (error) {
      console.log(`❌ Template email failed: ${error.message}`);
      
      if (error.message.includes('template data')) {
        console.log('💡 This might be a template data format issue');
      }
    }
    
    // 4. Test with different template data formats
    console.log('\n📤 Step 4: Testing with escaped JSON data...');
    try {
      const escapedResult = await client.send(new SendEmailCommand({
        FromEmailAddress: fromEmail,
        Destination: {
          ToAddresses: [toEmail]
        },
        Content: {
          Template: {
            TemplateName: templateName,
            TemplateData: '{"otp":"444444"}'  // Pre-stringified
          }
        }
      }));
      
      console.log(`✅ Escaped JSON template email sent - Message ID: ${escapedResult.MessageId}`);
      
    } catch (error) {
      console.log(`❌ Escaped JSON template email failed: ${error.message}`);
    }
    
    console.log('\n📋 Summary:');
    console.log('• Check your email inbox (including spam folder)');
    console.log('• Simple emails should arrive first');
    console.log('• Template emails should follow');
    console.log('• If only simple email arrives, there\'s a template issue');
    console.log('• If no emails arrive, check SES sending statistics');
    
    console.log('\n🔍 Next steps if emails still don\'t arrive:');
    console.log('1. Check SES sending statistics:');
    console.log('   aws sesv2 get-account --region eu-west-2');
    console.log('2. Check for bounces/complaints:');
    console.log('   aws sesv2 get-suppressed-destination --email-address dev@appreciata.com --region eu-west-2');
    console.log('3. Enable SES event publishing to track delivery');
    
  } catch (error) {
    console.error('❌ Error testing template content:', error.message);
  }
}

// Parse command line arguments
const environment = process.argv[2] || 'test';
testTemplateContent(environment);