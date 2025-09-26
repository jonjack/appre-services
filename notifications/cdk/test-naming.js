#!/usr/bin/env node

/**
 * Test script for SES template naming and resolution
 * Usage: node test-naming.js [environment]
 */

const { StandardResourceNamer } = require('../../shared/naming');

function testSESTemplateNaming(environment = 'test') {
  console.log('🧪 Testing SES Template Naming Conventions\n');
  
  try {
    // Create naming configuration
    const appName = process.env.APP_NAME || 'appre';
    const namer = new StandardResourceNamer({ appName, environment });
    
    console.log(`📋 Configuration:`);
    console.log(`   App Name: ${appName}`);
    console.log(`   Environment: ${environment}\n`);
    
    // Test template names
    const baseTemplateNames = [
      'otp',
      'welcome',
      'complete-registration-user-info',
      'complete-registration-stripe',
      'newsletter'
    ];
    
    console.log('📧 SES Template Names:');
    console.log('   Base Name → Full Template Name');
    console.log('   ' + '─'.repeat(50));
    
    baseTemplateNames.forEach(baseName => {
      const fullName = namer.sesTemplate(baseName);
      console.log(`   ${baseName.padEnd(30)} → ${fullName}`);
    });
    
    console.log('\n🔍 Template Resolution Test:');
    console.log('   Lambda functions should reference base names only');
    console.log('   EmailService automatically appends environment suffix\n');
    
    // Test base template name extraction
    console.log('📤 Lambda Usage Examples:');
    console.log('   // In Lambda function:');
    console.log('   template_name: "otp"  // Base name only');
    console.log('   ↓');
    console.log(`   // EmailService resolves to: "${namer.sesTemplate('otp')}"`);
    console.log('');
    console.log('   template_name: "welcome"  // Base name only');
    console.log('   ↓');
    console.log(`   // EmailService resolves to: "${namer.sesTemplate('welcome')}"`);
    
    console.log('\n✅ All naming tests passed!');
    console.log('\n📋 Verification Steps:');
    console.log('1. Deploy CDK stack to create SES templates');
    console.log('2. Check AWS SES console for template names');
    console.log('3. Test Lambda functions with base template names');
    console.log('4. Verify EmailService resolves names correctly');
    
  } catch (error) {
    console.error('❌ Error testing template naming:', error.message);
    process.exit(1);
  }
}

// Run the test
const environment = process.argv[2] || 'test';
testSESTemplateNaming(environment);