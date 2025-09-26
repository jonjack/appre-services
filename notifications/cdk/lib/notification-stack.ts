import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { loadEnvironmentConfig, ResourceNames, TagBuilder, SERVICE_DOMAINS } from '../../../shared/cdk-utils/src';

interface NotificationStackProps extends cdk.StackProps {
  environment: string;
}

/**
 * Notification Stack for Appre Platform
 * 
 * This stack provides email notification infrastructure for content creators
 * using templated emails and asynchronous processing via SQS queues.
 * 
 * AWS Services Included:
 * - Amazon SES: Email delivery service with pre-defined templates (5 templates)
 * - Amazon SQS: Message queuing for reliable email processing (2 queues)
 * - AWS Lambda: Email processor for handling queued email requests (1 function)
 * - AWS IAM: Roles and policies for secure service interactions
 * 
 * Email Templates:
 * - OTP Email: One-time password verification codes
 * - Welcome Email: New user onboarding messages
 * - Complete Registration (User Info): Profile completion reminders
 * - Complete Registration (Stripe): Payment setup reminders
 * - Newsletter: General communication and updates
 * 
 * Key Features:
 * - Asynchronous email processing with retry logic
 * - Dead letter queue for failed email deliveries
 * - Template-based emails for consistent branding
 * - Environment-based resource tagging and security
 * - Scalable queue-based architecture
 */
export class NotificationStack extends cdk.Stack {
  public otpTemplate: ses.CfnTemplate;
  public welcomeTemplate: ses.CfnTemplate;
  public completeRegistrationUserInfoTemplate: ses.CfnTemplate;
  public completeRegistrationStripeTemplate: ses.CfnTemplate;
  public newsletterTemplate: ses.CfnTemplate;
  public emailQueue: sqs.Queue;
  public emailProcessor: lambda.Function;

  private config: ReturnType<typeof loadEnvironmentConfig>;
  private resourceNames: ResourceNames;
  private tagBuilder: TagBuilder;

