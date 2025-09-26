#!/usr/bin/env node

/**
 * Test script to validate IAM environment-based tag conditions
 * This script checks that IAM policies include proper environment-based conditions
 * 
 * Usage: node scripts/test-iam-security.js
 */

const fs = require('fs');
const path = require('path');

function testAuthenticationStack() {
  console.log('🔍 Testing Authentication Stack IAM Conditions...');
  
  const authStackPath = path.join(__dirname, '../authentication/cdk/lib/authentication-stack.ts');
  const content = fs.readFileSync(authStackPath, 'utf8');
  
  const tests = [
    {
      name: 'DynamoDB permissions have environment tag conditions',
      pattern: /aws:ResourceTag\/Environment.*this\.tagBuilder\.config\.environment/s,
      description: 'DynamoDB policy should include environment-based tag conditions'
    },
    {
      name: 'Cognito permissions have environment tag conditions',
      pattern: /cognito-idp:Admin.*aws:ResourceTag\/Environment/s,
      description: 'Cognito policy should include environment-based tag conditions'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    if (test.pattern.test(content)) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   ${test.description}`);
      failed++;
    }
  });
  
  return { passed, failed };
}

function testNotificationStack() {
  console.log('\n🔍 Testing Notification Stack IAM Conditions...');
  
  const notificationStackPath = path.join(__dirname, '../notifications/cdk/lib/notification-stack.ts');
  const content = fs.readFileSync(notificationStackPath, 'utf8');
  
  const tests = [
    {
      name: 'SES template permissions have environment tag conditions',
      pattern: /ses:GetTemplate.*aws:ResourceTag\/Environment/s,
      description: 'SES template policy should include environment-based tag conditions'
    },
    {
      name: 'SQS permissions have environment tag conditions',
      pattern: /sqs:ReceiveMessage.*aws:ResourceTag\/Environment/s,
      description: 'SQS policy should include environment-based tag conditions'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    if (test.pattern.test(content)) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   ${test.description}`);
      failed++;
    }
  });
  
  return { passed, failed };
}

function main() {
  console.log('🛡️  Testing IAM Environment-Based Tag Conditions\n');
  
  const authResults = testAuthenticationStack();
  const notificationResults = testNotificationStack();
  
  const totalPassed = authResults.passed + notificationResults.passed;
  const totalFailed = authResults.failed + notificationResults.failed;
  const totalTests = totalPassed + totalFailed;
  
  console.log('\n📊 Test Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All IAM environment-based tag condition tests passed!');
    console.log('\n📖 For more information, see: docs/iam-security-enhancements.md');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the IAM policies.');
    console.log('📖 For troubleshooting, see: docs/iam-security-enhancements.md');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}