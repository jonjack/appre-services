"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStack = void 0;
const cdk = require("aws-cdk-lib");
const ses = require("aws-cdk-lib/aws-ses");
const sqs = require("aws-cdk-lib/aws-sqs");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const lambdaEventSources = require("aws-cdk-lib/aws-lambda-event-sources");
const src_1 = require("../../../shared/cdk-utils/src");
class NotificationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Load configuration and initialize utilities
        this.config = (0, src_1.loadEnvironmentConfig)('../../../');
        this.resourceNames = new src_1.ResourceNames(this.config);
        this.tagBuilder = new src_1.TagBuilder(this.config, src_1.SERVICE_DOMAINS.NOTIFICATIONS);
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
    createSESTemplates() {
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
    createEmailQueue() {
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
            resources: ['*'],
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
    createOutputs() {
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
exports.NotificationStack = NotificationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90aWZpY2F0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm90aWZpY2F0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLGlEQUFpRDtBQUNqRCwyQ0FBMkM7QUFDM0MsMkVBQTJFO0FBRTNFLHVEQUFrSDtBQU1sSCxNQUFhLGlCQUFrQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBYTlDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNkI7UUFDckUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsOENBQThDO1FBQzlDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBQSwyQkFBcUIsRUFBQyxXQUFXLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksbUJBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLGdCQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxxQkFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRTdFLGlDQUFpQztRQUNqQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDO1FBRUgsNkJBQTZCO1FBQzdCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBRTFCLDJDQUEyQztRQUMzQyxJQUFJ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LWxpYic7XG5pbXBvcnQgKiBhcyBzZXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcyc7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGFFdmVudFNvdXJjZXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgbG9hZEVudmlyb25tZW50Q29uZmlnLCBSZXNvdXJjZU5hbWVzLCBUYWdCdWlsZGVyLCBTRVJWSUNFX0RPTUFJTlMgfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvY2RrLXV0aWxzL3NyYyc7XG5cbmludGVyZmFjZSBOb3RpZmljYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTm90aWZpY2F0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgb3RwVGVtcGxhdGU6IHNlcy5DZm5UZW1wbGF0ZTtcbiAgcHVibGljIHdlbGNvbWVUZW1wbGF0ZTogc2VzLkNmblRlbXBsYXRlO1xuICBwdWJsaWMgY29tcGxldGVSZWdpc3RyYXRpb25Vc2VySW5mb1RlbXBsYXRlOiBzZXMuQ2ZuVGVtcGxhdGU7XG4gIHB1YmxpYyBjb21wbGV0ZVJlZ2lzdHJhdGlvblN0cmlwZVRlbXBsYXRlOiBzZXMuQ2ZuVGVtcGxhdGU7XG4gIHB1YmxpYyBuZXdzbGV0dGVyVGVtcGxhdGU6IHNlcy5DZm5UZW1wbGF0ZTtcbiAgcHVibGljIGVtYWlsUXVldWU6IHNxcy5RdWV1ZTtcbiAgcHVibGljIGVtYWlsUHJvY2Vzc29yOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgcHJpdmF0ZSBjb25maWc6IFJldHVyblR5cGU8dHlwZW9mIGxvYWRFbnZpcm9ubWVudENvbmZpZz47XG4gIHByaXZhdGUgcmVzb3VyY2VOYW1lczogUmVzb3VyY2VOYW1lcztcbiAgcHJpdmF0ZSB0YWdCdWlsZGVyOiBUYWdCdWlsZGVyO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBOb3RpZmljYXRpb25TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBMb2FkIGNvbmZpZ3VyYXRpb24gYW5kIGluaXRpYWxpemUgdXRpbGl0aWVzXG4gICAgdGhpcy5jb25maWcgPSBsb2FkRW52aXJvbm1lbnRDb25maWcoJy4uLy4uLy4uLycpO1xuICAgIHRoaXMucmVzb3VyY2VOYW1lcyA9IG5ldyBSZXNvdXJjZU5hbWVzKHRoaXMuY29uZmlnKTtcbiAgICB0aGlzLnRhZ0J1aWxkZXIgPSBuZXcgVGFnQnVpbGRlcih0aGlzLmNvbmZpZywgU0VSVklDRV9ET01BSU5TLk5PVElGSUNBVElPTlMpO1xuXG4gICAgLy8gQXBwbHkgZ2xvYmFsIHRhZ3MgdG8gdGhlIHN0YWNrXG4gICAgY29uc3QgZ2xvYmFsVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRCYXNlVGFncygpO1xuICAgIE9iamVjdC5lbnRyaWVzKGdsb2JhbFRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFNFUyBlbWFpbCB0ZW1wbGF0ZXNcbiAgICB0aGlzLmNyZWF0ZVNFU1RlbXBsYXRlcygpO1xuXG4gICAgLy8gQ3JlYXRlIGVtYWlsIHByb2Nlc3NpbmcgcXVldWUgYW5kIExhbWJkYVxuICAgIHRoaXMuY3JlYXRlRW1haWxRdWV1ZSgpO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTRVNUZW1wbGF0ZXMoKSB7XG4gICAgLy8gT1RQIEVtYWlsIFRlbXBsYXRlXG4gICAgdGhpcy5vdHBUZW1wbGF0ZSA9IG5ldyBzZXMuQ2ZuVGVtcGxhdGUodGhpcywgJ09UUFRlbXBsYXRlJywge1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgdGVtcGxhdGVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuc2VzVGVtcGxhdGUoJ290cCcpLFxuICAgICAgICBzdWJqZWN0UGFydDogJ1lvdXIgdmVyaWZpY2F0aW9uIGNvZGUnLFxuICAgICAgICBodG1sUGFydDogYFxuICAgICAgICAgIDxodG1sPlxuICAgICAgICAgICAgPGJvZHk+XG4gICAgICAgICAgICAgIDxoMj5Zb3VyIHZlcmlmaWNhdGlvbiBjb2RlPC9oMj5cbiAgICAgICAgICAgICAgPHA+WW91ciB2ZXJpZmljYXRpb24gY29kZSBpczogPHN0cm9uZz57e290cH19PC9zdHJvbmc+PC9wPlxuICAgICAgICAgICAgICA8cD5UaGlzIGNvZGUgd2lsbCBleHBpcmUgaW4gMTAgbWludXRlcy48L3A+XG4gICAgICAgICAgICAgIDxwPklmIHlvdSBkaWRuJ3QgcmVxdWVzdCB0aGlzIGNvZGUsIHBsZWFzZSBpZ25vcmUgdGhpcyBlbWFpbC48L3A+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgICAgPC9odG1sPlxuICAgICAgICBgLFxuICAgICAgICB0ZXh0UGFydDogYFxuICAgICAgICAgIFlvdXIgdmVyaWZpY2F0aW9uIGNvZGUgaXM6IHt7b3RwfX1cbiAgICAgICAgICBcbiAgICAgICAgICBUaGlzIGNvZGUgd2lsbCBleHBpcmUgaW4gMTAgbWludXRlcy5cbiAgICAgICAgICBcbiAgICAgICAgICBJZiB5b3UgZGlkbid0IHJlcXVlc3QgdGhpcyBjb2RlLCBwbGVhc2UgaWdub3JlIHRoaXMgZW1haWwuXG4gICAgICAgIGAsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQXBwbHkgdGFncyB0byBPVFAgdGVtcGxhdGVcbiAgICBjb25zdCBvdHBUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldFNlc1RhZ3MoJ290cCcpO1xuICAgIE9iamVjdC5lbnRyaWVzKG90cFRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5vdHBUZW1wbGF0ZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gV2VsY29tZSBFbWFpbCBUZW1wbGF0ZVxuICAgIHRoaXMud2VsY29tZVRlbXBsYXRlID0gbmV3IHNlcy5DZm5UZW1wbGF0ZSh0aGlzLCAnV2VsY29tZVRlbXBsYXRlJywge1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgdGVtcGxhdGVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuc2VzVGVtcGxhdGUoJ3dlbGNvbWUnKSxcbiAgICAgICAgc3ViamVjdFBhcnQ6ICdXZWxjb21lIHRvIEFwcHJlIScsXG4gICAgICAgIGh0bWxQYXJ0OiBgXG4gICAgICAgICAgPGh0bWw+XG4gICAgICAgICAgICA8Ym9keT5cbiAgICAgICAgICAgICAgPGgyPldlbGNvbWUgdG8gQXBwcmUsIHt7Zmlyc3ROYW1lfX0hPC9oMj5cbiAgICAgICAgICAgICAgPHA+VGhhbmsgeW91IGZvciBqb2luaW5nIG91ciBwbGF0Zm9ybSBmb3IgY29udGVudCBjcmVhdG9ycy48L3A+XG4gICAgICAgICAgICAgIDxwPllvdSBjYW4gbm93IHN0YXJ0IGFjY2VwdGluZyBwYXltZW50cyBmcm9tIHlvdXIgYXVkaWVuY2UuPC9wPlxuICAgICAgICAgICAgICA8cD5HZXQgc3RhcnRlZCBieSBjb21wbGV0aW5nIHlvdXIgcHJvZmlsZSBhbmQgc2V0dGluZyB1cCB5b3VyIHBheW1lbnQgcHJlZmVyZW5jZXMuPC9wPlxuICAgICAgICAgICAgICA8cD48YSBocmVmPVwie3tkYXNoYm9hcmRVcmx9fVwiPkdvIHRvIERhc2hib2FyZDwvYT48L3A+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgICAgPC9odG1sPlxuICAgICAgICBgLFxuICAgICAgICB0ZXh0UGFydDogYFxuICAgICAgICAgIFdlbGNvbWUgdG8gQXBwcmUsIHt7Zmlyc3ROYW1lfX0hXG4gICAgICAgICAgXG4gICAgICAgICAgVGhhbmsgeW91IGZvciBqb2luaW5nIG91ciBwbGF0Zm9ybSBmb3IgY29udGVudCBjcmVhdG9ycy5cbiAgICAgICAgICBcbiAgICAgICAgICBZb3UgY2FuIG5vdyBzdGFydCBhY2NlcHRpbmcgcGF5bWVudHMgZnJvbSB5b3VyIGF1ZGllbmNlLlxuICAgICAgICAgIFxuICAgICAgICAgIEdldCBzdGFydGVkIGJ5IGNvbXBsZXRpbmcgeW91ciBwcm9maWxlIGFuZCBzZXR0aW5nIHVwIHlvdXIgcGF5bWVudCBwcmVmZXJlbmNlcy5cbiAgICAgICAgICBcbiAgICAgICAgICBEYXNoYm9hcmQ6IHt7ZGFzaGJvYXJkVXJsfX1cbiAgICAgICAgYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIHdlbGNvbWUgdGVtcGxhdGVcbiAgICBjb25zdCB3ZWxjb21lVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRTZXNUYWdzKCd3ZWxjb21lJyk7XG4gICAgT2JqZWN0LmVudHJpZXMod2VsY29tZVRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy53ZWxjb21lVGVtcGxhdGUpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIENvbXBsZXRlIFJlZ2lzdHJhdGlvbiBVc2VyIEluZm8gVGVtcGxhdGVcbiAgICB0aGlzLmNvbXBsZXRlUmVnaXN0cmF0aW9uVXNlckluZm9UZW1wbGF0ZSA9IG5ldyBzZXMuQ2ZuVGVtcGxhdGUodGhpcywgJ0NvbXBsZXRlUmVnaXN0cmF0aW9uVXNlckluZm9UZW1wbGF0ZScsIHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIHRlbXBsYXRlTmFtZTogdGhpcy5yZXNvdXJjZU5hbWVzLnNlc1RlbXBsYXRlKCdjb21wbGV0ZS1yZWdpc3RyYXRpb24tdXNlci1pbmZvJyksXG4gICAgICAgIHN1YmplY3RQYXJ0OiAnQ29tcGxldGUgeW91ciBBcHByZSBwcm9maWxlJyxcbiAgICAgICAgaHRtbFBhcnQ6IGBcbiAgICAgICAgICA8aHRtbD5cbiAgICAgICAgICAgIDxib2R5PlxuICAgICAgICAgICAgICA8aDI+Q29tcGxldGUgeW91ciBwcm9maWxlPC9oMj5cbiAgICAgICAgICAgICAgPHA+SGkge3tmaXJzdE5hbWV9fSw8L3A+XG4gICAgICAgICAgICAgIDxwPlRvIHN0YXJ0IHJlY2VpdmluZyBwYXltZW50cywgcGxlYXNlIGNvbXBsZXRlIHlvdXIgcHJvZmlsZSBpbmZvcm1hdGlvbi48L3A+XG4gICAgICAgICAgICAgIDxwPjxhIGhyZWY9XCJ7e3Byb2ZpbGVVcmx9fVwiPkNvbXBsZXRlIFByb2ZpbGU8L2E+PC9wPlxuICAgICAgICAgICAgICA8cD48YSBocmVmPVwie3t1bnN1YnNjcmliZVVybH19XCI+VW5zdWJzY3JpYmU8L2E+PC9wPlxuICAgICAgICAgICAgPC9ib2R5PlxuICAgICAgICAgIDwvaHRtbD5cbiAgICAgICAgYCxcbiAgICAgICAgdGV4dFBhcnQ6IGBcbiAgICAgICAgICBDb21wbGV0ZSB5b3VyIHByb2ZpbGVcbiAgICAgICAgICBcbiAgICAgICAgICBIaSB7e2ZpcnN0TmFtZX19LFxuICAgICAgICAgIFxuICAgICAgICAgIFRvIHN0YXJ0IHJlY2VpdmluZyBwYXltZW50cywgcGxlYXNlIGNvbXBsZXRlIHlvdXIgcHJvZmlsZSBpbmZvcm1hdGlvbi5cbiAgICAgICAgICBcbiAgICAgICAgICBDb21wbGV0ZSBQcm9maWxlOiB7e3Byb2ZpbGVVcmx9fVxuICAgICAgICAgIFxuICAgICAgICAgIFVuc3Vic2NyaWJlOiB7e3Vuc3Vic2NyaWJlVXJsfX1cbiAgICAgICAgYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIGNvbXBsZXRlIHJlZ2lzdHJhdGlvbiB1c2VyIGluZm8gdGVtcGxhdGVcbiAgICBjb25zdCBjb21wbGV0ZVJlZ1VzZXJJbmZvVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRTZXNUYWdzKCdjb21wbGV0ZS1yZWdpc3RyYXRpb24tdXNlci1pbmZvJyk7XG4gICAgT2JqZWN0LmVudHJpZXMoY29tcGxldGVSZWdVc2VySW5mb1RhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5jb21wbGV0ZVJlZ2lzdHJhdGlvblVzZXJJbmZvVGVtcGxhdGUpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIENvbXBsZXRlIFJlZ2lzdHJhdGlvbiBTdHJpcGUgVGVtcGxhdGVcbiAgICB0aGlzLmNvbXBsZXRlUmVnaXN0cmF0aW9uU3RyaXBlVGVtcGxhdGUgPSBuZXcgc2VzLkNmblRlbXBsYXRlKHRoaXMsICdDb21wbGV0ZVJlZ2lzdHJhdGlvblN0cmlwZVRlbXBsYXRlJywge1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgdGVtcGxhdGVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuc2VzVGVtcGxhdGUoJ2NvbXBsZXRlLXJlZ2lzdHJhdGlvbi1zdHJpcGUnKSxcbiAgICAgICAgc3ViamVjdFBhcnQ6ICdTZXQgdXAgeW91ciBwYXltZW50IGFjY291bnQnLFxuICAgICAgICBodG1sUGFydDogYFxuICAgICAgICAgIDxodG1sPlxuICAgICAgICAgICAgPGJvZHk+XG4gICAgICAgICAgICAgIDxoMj5TZXQgdXAgeW91ciBwYXltZW50IGFjY291bnQ8L2gyPlxuICAgICAgICAgICAgICA8cD5IaSB7e2ZpcnN0TmFtZX19LDwvcD5cbiAgICAgICAgICAgICAgPHA+VG8gcmVjZWl2ZSBwYXltZW50cywgcGxlYXNlIHNldCB1cCB5b3VyIFN0cmlwZSBhY2NvdW50LjwvcD5cbiAgICAgICAgICAgICAgPHA+PGEgaHJlZj1cInt7c3RyaXBlU2V0dXBVcmx9fVwiPlNldCB1cCBTdHJpcGUgQWNjb3VudDwvYT48L3A+XG4gICAgICAgICAgICAgIDxwPjxhIGhyZWY9XCJ7e3Vuc3Vic2NyaWJlVXJsfX1cIj5VbnN1YnNjcmliZTwvYT48L3A+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgICAgPC9odG1sPlxuICAgICAgICBgLFxuICAgICAgICB0ZXh0UGFydDogYFxuICAgICAgICAgIFNldCB1cCB5b3VyIHBheW1lbnQgYWNjb3VudFxuICAgICAgICAgIFxuICAgICAgICAgIEhpIHt7Zmlyc3ROYW1lfX0sXG4gICAgICAgICAgXG4gICAgICAgICAgVG8gcmVjZWl2ZSBwYXltZW50cywgcGxlYXNlIHNldCB1cCB5b3VyIFN0cmlwZSBhY2NvdW50LlxuICAgICAgICAgIFxuICAgICAgICAgIFNldCB1cCBTdHJpcGUgQWNjb3VudDoge3tzdHJpcGVTZXR1cFVybH19XG4gICAgICAgICAgXG4gICAgICAgICAgVW5zdWJzY3JpYmU6IHt7dW5zdWJzY3JpYmVVcmx9fVxuICAgICAgICBgLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFwcGx5IHRhZ3MgdG8gY29tcGxldGUgcmVnaXN0cmF0aW9uIHN0cmlwZSB0ZW1wbGF0ZVxuICAgIGNvbnN0IGNvbXBsZXRlUmVnU3RyaXBlVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRTZXNUYWdzKCdjb21wbGV0ZS1yZWdpc3RyYXRpb24tc3RyaXBlJyk7XG4gICAgT2JqZWN0LmVudHJpZXMoY29tcGxldGVSZWdTdHJpcGVUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMuY29tcGxldGVSZWdpc3RyYXRpb25TdHJpcGVUZW1wbGF0ZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gTmV3c2xldHRlciBUZW1wbGF0ZVxuICAgIHRoaXMubmV3c2xldHRlclRlbXBsYXRlID0gbmV3IHNlcy5DZm5UZW1wbGF0ZSh0aGlzLCAnTmV3c2xldHRlclRlbXBsYXRlJywge1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgdGVtcGxhdGVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuc2VzVGVtcGxhdGUoJ25ld3NsZXR0ZXInKSxcbiAgICAgICAgc3ViamVjdFBhcnQ6ICd7e3N1YmplY3R9fScsXG4gICAgICAgIGh0bWxQYXJ0OiBgXG4gICAgICAgICAgPGh0bWw+XG4gICAgICAgICAgICA8Ym9keT5cbiAgICAgICAgICAgICAgPGgyPnt7c3ViamVjdH19PC9oMj5cbiAgICAgICAgICAgICAgPGRpdj57e2NvbnRlbnR9fTwvZGl2PlxuICAgICAgICAgICAgICB7eyNjdGFUZXh0fX08cD48YSBocmVmPVwie3tjdGFVcmx9fVwiPnt7Y3RhVGV4dH19PC9hPjwvcD57ey9jdGFUZXh0fX1cbiAgICAgICAgICAgICAgPHA+PHNtYWxsPllvdSdyZSByZWNlaXZpbmcgdGhpcyBiZWNhdXNlIHlvdSBzdWJzY3JpYmVkIHRvIHVwZGF0ZXMgZnJvbSBBcHByZS48L3NtYWxsPjwvcD5cbiAgICAgICAgICAgICAgPHA+PHNtYWxsPjxhIGhyZWY9XCJ7e3Vuc3Vic2NyaWJlVXJsfX1cIj5VbnN1YnNjcmliZTwvYT48L3NtYWxsPjwvcD5cbiAgICAgICAgICAgIDwvYm9keT5cbiAgICAgICAgICA8L2h0bWw+XG4gICAgICAgIGAsXG4gICAgICAgIHRleHRQYXJ0OiBgXG4gICAgICAgICAge3tzdWJqZWN0fX1cbiAgICAgICAgICBcbiAgICAgICAgICB7e2NvbnRlbnR9fVxuICAgICAgICAgIFxuICAgICAgICAgIHt7I2N0YVRleHR9fXt7Y3RhVGV4dH19OiB7e2N0YVVybH19e3svY3RhVGV4dH19XG4gICAgICAgICAgXG4gICAgICAgICAgWW91J3JlIHJlY2VpdmluZyB0aGlzIGJlY2F1c2UgeW91IHN1YnNjcmliZWQgdG8gdXBkYXRlcyBmcm9tIEFwcHJlLlxuICAgICAgICAgIFxuICAgICAgICAgIFVuc3Vic2NyaWJlOiB7e3Vuc3Vic2NyaWJlVXJsfX1cbiAgICAgICAgYCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIG5ld3NsZXR0ZXIgdGVtcGxhdGVcbiAgICBjb25zdCBuZXdzbGV0dGVyVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRTZXNUYWdzKCduZXdzbGV0dGVyJyk7XG4gICAgT2JqZWN0LmVudHJpZXMobmV3c2xldHRlclRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5uZXdzbGV0dGVyVGVtcGxhdGUpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRW1haWxRdWV1ZSgpIHtcbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZVxuICAgIGNvbnN0IGRlYWRMZXR0ZXJRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ0VtYWlsRGVhZExldHRlclF1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuc3FzUXVldWUoJ2VtYWlsLWRscScpLFxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIGRlYWQgbGV0dGVyIHF1ZXVlXG4gICAgY29uc3QgZGxxVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRTcXNUYWdzKCdlbWFpbC1kbHEnKTtcbiAgICBPYmplY3QuZW50cmllcyhkbHFUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKGRlYWRMZXR0ZXJRdWV1ZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gTWFpbiBFbWFpbCBRdWV1ZVxuICAgIHRoaXMuZW1haWxRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ0VtYWlsUXVldWUnLCB7XG4gICAgICBxdWV1ZU5hbWU6IHRoaXMucmVzb3VyY2VOYW1lcy5zcXNRdWV1ZSgnZW1haWwtcXVldWUnKSxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgIHF1ZXVlOiBkZWFkTGV0dGVyUXVldWUsXG4gICAgICAgIG1heFJlY2VpdmVDb3VudDogMyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIG1haW4gZW1haWwgcXVldWVcbiAgICBjb25zdCBxdWV1ZVRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0U3FzVGFncygnZW1haWwtcXVldWUnKTtcbiAgICBPYmplY3QuZW50cmllcyhxdWV1ZVRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5lbWFpbFF1ZXVlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBJQU0gcm9sZSBmb3IgZW1haWwgcHJvY2Vzc29yIExhbWJkYVxuICAgIGNvbnN0IGVtYWlsUHJvY2Vzc29yUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRW1haWxQcm9jZXNzb3JSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IHRoaXMucmVzb3VyY2VOYW1lcy5pYW1Sb2xlKCdlbWFpbC1wcm9jZXNzb3Itcm9sZScpLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQXBwbHkgdGFncyB0byBJQU0gcm9sZVxuICAgIGNvbnN0IHJvbGVUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldElhbVRhZ3MoJ2VtYWlsLXByb2Nlc3Nvci1yb2xlJyk7XG4gICAgT2JqZWN0LmVudHJpZXMocm9sZVRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YoZW1haWxQcm9jZXNzb3JSb2xlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBTRVMgcGVybWlzc2lvbnMgd2l0aCBlbnZpcm9ubWVudC1iYXNlZCB0YWcgY29uZGl0aW9uc1xuICAgIGVtYWlsUHJvY2Vzc29yUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzZXM6U2VuZEVtYWlsJyxcbiAgICAgICAgJ3NlczpTZW5kUmF3RW1haWwnLFxuICAgICAgICAnc2VzOlNlbmRUZW1wbGF0ZWRFbWFpbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gU0VTIGRvZXNuJ3Qgc3VwcG9ydCByZXNvdXJjZS1sZXZlbCBwZXJtaXNzaW9ucyBmb3Igc2VuZGluZ1xuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnc2VzOkZyb21BZGRyZXNzJzogJ25vcmVwbHlAYXBwcmVjaWF0YS5jb20nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICAvLyBHcmFudCBTRVMgdGVtcGxhdGUgYWNjZXNzIHdpdGggZW52aXJvbm1lbnQtYmFzZWQgdGFnIGNvbmRpdGlvbnNcbiAgICBlbWFpbFByb2Nlc3NvclJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnc2VzOkdldFRlbXBsYXRlJyxcbiAgICAgICAgJ3NlczpMaXN0VGVtcGxhdGVzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6c2VzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0ZW1wbGF0ZS8qYCxcbiAgICAgIF0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdhd3M6UmVzb3VyY2VUYWcvRW52aXJvbm1lbnQnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gR3JhbnQgU1FTIHBlcm1pc3Npb25zIHdpdGggZW52aXJvbm1lbnQtYmFzZWQgdGFnIGNvbmRpdGlvbnNcbiAgICBlbWFpbFByb2Nlc3NvclJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnc3FzOlJlY2VpdmVNZXNzYWdlJyxcbiAgICAgICAgJ3NxczpEZWxldGVNZXNzYWdlJyxcbiAgICAgICAgJ3NxczpHZXRRdWV1ZUF0dHJpYnV0ZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICB0aGlzLmVtYWlsUXVldWUucXVldWVBcm4sXG4gICAgICAgIGRlYWRMZXR0ZXJRdWV1ZS5xdWV1ZUFybixcbiAgICAgIF0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdhd3M6UmVzb3VyY2VUYWcvRW52aXJvbm1lbnQnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSkpO1xuXG4gICAgLy8gRW1haWwgUHJvY2Vzc29yIExhbWJkYVxuICAgIHRoaXMuZW1haWxQcm9jZXNzb3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdFbWFpbFByb2Nlc3NvcicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogdGhpcy5yZXNvdXJjZU5hbWVzLmxhbWJkYSgnZW1haWwtcHJvY2Vzc29yJyksXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIwMjMsXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vdGFyZ2V0L2xhbWJkYS9lbWFpbC1wcm9jZXNzb3IvJyksXG4gICAgICByb2xlOiBlbWFpbFByb2Nlc3NvclJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBBUFBfTkFNRTogdGhpcy5jb25maWcuYXBwTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICBGUk9NX0VNQUlMOiAnbm9yZXBseUBhcHByZWNpYXRhLmNvbScsXG4gICAgICAgIE9UUF9URU1QTEFURV9OQU1FOiB0aGlzLm90cFRlbXBsYXRlLnJlZixcbiAgICAgICAgV0VMQ09NRV9URU1QTEFURV9OQU1FOiB0aGlzLndlbGNvbWVUZW1wbGF0ZS5yZWYsXG4gICAgICAgIENPTVBMRVRFX1JFR0lTVFJBVElPTl9VU0VSX0lORk9fVEVNUExBVEVfTkFNRTogdGhpcy5jb21wbGV0ZVJlZ2lzdHJhdGlvblVzZXJJbmZvVGVtcGxhdGUucmVmLFxuICAgICAgICBDT01QTEVURV9SRUdJU1RSQVRJT05fU1RSSVBFX1RFTVBMQVRFX05BTUU6IHRoaXMuY29tcGxldGVSZWdpc3RyYXRpb25TdHJpcGVUZW1wbGF0ZS5yZWYsXG4gICAgICAgIE5FV1NMRVRURVJfVEVNUExBVEVfTkFNRTogdGhpcy5uZXdzbGV0dGVyVGVtcGxhdGUucmVmLFxuICAgICAgICBERVBMT1lNRU5UX1RJTUVTVEFNUDogRGF0ZS5ub3coKS50b1N0cmluZygpLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9KTtcblxuICAgIC8vIEFwcGx5IHRhZ3MgdG8gTGFtYmRhIGZ1bmN0aW9uXG4gICAgY29uc3QgbGFtYmRhVGFncyA9IHRoaXMudGFnQnVpbGRlci5nZXRMYW1iZGFUYWdzKCdlbWFpbC1wcm9jZXNzb3InKTtcbiAgICBPYmplY3QuZW50cmllcyhsYW1iZGFUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMuZW1haWxQcm9jZXNzb3IpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIENvbm5lY3QgU1FTIHRvIExhbWJkYVxuICAgIHRoaXMuZW1haWxQcm9jZXNzb3IuYWRkRXZlbnRTb3VyY2UobmV3IGxhbWJkYUV2ZW50U291cmNlcy5TcXNFdmVudFNvdXJjZSh0aGlzLmVtYWlsUXVldWUsIHtcbiAgICAgIGJhdGNoU2l6ZTogMTAsXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCkge1xuICAgIC8vIFRlbXBsYXRlIG5hbWVzIGZvciBvdGhlciBzdGFja3MgdG8gcmVmZXJlbmNlXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09UUFRlbXBsYXRlSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5vdHBUZW1wbGF0ZS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NFUyBUZW1wbGF0ZSBJRCBmb3IgT1RQIGVtYWlscycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLmNvbmZpZy5hcHBOYW1lfS1PVFBUZW1wbGF0ZUlkLSR7dGhpcy5jb25maWcuZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWxjb21lVGVtcGxhdGVJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlbGNvbWVUZW1wbGF0ZS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NFUyBUZW1wbGF0ZSBJRCBmb3Igd2VsY29tZSBlbWFpbHMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5jb25maWcuYXBwTmFtZX0tV2VsY29tZVRlbXBsYXRlSWQtJHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbXBsZXRlUmVnaXN0cmF0aW9uVXNlckluZm9UZW1wbGF0ZUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuY29tcGxldGVSZWdpc3RyYXRpb25Vc2VySW5mb1RlbXBsYXRlLnJlZixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU0VTIFRlbXBsYXRlIElEIGZvciBjb21wbGV0ZSByZWdpc3RyYXRpb24gdXNlciBpbmZvIGVtYWlscycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLmNvbmZpZy5hcHBOYW1lfS1Db21wbGV0ZVJlZ2lzdHJhdGlvblVzZXJJbmZvVGVtcGxhdGVJZC0ke3RoaXMuY29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29tcGxldGVSZWdpc3RyYXRpb25TdHJpcGVUZW1wbGF0ZUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuY29tcGxldGVSZWdpc3RyYXRpb25TdHJpcGVUZW1wbGF0ZS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NFUyBUZW1wbGF0ZSBJRCBmb3IgY29tcGxldGUgcmVnaXN0cmF0aW9uIFN0cmlwZSBlbWFpbHMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5jb25maWcuYXBwTmFtZX0tQ29tcGxldGVSZWdpc3RyYXRpb25TdHJpcGVUZW1wbGF0ZUlkLSR7dGhpcy5jb25maWcuZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdOZXdzbGV0dGVyVGVtcGxhdGVJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm5ld3NsZXR0ZXJUZW1wbGF0ZS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NFUyBUZW1wbGF0ZSBJRCBmb3IgbmV3c2xldHRlciBlbWFpbHMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5jb25maWcuYXBwTmFtZX0tTmV3c2xldHRlclRlbXBsYXRlSWQtJHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VtYWlsUXVldWVVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5lbWFpbFF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdFbWFpbCBwcm9jZXNzaW5nIHF1ZXVlIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLmNvbmZpZy5hcHBOYW1lfS1FbWFpbFF1ZXVlVXJsLSR7dGhpcy5jb25maWcuZW52aXJvbm1lbnR9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==