  constructor(scope: Construct, id: string, props: NotificationStackProps) {
    super(scope, id, props);

    // Load configuration and initialize utilities
    this.config = loadEnvironmentConfig('../../../');
    this.resourceNames = new ResourceNames(this.config);
    this.tagBuilder = new TagBuilder(this.config, SERVICE_DOMAINS.NOTIFICATIONS);

    // Apply global tags to the stack
    const globalTags = this.tagBuilder.getBaseTags();
    Object.entries(globalTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Create SES email templates
    this.createSESTemplates();

    // Create email processing queue and Lambda
    this.createEmailQueue();

    // Outputs
    this.createOutputs();
  }

  private createSESTemplates() {
    // OTP Email Template
    this.otpTemplate = new ses.CfnTemplate(this, 'OTPTemplate', {
      template: {
        templateName: this.resourceNames.sesTemplate('otp'),
        subjectPart: 'Your verification code',
        htmlPart: `
          <html>
            <body>
              <h2>Your verification code</h2>
              <p>Your verification code is: <strong>{{otp}}</strong></p>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </body>
          </html>
        `,
        textPart: `
          Your verification code is: {{otp}}
          
          This code will expire in 10 minutes.
          
          If you didn't request this code, please ignore this email.
        `,
      },
    });

    // Apply tags to OTP template
    const otpTags = this.tagBuilder.getSesTags('otp');
    Object.entries(otpTags).forEach(([key, value]) => {
      cdk.Tags.of(this.otpTemplate).add(key, value);
    });

    // Welcome Email Template
    this.welcomeTemplate = new ses.CfnTemplate(this, 'WelcomeTemplate', {
      template: {
        templateName: this.resourceNames.sesTemplate('welcome'),
        subjectPart: 'Welcome to Appre!',
        htmlPart: `
          <html>
            <body>
              <h2>Welcome to Appre, {{firstName}}!</h2>
              <p>Thank you for joining our platform for content creators.</p>
              <p>You can now start accepting payments from your audience.</p>
              <p>Get started by completing your profile and setting up your payment preferences.</p>
              <p><a href="{{dashboardUrl}}">Go to Dashboard</a></p>
            </body>
          </html>
        `,
        textPart: `
          Welcome to Appre, {{firstName}}!
          
          Thank you for joining our platform for content creators.
          
          You can now start accepting payments from your audience.
          
          Get started by completing your profile and setting up your payment preferences.
          
          Dashboard: {{dashboardUrl}}
        `,
      },
    });

    // Apply tags to welcome template
    const welcomeTags = this.tagBuilder.getSesTags('welcome');
    Object.entries(welcomeTags).forEach(([key, value]) => {
      cdk.Tags.of(this.welcomeTemplate).add(key, value);
    });

    // Complete Registration User Info Template
    this.completeRegistrationUserInfoTemplate = new ses.CfnTemplate(this, 'CompleteRegistrationUserInfoTemplate', {
      template: {
        templateName: this.resourceNames.sesTemplate('complete-registration-user-info'),
        subjectPart: 'Complete your Appre profile',
        htmlPart: `
          <html>
            <body>
              <h2>Complete your profile</h2>
              <p>Hi {{firstName}},</p>
              <p>To start receiving payments, please complete your profile information.</p>
              <p><a href="{{profileUrl}}">Complete Profile</a></p>
              <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
            </body>
          </html>
        `,
        textPart: `
          Complete your profile
          
          Hi {{firstName}},
          
          To start receiving payments, please complete your profile information.
          
          Complete Profile: {{profileUrl}}
          
          Unsubscribe: {{unsubscribeUrl}}
        `,
      },
    });

    // Apply tags to complete registration user info template
    const completeRegUserInfoTags = this.tagBuilder.getSesTags('complete-registration-user-info');
    Object.entries(completeRegUserInfoTags).forEach(([key, value]) => {
      cdk.Tags.of(this.completeRegistrationUserInfoTemplate).add(key, value);
    });

    // Complete Registration Stripe Template
    this.completeRegistrationStripeTemplate = new ses.CfnTemplate(this, 'CompleteRegistrationStripeTemplate', {
      template: {
        templateName: this.resourceNames.sesTemplate('complete-registration-stripe'),
        subjectPart: 'Set up your payment account',
        htmlPart: `
          <html>
            <body>
              <h2>Set up your payment account</h2>
              <p>Hi {{firstName}},</p>
              <p>To receive payments, please set up your Stripe account.</p>
              <p><a href="{{stripeSetupUrl}}">Set up Stripe Account</a></p>
              <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
            </body>
          </html>
        `,
        textPart: `
          Set up your payment account
          
          Hi {{firstName}},
          
          To receive payments, please set up your Stripe account.
          
          Set up Stripe Account: {{stripeSetupUrl}}
          
          Unsubscribe: {{unsubscribeUrl}}
        `,
      },
    });

    // Apply tags to complete registration stripe template
    const completeRegStripeTags = this.tagBuilder.getSesTags('complete-registration-stripe');
    Object.entries(completeRegStripeTags).forEach(([key, value]) => {
      cdk.Tags.of(this.completeRegistrationStripeTemplate).add(key, value);
    });

    // Newsletter Template
    this.newsletterTemplate = new ses.CfnTemplate(this, 'NewsletterTemplate', {
      template: {
        templateName: this.resourceNames.sesTemplate('newsletter'),
        subjectPart: '{{subject}}',
        htmlPart: `
          <html>
            <body>
              <h2>{{subject}}</h2>
              <div>{{content}}</div>
              {{#ctaText}}<p><a href="{{ctaUrl}}">{{ctaText}}</a></p>{{/ctaText}}
              <p><small>You're receiving this because you subscribed to updates from Appre.</small></p>
              <p><small><a href="{{unsubscribeUrl}}">Unsubscribe</a></small></p>
            </body>
          </html>
        `,
        textPart: `
          {{subject}}
          
          {{content}}
          
          {{#ctaText}}{{ctaText}}: {{ctaUrl}}{{/ctaText}}
          
          You're receiving this because you subscribed to updates from Appre.
          
          Unsubscribe: {{unsubscribeUrl}}
        `,
      },
    });

    // Apply tags to newsletter template
    const newsletterTags = this.tagBuilder.getSesTags('newsletter');
    Object.entries(newsletterTags).forEach(([key, value]) => {
      cdk.Tags.of(this.newsletterTemplate).add(key, value);
    });
  }

  private createEmailQueue() {
    // Dead Letter Queue
    const deadLetterQueue = new sqs.Queue(this, 'EmailDeadLetterQueue', {
      queueName: this.resourceNames.sqsQueue('email-dlq'),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Apply tags to dead letter queue
    const dlqTags = this.tagBuilder.getSqsTags('email-dlq');
    Object.entries(dlqTags).forEach(([key, value]) => {
      cdk.Tags.of(deadLetterQueue).add(key, value);
    });

    // Main Email Queue
    this.emailQueue = new sqs.Queue(this, 'EmailQueue', {
      queueName: this.resourceNames.sqsQueue('email-queue'),
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Apply tags to main email queue
    const queueTags = this.tagBuilder.getSqsTags('email-queue');
    Object.entries(queueTags).forEach(([key, value]) => {
      cdk.Tags.of(this.emailQueue).add(key, value);
    });

    // IAM role for email processor Lambda
    const emailProcessorRole = new iam.Role(this, 'EmailProcessorRole', {
      roleName: this.resourceNames.iamRole('email-processor-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Apply tags to IAM role
    const roleTags = this.tagBuilder.getIamTags('email-processor-role');
    Object.entries(roleTags).forEach(([key, value]) => {
      cdk.Tags.of(emailProcessorRole).add(key, value);
    });

    // Grant SES permissions with environment-based tag conditions
    emailProcessorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
        'ses:SendTemplatedEmail',
      ],
      resources: ['*'], // SES doesn't support resource-level permissions for sending
      conditions: {
        StringEquals: {
          'ses:FromAddress': 'noreply@appreciata.com',
        },
      },
    }));

    // Grant SES template access with environment-based tag conditions
    emailProcessorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:GetTemplate',
        'ses:ListTemplates',
      ],
      resources: [
        `arn:aws:ses:${this.region}:${this.account}:template/*`,
      ],
      conditions: {
        StringEquals: {
          'aws:ResourceTag/Environment': this.config.environment,
        },
      },
    }));

    // Grant SQS permissions with environment-based tag conditions
    emailProcessorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
      ],
      resources: [
        this.emailQueue.queueArn,
        deadLetterQueue.queueArn,
      ],
      conditions: {
        StringEquals: {
          'aws:ResourceTag/Environment': this.config.environment,
        },
      },
    }));

    // Email Processor Lambda
    this.emailProcessor = new lambda.Function(this, 'EmailProcessor', {
      functionName: this.resourceNames.lambda('email-processor'),
      runtime: lambda.Runtime.PROVIDED_AL2023,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../target/lambda/email-processor/'),
      role: emailProcessorRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        APP_NAME: this.config.appName,
        ENVIRONMENT: this.config.environment,
        FROM_EMAIL: 'noreply@appreciata.com',
        OTP_TEMPLATE_NAME: this.otpTemplate.ref,
        WELCOME_TEMPLATE_NAME: this.welcomeTemplate.ref,
        COMPLETE_REGISTRATION_USER_INFO_TEMPLATE_NAME: this.completeRegistrationUserInfoTemplate.ref,
        COMPLETE_REGISTRATION_STRIPE_TEMPLATE_NAME: this.completeRegistrationStripeTemplate.ref,
        NEWSLETTER_TEMPLATE_NAME: this.newsletterTemplate.ref,
        DEPLOYMENT_TIMESTAMP: Date.now().toString(),
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Apply tags to Lambda function
    const lambdaTags = this.tagBuilder.getLambdaTags('email-processor');
    Object.entries(lambdaTags).forEach(([key, value]) => {
      cdk.Tags.of(this.emailProcessor).add(key, value);
    });

    // Connect SQS to Lambda
    this.emailProcessor.addEventSource(new lambdaEventSources.SqsEventSource(this.emailQueue, {
      batchSize: 10,
    }));
  }

  private createOutputs() {
    // Template names for other stacks to reference
    new cdk.CfnOutput(this, 'OTPTemplateId', {
      value: this.otpTemplate.ref,
      description: 'SES Template ID for OTP emails',
      exportName: `${this.config.appName}-OTPTemplateId-${this.config.environment}`,
    });

    new cdk.CfnOutput(this, 'WelcomeTemplateId', {
      value: this.welcomeTemplate.ref,
      description: 'SES Template ID for welcome emails',
      exportName: `${this.config.appName}-WelcomeTemplateId-${this.config.environment}`,
    });

    new cdk.CfnOutput(this, 'CompleteRegistrationUserInfoTemplateId', {
      value: this.completeRegistrationUserInfoTemplate.ref,
      description: 'SES Template ID for complete registration user info emails',
      exportName: `${this.config.appName}-CompleteRegistrationUserInfoTemplateId-${this.config.environment}`,
    });

    new cdk.CfnOutput(this, 'CompleteRegistrationStripeTemplateId', {
      value: this.completeRegistrationStripeTemplate.ref,
      description: 'SES Template ID for complete registration Stripe emails',
      exportName: `${this.config.appName}-CompleteRegistrationStripeTemplateId-${this.config.environment}`,
    });

    new cdk.CfnOutput(this, 'NewsletterTemplateId', {
      value: this.newsletterTemplate.ref,
      description: 'SES Template ID for newsletter emails',
      exportName: `${this.config.appName}-NewsletterTemplateId-${this.config.environment}`,
    });

    new cdk.CfnOutput(this, 'EmailQueueUrl', {
      value: this.emailQueue.queueUrl,
      description: 'Email processing queue URL',
      exportName: `${this.config.appName}-EmailQueueUrl-${this.config.environment}`,
    });
  }
}