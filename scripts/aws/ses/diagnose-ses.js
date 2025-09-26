#!/usr/bin/env node

/**
 * SES Diagnostic Script
 * Checks SES configuration, verified identities, and sandbox status
 */

const { SESv2Client, GetAccountCommand, ListEmailIdentitiesCommand, GetEmailIdentityCommand } = require('@aws-sdk/client-sesv2');

async function diagnoseSES() {
  const client = new SESv2Client({ region: process.env.SES_REGION || 'eu-west-2' });
  
  try {
    console.log('🔍 SES Diagnostic Report\n');
    
    // 1. Check account status
    console.log('📊 Account Status:');
    const accountInfo = await client.send(new GetAccountCommand({}));
    console.log(`   Production Access: ${accountInfo.ProductionAccessEnabled ? '✅ Enabled' : '❌ Sandbox Mode'}`);
    console.log(`   Sending Enabled: ${accountInfo.SendingEnabled ? '✅ Yes' : '❌ No'}`);
    console.log(`   Daily Quota: ${accountInfo.SendQuota.SentLast24Hours}/${accountInfo.SendQuota.Max24HourSend}`);
    console.log(`   Send Rate: ${accountInfo.SendQuota.MaxSendRate} emails/second`);
    console.log(`   Enforcement Status: ${accountInfo.EnforcementStatus}\n`);
    
    // 2. List verified identities
    console.log('📧 Verified Email Identities:');
    const identities = await client.send(new ListEmailIdentitiesCommand({}));
    
    if (!identities.EmailIdentities || identities.EmailIdentities.length === 0) {
      console.log('   ❌ No verified email identities found!');
      console.log('   💡 You need to verify at least your FROM address in SES console');
    } else {
      for (const identity of identities.EmailIdentities) {
        try {
          const details = await client.send(new GetEmailIdentityCommand({
            EmailIdentity: identity.IdentityName
          }));
          
          const verificationStatus = details.VerificationStatus || 'UNKNOWN';
          const statusIcon = verificationStatus === 'SUCCESS' ? '✅' : '❌';
          
          console.log(`   ${statusIcon} ${identity.IdentityName} (${identity.IdentityType}) - ${verificationStatus}`);
          
          if (details.DkimAttributes) {
            const dkimStatus = details.DkimAttributes.Status === 'SUCCESS' ? '✅' : '❌';
            console.log(`      DKIM: ${dkimStatus} ${details.DkimAttributes.Status}`);
          }
          
        } catch (error) {
          console.log(`   ❓ ${identity.IdentityName} - Could not get details`);
        }
      }
    }
    
    console.log('\n🚨 Sandbox Mode Restrictions:');
    if (!accountInfo.ProductionAccessEnabled) {
      console.log('   ⚠️  You are in SES Sandbox mode. This means:');
      console.log('   • You can only send TO verified email addresses');
      console.log('   • You can only send FROM verified email addresses');
      console.log('   • Limited to 200 emails per day');
      console.log('   • Limited to 1 email per second');
      console.log('\n   📝 To send to unverified recipients:');
      console.log('   1. Go to AWS SES Console');
      console.log('   2. Navigate to "Account dashboard"');
      console.log('   3. Click "Request production access"');
      console.log('   4. Fill out the form explaining your use case');
    } else {
      console.log('   ✅ Production access enabled - can send to any email');
    }
    
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Verify your FROM email address in SES console');
    console.log('2. If in sandbox, verify your recipient email address too');
    console.log('3. Check spam/junk folders');
    console.log('4. Monitor SES sending statistics for bounces/complaints');
    console.log('5. Check CloudWatch logs for any SES errors');
    
    console.log('\n📋 Quick Commands:');
    console.log('• Verify an email: aws sesv2 put-email-identity --email-identity your@email.com');
    console.log('• Check sending stats: aws sesv2 get-account --region eu-west-2');
    console.log('• Request production access: Use AWS SES Console');
    
  } catch (error) {
    console.error('❌ Error diagnosing SES:', error.message);
    
    if (error.name === 'UnauthorizedOperation') {
      console.log('\n💡 Make sure you have SES permissions in your AWS credentials');
    }
  }
}

diagnoseSES();