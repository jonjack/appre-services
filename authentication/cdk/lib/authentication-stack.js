"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const lambda = require("aws-cdk-lib/aws-lambda");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
const src_1 = require("../../../shared/cdk-utils/src");
/**
 * Authentication Stack for Appre Platform
 *
 * This stack provides passwordless authentication infrastructure for content creators
 * using email-based one-time passwords (OTP) and custom authentication flows.
 *
 * AWS Services Included:
 * - Amazon Cognito User Pool: User management and authentication
 * - AWS Lambda: Custom authentication challenge handlers (3 functions)
 * - Amazon DynamoDB: User data, OTP storage, rate limiting, and sessions (4 tables)
 * - AWS IAM: Roles and policies for secure service interactions
 * - Amazon SES: Email delivery for OTP codes (permissions only)
 *
 * Key Features:
 * - Self-registration enabled
 * - Passwordless authentication via email OTP
 * - Rate limiting for OTP requests
 * - User session management
 * - Custom user attributes for Stripe integration
 * - Environment-based resource tagging and security
 */
class AuthenticationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Initialize naming and tagging utilities
        this.resourceNames = new src_1.ResourceNames(props.config);
        this.tagBuilder = new src_1.TagBuilder(props.config, src_1.SERVICE_DOMAINS.AUTHENTICATION);
        this.userPoolName = (0, src_1.createResourceName)('users', this.tagBuilder.config);
        // Apply global tags to the stack
        const globalTags = this.tagBuilder.getBaseTags();
        Object.entries(globalTags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
        // DynamoDB Tables
        this.createDynamoDBTables();
        // Lambda Functions for Cognito Triggers
        const lambdaFunctions = this.createLambdaFunctions();
        // Cognito User Pool with Custom Authentication
        this.createCognitoUserPool(lambdaFunctions);
        // Configure passwordless authentication
        this.configurePasswordlessAuth();
        // Outputs
        this.createOutputs();
    }
    createDynamoDBTables() {
        const isProd = this.tagBuilder.config.environment === 'prod';
        // OTP Table
        this.otpTable = new dynamodb.Table(this, 'OTPTable', {
            tableName: this.resourceNames.dynamoTable('auth-otps'),
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: isProd,
            removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Apply tags to OTP table
        const otpTags = this.tagBuilder.getDynamoTags('auth-otps');
        Object.entries(otpTags).forEach(([key, value]) => {
            cdk.Tags.of(this.otpTable).add(key, value);
        });
        // Rate Limit Table
        this.rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
            tableName: this.resourceNames.dynamoTable('rate-limits'),
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'request_timestamp', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: isProd,
            removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Apply tags to Rate Limit table
        const rateLimitTags = this.tagBuilder.getDynamoTags('rate-limits');
        Object.entries(rateLimitTags).forEach(([key, value]) => {
            cdk.Tags.of(this.rateLimitTable).add(key, value);
        });
        // Users Table
        this.usersTable = new dynamodb.Table(this, 'UsersTable', {
            tableName: this.resourceNames.dynamoTable('users'),
            partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: isProd,
            removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Apply tags to Users table
        const usersTags = this.tagBuilder.getDynamoTags('users');
        Object.entries(usersTags).forEach(([key, value]) => {
            cdk.Tags.of(this.usersTable).add(key, value);
        });
        // GSI for email lookup
        this.usersTable.addGlobalSecondaryIndex({
            indexName: 'email-index',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Add additional GSI to users table for admin dashboard
        this.usersTable.addGlobalSecondaryIndex({
            indexName: 'status-index',
            partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Session Table
        this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
            tableName: this.resourceNames.dynamoTable('user-sessions'),
            partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'expires_at',
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: isProd,
            removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Add GSI for user_id lookup (for finding all sessions for a user)
        this.sessionTable.addGlobalSecondaryIndex({
            indexName: 'user-id-index',
            partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Apply tags to Session table
        const sessionTags = this.tagBuilder.getDynamoTags('user-sessions');
        Object.entries(sessionTags).forEach(([key, value]) => {
            cdk.Tags.of(this.sessionTable).add(key, value);
        });
    }
    createLambdaFunctions() {
        // IAM role for Lambda functions
        const lambdaRole = new iam.Role(this, 'AuthLambdaRole', {
            roleName: this.resourceNames.iamRole('auth-lambda-role'),
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Apply tags to IAM role
        const roleTags = this.tagBuilder.getIamTags('auth-lambda-role');
        Object.entries(roleTags).forEach(([key, value]) => {
            cdk.Tags.of(lambdaRole).add(key, value);
        });
        // Grant DynamoDB permissions with environment-based tag conditions
        const dynamoPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
            ],
            resources: [
                this.otpTable.tableArn,
                this.rateLimitTable.tableArn,
                this.usersTable.tableArn,
                this.sessionTable.tableArn,
                `${this.usersTable.tableArn}/index/*`,
            ],
            conditions: {
                StringEquals: {
                    'aws:ResourceTag/Environment': this.tagBuilder.config.environment,
                },
            },
        });
        lambdaRole.addToPolicy(dynamoPolicy);
        // Grant SES permissions with environment-based tag conditions
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ses:SendEmail',
                'ses:SendRawEmail',
                'ses:SendTemplatedEmail',
            ],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'ses:FromAddress': process.env.FROM_EMAIL || 'noreply@appreciata.com',
                },
            },
        }));
        // Grant Cognito admin permissions for user management with environment-based tag conditions
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:AdminConfirmSignUp',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminUpdateUserAttributes',
            ],
            resources: [
                `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`
            ],
            conditions: {
                StringEquals: {
                    'aws:ResourceTag/Environment': this.tagBuilder.config.environment,
                },
            },
        }));
        // Create Auth Challenge Lambda
        const deploymentTime = Date.now().toString();
        const createAuthChallenge = new lambda.Function(this, 'CreateAuthChallenge', {
            functionName: this.resourceNames.lambda('create-auth-challenge'),
            runtime: lambda.Runtime.PROVIDED_AL2023,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../target/lambda/create-auth-challenge/'),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            description: `Create auth challenge Lambda - deployed at ${deploymentTime}`,
            environment: {
                APP_NAME: this.tagBuilder.config.appName,
                ENVIRONMENT: this.tagBuilder.config.environment,
                OTP_TABLE_NAME: this.otpTable.tableName,
                RATE_LIMIT_TABLE_NAME: this.rateLimitTable.tableName,
                USERS_TABLE_NAME: this.usersTable.tableName,
                SESSION_TABLE_NAME: this.sessionTable.tableName,
                FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@appreciata.com',
                // SES Template names
                OTP_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-otp`,
                WELCOME_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-welcome`,
                COMPLETE_REGISTRATION_USER_INFO_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-complete-registration-user-info`,
                COMPLETE_REGISTRATION_STRIPE_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-complete-registration-stripe`,
                NEWSLETTER_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-newsletter`,
                DEPLOYMENT_TIMESTAMP: deploymentTime,
                LAMBDA_VERSION: 'v2.0.0', // Increment this to force redeployment
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        // Apply tags to Create Auth Challenge Lambda
        const createChallengeTags = this.tagBuilder.getLambdaTags('auth-create-challenge');
        Object.entries(createChallengeTags).forEach(([key, value]) => {
            cdk.Tags.of(createAuthChallenge).add(key, value);
        });
        // Verify Auth Challenge Lambda
        const verifyAuthChallenge = new lambda.Function(this, 'VerifyAuthChallenge', {
            functionName: this.resourceNames.lambda('verify-auth-challenge'),
            runtime: new lambda.Runtime('provided.al2023'),
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../target/lambda/verify-auth-challenge/'),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                APP_NAME: this.tagBuilder.config.appName,
                ENVIRONMENT: this.tagBuilder.config.environment,
                OTP_TABLE_NAME: this.otpTable.tableName,
                USERS_TABLE_NAME: this.usersTable.tableName,
                SESSION_TABLE_NAME: this.sessionTable.tableName,
                // SES Template names
                OTP_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-otp`,
                WELCOME_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-welcome`,
                COMPLETE_REGISTRATION_USER_INFO_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-complete-registration-user-info`,
                COMPLETE_REGISTRATION_STRIPE_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-complete-registration-stripe`,
                NEWSLETTER_TEMPLATE_NAME: `${this.tagBuilder.config.appName}-${this.tagBuilder.config.environment}-newsletter`,
                DEPLOYMENT_TIMESTAMP: Date.now().toString(), // Force redeployment
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        // Apply tags to Verify Auth Challenge Lambda
        const verifyChallengeTags = this.tagBuilder.getLambdaTags('auth-verify-challenge');
        Object.entries(verifyChallengeTags).forEach(([key, value]) => {
            cdk.Tags.of(verifyAuthChallenge).add(key, value);
        });
        // Define Auth Challenge Lambda
        const defineAuthChallenge = new lambda.Function(this, 'DefineAuthChallenge', {
            functionName: this.resourceNames.lambda('define-auth-challenge'),
            runtime: new lambda.Runtime('provided.al2023'),
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../target/lambda/define-auth-challenge/'),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 128,
            environment: {
                APP_NAME: this.tagBuilder.config.appName,
                ENVIRONMENT: this.tagBuilder.config.environment,
                DEPLOYMENT_TIMESTAMP: Date.now().toString(), // Force redeployment
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        // Apply tags to Define Auth Challenge Lambda
        const defineChallengeTags = this.tagBuilder.getLambdaTags('auth-define-challenge');
        Object.entries(defineChallengeTags).forEach(([key, value]) => {
            cdk.Tags.of(defineAuthChallenge).add(key, value);
        });
        // Pre-Signup Lambda
        const preSignup = new lambda.Function(this, 'PreSignup', {
            functionName: this.resourceNames.lambda('pre-signup'),
            runtime: new lambda.Runtime('provided.al2023'),
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../target/lambda/pre-signup/'),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 128,
            environment: {
                APP_NAME: this.tagBuilder.config.appName,
                ENVIRONMENT: this.tagBuilder.config.environment,
                DEPLOYMENT_TIMESTAMP: Date.now().toString(), // Force redeployment
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        // Apply tags to Pre-Signup Lambda
        const preSignupTags = this.tagBuilder.getLambdaTags('auth-pre-signup');
        Object.entries(preSignupTags).forEach(([key, value]) => {
            cdk.Tags.of(preSignup).add(key, value);
        });
        return {
            createAuthChallenge,
            verifyAuthChallenge,
            defineAuthChallenge,
            preSignup,
        };
    }
    createCognitoUserPool(lambdaFunctions) {
        // User Pool
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: this.userPoolName,
            // Enable self-registration
            selfSignUpEnabled: true,
            // Sign-in configuration
            signInAliases: {
                email: true,
                username: false,
                phone: false,
            },
            // Auto-verified attributes
            autoVerify: {
                email: false, // We handle verification via OTP
            },
            // Standard attributes
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: false,
                    mutable: true,
                },
                familyName: {
                    required: false,
                    mutable: true,
                },
            },
            // Custom attributes for our user status
            customAttributes: {
                'user_status': new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 50,
                    mutable: true,
                }),
                'stripe_account_id': new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 100,
                    mutable: true,
                }),
            },
            // Password policy (not used but required)
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            // Account recovery
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            // Enable passwordless authentication
            signInCaseSensitive: false,
            // Lambda triggers for custom auth
            lambdaTriggers: {
                createAuthChallenge: lambdaFunctions.createAuthChallenge,
                defineAuthChallenge: lambdaFunctions.defineAuthChallenge,
                verifyAuthChallengeResponse: lambdaFunctions.verifyAuthChallenge,
                preSignUp: lambdaFunctions.preSignup,
            },
            // Deletion protection
            deletionProtection: this.tagBuilder.config.environment === 'prod',
            // Remove default policy
            removalPolicy: this.tagBuilder.config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Apply tags to User Pool
        const userPoolTags = this.tagBuilder.getComponentTags('cognito', { Component: 'user-pool' });
        Object.entries(userPoolTags).forEach(([key, value]) => {
            cdk.Tags.of(this.userPool).add(key, value);
        });
        // User Pool Client
        this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool: this.userPool,
            userPoolClientName: (0, src_1.createResourceName)('client', this.tagBuilder.config),
            // Authentication flows
            authFlows: {
                adminUserPassword: false,
                custom: true,
                userPassword: false,
                userSrp: false,
            },
            // Token validity
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30),
            // Prevent user existence errors
            preventUserExistenceErrors: true,
            // Supported identity providers
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
            // OAuth settings disabled for custom auth flow
            // oAuth: {
            //   flows: {
            //     authorizationCodeGrant: false,
            //     implicitCodeGrant: false,
            //   },
            // },
            // Security
            generateSecret: false, // For web applications
        });
        // Apply tags to User Pool Client
        const userPoolClientTags = this.tagBuilder.getComponentTags('cognito', { Component: 'user-pool-client' });
        Object.entries(userPoolClientTags).forEach(([key, value]) => {
            cdk.Tags.of(this.userPoolClient).add(key, value);
        });
        // Grant Cognito permission to invoke Lambda functions
        lambdaFunctions.createAuthChallenge.addPermission('CognitoInvokeCreateChallenge', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            sourceArn: this.userPool.userPoolArn,
        });
        lambdaFunctions.verifyAuthChallenge.addPermission('CognitoInvokeVerifyChallenge', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            sourceArn: this.userPool.userPoolArn,
        });
        lambdaFunctions.defineAuthChallenge.addPermission('CognitoInvokeDefineChallenge', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            sourceArn: this.userPool.userPoolArn,
        });
        lambdaFunctions.preSignup.addPermission('CognitoInvokePreSignup', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            sourceArn: this.userPool.userPoolArn,
        });
    }
    configurePasswordlessAuth() {
        // Use L1 construct to enable passwordless authentication
        const cfnUserPoolClient = this.userPoolClient.node.defaultChild;
        // Add ALLOW_USER_AUTH flow to the app client
        // This is required for passwordless authentication
        cfnUserPoolClient.addPropertyOverride('ExplicitAuthFlows', [
            'ALLOW_CUSTOM_AUTH',
            'ALLOW_USER_AUTH',
            'ALLOW_REFRESH_TOKEN_AUTH'
        ]);
        console.log('✅ Passwordless authentication configured:');
        console.log('   - Self-registration: Enabled via CDK');
        console.log('   - Custom auth flows: Enabled for passwordless');
        console.log('');
        console.log('⚠️  MANUAL STEP REQUIRED:');
        console.log('   Please enable "Email OTP" authentication method in the Cognito User Pool console');
        console.log(`   Go to: AWS Console > Cognito > User Pools > ${this.userPoolName} > Sign-in experience`);
        console.log('   Enable: "Email OTP" under Authentication methods');
        console.log('   (This setting is not yet available in CloudFormation/CDK)');
    }
    createOutputs() {
        const environment = this.tagBuilder.config.environment;
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: `${this.tagBuilder.config.appName}-UserPoolId-${environment}`,
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: `${this.tagBuilder.config.appName}-UserPoolClientId-${environment}`,
        });
        new cdk.CfnOutput(this, 'UserPoolArn', {
            value: this.userPool.userPoolArn,
            description: 'Cognito User Pool ARN',
        });
        new cdk.CfnOutput(this, 'UsersTableName', {
            value: this.usersTable.tableName,
            description: 'Users DynamoDB Table Name',
            exportName: `${this.tagBuilder.config.appName}-UsersTable-${environment}`,
        });
        new cdk.CfnOutput(this, 'SessionTableName', {
            value: this.sessionTable.tableName,
            description: 'User Sessions DynamoDB Table Name',
            exportName: `${this.tagBuilder.config.appName}-SessionTable-${environment}`,
        });
    }
}
exports.AuthenticationStack = AuthenticationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb24tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdXRoZW50aWNhdGlvbi1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsbURBQW1EO0FBQ25ELGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQsMkNBQTJDO0FBRTNDLHVEQUFrSTtBQU1sSTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvQkc7QUFDSCxNQUFhLG1CQUFvQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBWWhELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBK0I7UUFDdkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxtQkFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksZ0JBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLHFCQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0UsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFBLHdCQUFrQixFQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXhFLGlDQUFpQztRQUNqQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDO1FBRUgsa0JBQWtCO1FBQ2xC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R0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLGlCQUFpQixXQUFXLEVBQUU7U0FDNUUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbGlCRCxrREFraUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcsIFJlc291cmNlTmFtZXMsIFRhZ0J1aWxkZXIsIFNFUlZJQ0VfRE9NQUlOUywgY3JlYXRlUmVzb3VyY2VOYW1lIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL2Nkay11dGlscy9zcmMnO1xuXG5pbnRlcmZhY2UgQXV0aGVudGljYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xufVxuXG4vKipcbiAqIEF1dGhlbnRpY2F0aW9uIFN0YWNrIGZvciBBcHByZSBQbGF0Zm9ybVxuICogXG4gKiBUaGlzIHN0YWNrIHByb3ZpZGVzIHBhc3N3b3JkbGVzcyBhdXRoZW50aWNhdGlvbiBpbmZyYXN0cnVjdHVyZSBmb3IgY29udGVudCBjcmVhdG9yc1xuICogdXNpbmcgZW1haWwtYmFzZWQgb25lLXRpbWUgcGFzc3dvcmRzIChPVFApIGFuZCBjdXN0b20gYXV0aGVudGljYXRpb24gZmxvd3MuXG4gKiBcbiAqIEFXUyBTZXJ2aWNlcyBJbmNsdWRlZDpcbiAqIC0gQW1hem9uIENvZ25pdG8gVXNlciBQb29sOiBVc2VyIG1hbmFnZW1lbnQgYW5kIGF1dGhlbnRpY2F0aW9uXG4gKiAtIEFXUyBMYW1iZGE6IEN1c3RvbSBhdXRoZW50aWNhdGlvbiBjaGFsbGVuZ2UgaGFuZGxlcnMgKDMgZnVuY3Rpb25zKVxuICogLSBBbWF6b24gRHluYW1vREI6IFVzZXIgZGF0YSwgT1RQIHN0b3JhZ2UsIHJhdGUgbGltaXRpbmcsIGFuZCBzZXNzaW9ucyAoNCB0YWJsZXMpXG4gKiAtIEFXUyBJQU06IFJvbGVzIGFuZCBwb2xpY2llcyBmb3Igc2VjdXJlIHNlcnZpY2UgaW50ZXJhY3Rpb25zXG4gKiAtIEFtYXpvbiBTRVM6IEVtYWlsIGRlbGl2ZXJ5IGZvciBPVFAgY29kZXMgKHBlcm1pc3Npb25zIG9ubHkpXG4gKiBcbiAqIEtleSBGZWF0dXJlczpcbiAqIC0gU2VsZi1yZWdpc3RyYXRpb24gZW5hYmxlZFxuICogLSBQYXNzd29yZGxlc3MgYXV0aGVudGljYXRpb24gdmlhIGVtYWlsIE9UUFxuICogLSBSYXRlIGxpbWl0aW5nIGZvciBPVFAgcmVxdWVzdHNcbiAqIC0gVXNlciBzZXNzaW9uIG1hbmFnZW1lbnRcbiAqIC0gQ3VzdG9tIHVzZXIgYXR0cmlidXRlcyBmb3IgU3RyaXBlIGludGVncmF0aW9uXG4gKiAtIEVudmlyb25tZW50LWJhc2VkIHJlc291cmNlIHRhZ2dpbmcgYW5kIHNlY3VyaXR5XG4gKi9cbmV4cG9ydCBjbGFzcyBBdXRoZW50aWNhdGlvblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sITogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50ITogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IG90cFRhYmxlITogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSByYXRlTGltaXRUYWJsZSE6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlcnNUYWJsZSE6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgc2Vzc2lvblRhYmxlITogZHluYW1vZGIuVGFibGU7XG5cbiAgcHJpdmF0ZSByZWFkb25seSByZXNvdXJjZU5hbWVzOiBSZXNvdXJjZU5hbWVzO1xuICBwcml2YXRlIHJlYWRvbmx5IHRhZ0J1aWxkZXI6IFRhZ0J1aWxkZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgdXNlclBvb2xOYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEF1dGhlbnRpY2F0aW9uU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBuYW1pbmcgYW5kIHRhZ2dpbmcgdXRpbGl0aWVzXG4gICAgdGhpcy5yZXNvdXJjZU5hbWVzID0gbmV3IFJlc291cmNlTmFtZXMocHJvcHMuY29uZmlnKTtcbiAgICB0aGlzLnRhZ0J1aWxkZXIgPSBuZXcgVGFnQnVpbGRlcihwcm9wcy5jb25maWcsIFNFUlZJQ0VfRE9NQUlOUy5BVVRIRU5USUNBVElPTik7XG4gICAgdGhpcy51c2VyUG9vbE5hbWUgPSBjcmVhdGVSZXNvdXJjZU5hbWUoJ3VzZXJzJywgdGhpcy50YWdCdWlsZGVyLmNvbmZpZyk7XG5cbiAgICAvLyBBcHBseSBnbG9iYWwgdGFncyB0byB0aGUgc3RhY2tcbiAgICBjb25zdCBnbG9iYWxUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldEJhc2VUYWdzKCk7XG4gICAgT2JqZWN0LmVudHJpZXMoZ2xvYmFsVGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICB0aGlzLmNyZWF0ZUR5bmFtb0RCVGFibGVzKCk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zIGZvciBDb2duaXRvIFRyaWdnZXJzXG4gICAgY29uc3QgbGFtYmRhRnVuY3Rpb25zID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbnMoKTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIHdpdGggQ3VzdG9tIEF1dGhlbnRpY2F0aW9uXG4gICAgdGhpcy5jcmVhdGVDb2duaXRvVXNlclBvb2wobGFtYmRhRnVuY3Rpb25zKTtcblxuICAgIC8vIENvbmZpZ3VyZSBwYXNzd29yZGxlc3MgYXV0aGVudGljYXRpb25cbiAgICB0aGlzLmNvbmZpZ3VyZVBhc3N3b3JkbGVzc0F1dGgoKTtcblxuICAgIC8vIE91dHB1dHNcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRHluYW1vREJUYWJsZXMoKSB7XG4gICAgY29uc3QgaXNQcm9kID0gdGhpcy50YWdCdWlsZGVyLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnO1xuXG4gICAgLy8gT1RQIFRhYmxlXG4gICAgKHRoaXMgYXMgYW55KS5vdHBUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT1RQVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IHRoaXMucmVzb3VyY2VOYW1lcy5keW5hbW9UYWJsZSgnYXV0aC1vdHBzJyksXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGlzUHJvZCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGlzUHJvZCA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIE9UUCB0YWJsZVxuICAgIGNvbnN0IG90cFRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0RHluYW1vVGFncygnYXV0aC1vdHBzJyk7XG4gICAgT2JqZWN0LmVudHJpZXMob3RwVGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBjZGsuVGFncy5vZih0aGlzLm90cFRhYmxlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBSYXRlIExpbWl0IFRhYmxlXG4gICAgKHRoaXMgYXMgYW55KS5yYXRlTGltaXRUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmF0ZUxpbWl0VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IHRoaXMucmVzb3VyY2VOYW1lcy5keW5hbW9UYWJsZSgncmF0ZS1saW1pdHMnKSxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAncmVxdWVzdF90aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogaXNQcm9kLFxuICAgICAgcmVtb3ZhbFBvbGljeTogaXNQcm9kID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEFwcGx5IHRhZ3MgdG8gUmF0ZSBMaW1pdCB0YWJsZVxuICAgIGNvbnN0IHJhdGVMaW1pdFRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0RHluYW1vVGFncygncmF0ZS1saW1pdHMnKTtcbiAgICBPYmplY3QuZW50cmllcyhyYXRlTGltaXRUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMucmF0ZUxpbWl0VGFibGUpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIFVzZXJzIFRhYmxlXG4gICAgKHRoaXMgYXMgYW55KS51c2Vyc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc2Vyc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuZHluYW1vVGFibGUoJ3VzZXJzJyksXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJfaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGlzUHJvZCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGlzUHJvZCA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIFVzZXJzIHRhYmxlXG4gICAgY29uc3QgdXNlcnNUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldER5bmFtb1RhZ3MoJ3VzZXJzJyk7XG4gICAgT2JqZWN0LmVudHJpZXModXNlcnNUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMudXNlcnNUYWJsZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gR1NJIGZvciBlbWFpbCBsb29rdXBcbiAgICB0aGlzLnVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZW1haWwtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdlbWFpbCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGFkZGl0aW9uYWwgR1NJIHRvIHVzZXJzIHRhYmxlIGZvciBhZG1pbiBkYXNoYm9hcmRcbiAgICB0aGlzLnVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnc3RhdHVzLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc3RhdHVzJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NyZWF0ZWRfYXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIFNlc3Npb24gVGFibGVcbiAgICAodGhpcyBhcyBhbnkpLnNlc3Npb25UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2Vzc2lvblRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiB0aGlzLnJlc291cmNlTmFtZXMuZHluYW1vVGFibGUoJ3VzZXItc2Vzc2lvbnMnKSxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2Vzc2lvbl9pZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ2V4cGlyZXNfYXQnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogaXNQcm9kLFxuICAgICAgcmVtb3ZhbFBvbGljeTogaXNQcm9kID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHVzZXJfaWQgbG9va3VwIChmb3IgZmluZGluZyBhbGwgc2Vzc2lvbnMgZm9yIGEgdXNlcilcbiAgICB0aGlzLnNlc3Npb25UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VyLWlkLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcl9pZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gQXBwbHkgdGFncyB0byBTZXNzaW9uIHRhYmxlXG4gICAgY29uc3Qgc2Vzc2lvblRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0RHluYW1vVGFncygndXNlci1zZXNzaW9ucycpO1xuICAgIE9iamVjdC5lbnRyaWVzKHNlc3Npb25UYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMuc2Vzc2lvblRhYmxlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUZ1bmN0aW9ucygpIHtcbiAgICAvLyBJQU0gcm9sZSBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0F1dGhMYW1iZGFSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IHRoaXMucmVzb3VyY2VOYW1lcy5pYW1Sb2xlKCdhdXRoLWxhbWJkYS1yb2xlJyksXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIElBTSByb2xlXG4gICAgY29uc3Qgcm9sZVRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0SWFtVGFncygnYXV0aC1sYW1iZGEtcm9sZScpO1xuICAgIE9iamVjdC5lbnRyaWVzKHJvbGVUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKGxhbWJkYVJvbGUpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIHdpdGggZW52aXJvbm1lbnQtYmFzZWQgdGFnIGNvbmRpdGlvbnNcbiAgICBjb25zdCBkeW5hbW9Qb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcbiAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgdGhpcy5vdHBUYWJsZS50YWJsZUFybixcbiAgICAgICAgdGhpcy5yYXRlTGltaXRUYWJsZS50YWJsZUFybixcbiAgICAgICAgdGhpcy51c2Vyc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICB0aGlzLnNlc3Npb25UYWJsZS50YWJsZUFybixcbiAgICAgICAgYCR7dGhpcy51c2Vyc1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgIF0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdhd3M6UmVzb3VyY2VUYWcvRW52aXJvbm1lbnQnOiB0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3koZHluYW1vUG9saWN5KTtcblxuICAgIC8vIEdyYW50IFNFUyBwZXJtaXNzaW9ucyB3aXRoIGVudmlyb25tZW50LWJhc2VkIHRhZyBjb25kaXRpb25zXG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzZXM6U2VuZEVtYWlsJyxcbiAgICAgICAgJ3NlczpTZW5kUmF3RW1haWwnLFxuICAgICAgICAnc2VzOlNlbmRUZW1wbGF0ZWRFbWFpbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gU0VTIGRvZXNuJ3Qgc3VwcG9ydCByZXNvdXJjZS1sZXZlbCBwZXJtaXNzaW9ucyBmb3Igc2VuZGluZ1xuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnc2VzOkZyb21BZGRyZXNzJzogcHJvY2Vzcy5lbnYuRlJPTV9FTUFJTCB8fCAnbm9yZXBseUBhcHByZWNpYXRhLmNvbScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pKTtcblxuICAgIC8vIEdyYW50IENvZ25pdG8gYWRtaW4gcGVybWlzc2lvbnMgZm9yIHVzZXIgbWFuYWdlbWVudCB3aXRoIGVudmlyb25tZW50LWJhc2VkIHRhZyBjb25kaXRpb25zXG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNvbmZpcm1TaWduVXAnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpjb2duaXRvLWlkcDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dXNlcnBvb2wvKmBcbiAgICAgIF0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdhd3M6UmVzb3VyY2VUYWcvRW52aXJvbm1lbnQnOiB0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICAvLyBDcmVhdGUgQXV0aCBDaGFsbGVuZ2UgTGFtYmRhXG4gICAgY29uc3QgZGVwbG95bWVudFRpbWUgPSBEYXRlLm5vdygpLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgY3JlYXRlQXV0aENoYWxsZW5nZSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NyZWF0ZUF1dGhDaGFsbGVuZ2UnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IHRoaXMucmVzb3VyY2VOYW1lcy5sYW1iZGEoJ2NyZWF0ZS1hdXRoLWNoYWxsZW5nZScpLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyMDIzLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3RhcmdldC9sYW1iZGEvY3JlYXRlLWF1dGgtY2hhbGxlbmdlLycpLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGRlc2NyaXB0aW9uOiBgQ3JlYXRlIGF1dGggY2hhbGxlbmdlIExhbWJkYSAtIGRlcGxveWVkIGF0ICR7ZGVwbG95bWVudFRpbWV9YCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFQUF9OQU1FOiB0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiB0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICBPVFBfVEFCTEVfTkFNRTogdGhpcy5vdHBUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFJBVEVfTElNSVRfVEFCTEVfTkFNRTogdGhpcy5yYXRlTGltaXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJTX1RBQkxFX05BTUU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFNFU1NJT05fVEFCTEVfTkFNRTogdGhpcy5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgICBGUk9NX0VNQUlMOiBwcm9jZXNzLmVudi5GUk9NX0VNQUlMIHx8ICdub3JlcGx5QGFwcHJlY2lhdGEuY29tJyxcbiAgICAgICAgLy8gU0VTIFRlbXBsYXRlIG5hbWVzXG4gICAgICAgIE9UUF9URU1QTEFURV9OQU1FOiBgJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWV9LSR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5lbnZpcm9ubWVudH0tb3RwYCxcbiAgICAgICAgV0VMQ09NRV9URU1QTEFURV9OQU1FOiBgJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWV9LSR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5lbnZpcm9ubWVudH0td2VsY29tZWAsXG4gICAgICAgIENPTVBMRVRFX1JFR0lTVFJBVElPTl9VU0VSX0lORk9fVEVNUExBVEVfTkFNRTogYCR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5hcHBOYW1lfS0ke3RoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnR9LWNvbXBsZXRlLXJlZ2lzdHJhdGlvbi11c2VyLWluZm9gLFxuICAgICAgICBDT01QTEVURV9SRUdJU1RSQVRJT05fU1RSSVBFX1RFTVBMQVRFX05BTUU6IGAke3RoaXMudGFnQnVpbGRlci5jb25maWcuYXBwTmFtZX0tJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmVudmlyb25tZW50fS1jb21wbGV0ZS1yZWdpc3RyYXRpb24tc3RyaXBlYCxcbiAgICAgICAgTkVXU0xFVFRFUl9URU1QTEFURV9OQU1FOiBgJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWV9LSR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5lbnZpcm9ubWVudH0tbmV3c2xldHRlcmAsXG4gICAgICAgIERFUExPWU1FTlRfVElNRVNUQU1QOiBkZXBsb3ltZW50VGltZSxcbiAgICAgICAgTEFNQkRBX1ZFUlNJT046ICd2Mi4wLjAnLCAvLyBJbmNyZW1lbnQgdGhpcyB0byBmb3JjZSByZWRlcGxveW1lbnRcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIENyZWF0ZSBBdXRoIENoYWxsZW5nZSBMYW1iZGFcbiAgICBjb25zdCBjcmVhdGVDaGFsbGVuZ2VUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldExhbWJkYVRhZ3MoJ2F1dGgtY3JlYXRlLWNoYWxsZW5nZScpO1xuICAgIE9iamVjdC5lbnRyaWVzKGNyZWF0ZUNoYWxsZW5nZVRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YoY3JlYXRlQXV0aENoYWxsZW5nZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gVmVyaWZ5IEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IHZlcmlmeUF1dGhDaGFsbGVuZ2UgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdWZXJpZnlBdXRoQ2hhbGxlbmdlJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiB0aGlzLnJlc291cmNlTmFtZXMubGFtYmRhKCd2ZXJpZnktYXV0aC1jaGFsbGVuZ2UnKSxcbiAgICAgIHJ1bnRpbWU6IG5ldyBsYW1iZGEuUnVudGltZSgncHJvdmlkZWQuYWwyMDIzJyksXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vdGFyZ2V0L2xhbWJkYS92ZXJpZnktYXV0aC1jaGFsbGVuZ2UvJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQVBQX05BTUU6IHRoaXMudGFnQnVpbGRlci5jb25maWcuYXBwTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICAgIE9UUF9UQUJMRV9OQU1FOiB0aGlzLm90cFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUlNfVEFCTEVfTkFNRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU0VTU0lPTl9UQUJMRV9OQU1FOiB0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIC8vIFNFUyBUZW1wbGF0ZSBuYW1lc1xuICAgICAgICBPVFBfVEVNUExBVEVfTkFNRTogYCR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5hcHBOYW1lfS0ke3RoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnR9LW90cGAsXG4gICAgICAgIFdFTENPTUVfVEVNUExBVEVfTkFNRTogYCR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5hcHBOYW1lfS0ke3RoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnR9LXdlbGNvbWVgLFxuICAgICAgICBDT01QTEVURV9SRUdJU1RSQVRJT05fVVNFUl9JTkZPX1RFTVBMQVRFX05BTUU6IGAke3RoaXMudGFnQnVpbGRlci5jb25maWcuYXBwTmFtZX0tJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmVudmlyb25tZW50fS1jb21wbGV0ZS1yZWdpc3RyYXRpb24tdXNlci1pbmZvYCxcbiAgICAgICAgQ09NUExFVEVfUkVHSVNUUkFUSU9OX1NUUklQRV9URU1QTEFURV9OQU1FOiBgJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWV9LSR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5lbnZpcm9ubWVudH0tY29tcGxldGUtcmVnaXN0cmF0aW9uLXN0cmlwZWAsXG4gICAgICAgIE5FV1NMRVRURVJfVEVNUExBVEVfTkFNRTogYCR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5hcHBOYW1lfS0ke3RoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnR9LW5ld3NsZXR0ZXJgLFxuICAgICAgICBERVBMT1lNRU5UX1RJTUVTVEFNUDogRGF0ZS5ub3coKS50b1N0cmluZygpLCAvLyBGb3JjZSByZWRlcGxveW1lbnRcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIFZlcmlmeSBBdXRoIENoYWxsZW5nZSBMYW1iZGFcbiAgICBjb25zdCB2ZXJpZnlDaGFsbGVuZ2VUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldExhbWJkYVRhZ3MoJ2F1dGgtdmVyaWZ5LWNoYWxsZW5nZScpO1xuICAgIE9iamVjdC5lbnRyaWVzKHZlcmlmeUNoYWxsZW5nZVRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodmVyaWZ5QXV0aENoYWxsZW5nZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gRGVmaW5lIEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IGRlZmluZUF1dGhDaGFsbGVuZ2UgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWZpbmVBdXRoQ2hhbGxlbmdlJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiB0aGlzLnJlc291cmNlTmFtZXMubGFtYmRhKCdkZWZpbmUtYXV0aC1jaGFsbGVuZ2UnKSxcbiAgICAgIHJ1bnRpbWU6IG5ldyBsYW1iZGEuUnVudGltZSgncHJvdmlkZWQuYWwyMDIzJyksXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vdGFyZ2V0L2xhbWJkYS9kZWZpbmUtYXV0aC1jaGFsbGVuZ2UvJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQVBQX05BTUU6IHRoaXMudGFnQnVpbGRlci5jb25maWcuYXBwTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICAgIERFUExPWU1FTlRfVElNRVNUQU1QOiBEYXRlLm5vdygpLnRvU3RyaW5nKCksIC8vIEZvcmNlIHJlZGVwbG95bWVudFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9KTtcblxuICAgIC8vIEFwcGx5IHRhZ3MgdG8gRGVmaW5lIEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IGRlZmluZUNoYWxsZW5nZVRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0TGFtYmRhVGFncygnYXV0aC1kZWZpbmUtY2hhbGxlbmdlJyk7XG4gICAgT2JqZWN0LmVudHJpZXMoZGVmaW5lQ2hhbGxlbmdlVGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBjZGsuVGFncy5vZihkZWZpbmVBdXRoQ2hhbGxlbmdlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICAvLyBQcmUtU2lnbnVwIExhbWJkYVxuICAgIGNvbnN0IHByZVNpZ251cCA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1ByZVNpZ251cCcsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogdGhpcy5yZXNvdXJjZU5hbWVzLmxhbWJkYSgncHJlLXNpZ251cCcpLFxuICAgICAgcnVudGltZTogbmV3IGxhbWJkYS5SdW50aW1lKCdwcm92aWRlZC5hbDIwMjMnKSxcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi90YXJnZXQvbGFtYmRhL3ByZS1zaWdudXAvJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQVBQX05BTUU6IHRoaXMudGFnQnVpbGRlci5jb25maWcuYXBwTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHRoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICAgIERFUExPWU1FTlRfVElNRVNUQU1QOiBEYXRlLm5vdygpLnRvU3RyaW5nKCksIC8vIEZvcmNlIHJlZGVwbG95bWVudFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9KTtcblxuICAgIC8vIEFwcGx5IHRhZ3MgdG8gUHJlLVNpZ251cCBMYW1iZGFcbiAgICBjb25zdCBwcmVTaWdudXBUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldExhbWJkYVRhZ3MoJ2F1dGgtcHJlLXNpZ251cCcpO1xuICAgIE9iamVjdC5lbnRyaWVzKHByZVNpZ251cFRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YocHJlU2lnbnVwKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY3JlYXRlQXV0aENoYWxsZW5nZSxcbiAgICAgIHZlcmlmeUF1dGhDaGFsbGVuZ2UsXG4gICAgICBkZWZpbmVBdXRoQ2hhbGxlbmdlLFxuICAgICAgcHJlU2lnbnVwLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUNvZ25pdG9Vc2VyUG9vbChsYW1iZGFGdW5jdGlvbnM6IGFueSkge1xuXG4gICAgLy8gVXNlciBQb29sXG4gICAgKHRoaXMgYXMgYW55KS51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogdGhpcy51c2VyUG9vbE5hbWUsXG5cbiAgICAgIC8vIEVuYWJsZSBzZWxmLXJlZ2lzdHJhdGlvblxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG5cbiAgICAgIC8vIFNpZ24taW4gY29uZmlndXJhdGlvblxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IGZhbHNlLFxuICAgICAgICBwaG9uZTogZmFsc2UsXG4gICAgICB9LFxuXG4gICAgICAvLyBBdXRvLXZlcmlmaWVkIGF0dHJpYnV0ZXNcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IGZhbHNlLCAvLyBXZSBoYW5kbGUgdmVyaWZpY2F0aW9uIHZpYSBPVFBcbiAgICAgIH0sXG5cbiAgICAgIC8vIFN0YW5kYXJkIGF0dHJpYnV0ZXNcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGdpdmVuTmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuXG4gICAgICAvLyBDdXN0b20gYXR0cmlidXRlcyBmb3Igb3VyIHVzZXIgc3RhdHVzXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgICd1c2VyX3N0YXR1cyc6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogNTAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgICdzdHJpcGVfYWNjb3VudF9pZCc6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7XG4gICAgICAgICAgbWluTGVuOiAxLFxuICAgICAgICAgIG1heExlbjogMTAwLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSxcblxuICAgICAgLy8gUGFzc3dvcmQgcG9saWN5IChub3QgdXNlZCBidXQgcmVxdWlyZWQpXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDEyLFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIEFjY291bnQgcmVjb3ZlcnlcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcblxuICAgICAgLy8gRW5hYmxlIHBhc3N3b3JkbGVzcyBhdXRoZW50aWNhdGlvblxuICAgICAgc2lnbkluQ2FzZVNlbnNpdGl2ZTogZmFsc2UsXG5cbiAgICAgIC8vIExhbWJkYSB0cmlnZ2VycyBmb3IgY3VzdG9tIGF1dGhcbiAgICAgIGxhbWJkYVRyaWdnZXJzOiB7XG4gICAgICAgIGNyZWF0ZUF1dGhDaGFsbGVuZ2U6IGxhbWJkYUZ1bmN0aW9ucy5jcmVhdGVBdXRoQ2hhbGxlbmdlLFxuICAgICAgICBkZWZpbmVBdXRoQ2hhbGxlbmdlOiBsYW1iZGFGdW5jdGlvbnMuZGVmaW5lQXV0aENoYWxsZW5nZSxcbiAgICAgICAgdmVyaWZ5QXV0aENoYWxsZW5nZVJlc3BvbnNlOiBsYW1iZGFGdW5jdGlvbnMudmVyaWZ5QXV0aENoYWxsZW5nZSxcbiAgICAgICAgcHJlU2lnblVwOiBsYW1iZGFGdW5jdGlvbnMucHJlU2lnbnVwLFxuICAgICAgfSxcblxuICAgICAgLy8gRGVsZXRpb24gcHJvdGVjdGlvblxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiB0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcsXG5cbiAgICAgIC8vIFJlbW92ZSBkZWZhdWx0IHBvbGljeVxuICAgICAgcmVtb3ZhbFBvbGljeTogdGhpcy50YWdCdWlsZGVyLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEFwcGx5IHRhZ3MgdG8gVXNlciBQb29sXG4gICAgY29uc3QgdXNlclBvb2xUYWdzID0gdGhpcy50YWdCdWlsZGVyLmdldENvbXBvbmVudFRhZ3MoJ2NvZ25pdG8nLCB7IENvbXBvbmVudDogJ3VzZXItcG9vbCcgfSk7XG4gICAgT2JqZWN0LmVudHJpZXModXNlclBvb2xUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMudXNlclBvb2wpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnRcbiAgICAodGhpcyBhcyBhbnkpLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGNyZWF0ZVJlc291cmNlTmFtZSgnY2xpZW50JywgdGhpcy50YWdCdWlsZGVyLmNvbmZpZyksXG5cbiAgICAgIC8vIEF1dGhlbnRpY2F0aW9uIGZsb3dzXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgICBjdXN0b206IHRydWUsIC8vIEVuYWJsZSBjdXN0b20gYXV0aGVudGljYXRpb24gZmxvd1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgICB1c2VyU3JwOiBmYWxzZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIFRva2VuIHZhbGlkaXR5XG4gICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG5cbiAgICAgIC8vIFByZXZlbnQgdXNlciBleGlzdGVuY2UgZXJyb3JzXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcblxuICAgICAgLy8gU3VwcG9ydGVkIGlkZW50aXR5IHByb3ZpZGVyc1xuICAgICAgc3VwcG9ydGVkSWRlbnRpdHlQcm92aWRlcnM6IFtcbiAgICAgICAgY29nbml0by5Vc2VyUG9vbENsaWVudElkZW50aXR5UHJvdmlkZXIuQ09HTklUTyxcbiAgICAgIF0sXG5cbiAgICAgIC8vIE9BdXRoIHNldHRpbmdzIGRpc2FibGVkIGZvciBjdXN0b20gYXV0aCBmbG93XG4gICAgICAvLyBvQXV0aDoge1xuICAgICAgLy8gICBmbG93czoge1xuICAgICAgLy8gICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IGZhbHNlLFxuICAgICAgLy8gICAgIGltcGxpY2l0Q29kZUdyYW50OiBmYWxzZSxcbiAgICAgIC8vICAgfSxcbiAgICAgIC8vIH0sXG5cbiAgICAgIC8vIFNlY3VyaXR5XG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIEZvciB3ZWIgYXBwbGljYXRpb25zXG4gICAgfSk7XG5cbiAgICAvLyBBcHBseSB0YWdzIHRvIFVzZXIgUG9vbCBDbGllbnRcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudFRhZ3MgPSB0aGlzLnRhZ0J1aWxkZXIuZ2V0Q29tcG9uZW50VGFncygnY29nbml0bycsIHsgQ29tcG9uZW50OiAndXNlci1wb29sLWNsaWVudCcgfSk7XG4gICAgT2JqZWN0LmVudHJpZXModXNlclBvb2xDbGllbnRUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMudXNlclBvb2xDbGllbnQpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENvZ25pdG8gcGVybWlzc2lvbiB0byBpbnZva2UgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGxhbWJkYUZ1bmN0aW9ucy5jcmVhdGVBdXRoQ2hhbGxlbmdlLmFkZFBlcm1pc3Npb24oJ0NvZ25pdG9JbnZva2VDcmVhdGVDaGFsbGVuZ2UnLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY29nbml0by1pZHAuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuLFxuICAgIH0pO1xuXG4gICAgbGFtYmRhRnVuY3Rpb25zLnZlcmlmeUF1dGhDaGFsbGVuZ2UuYWRkUGVybWlzc2lvbignQ29nbml0b0ludm9rZVZlcmlmeUNoYWxsZW5nZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgfSk7XG5cbiAgICBsYW1iZGFGdW5jdGlvbnMuZGVmaW5lQXV0aENoYWxsZW5nZS5hZGRQZXJtaXNzaW9uKCdDb2duaXRvSW52b2tlRGVmaW5lQ2hhbGxlbmdlJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2NvZ25pdG8taWRwLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybixcbiAgICB9KTtcblxuICAgIGxhbWJkYUZ1bmN0aW9ucy5wcmVTaWdudXAuYWRkUGVybWlzc2lvbignQ29nbml0b0ludm9rZVByZVNpZ251cCcsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpZ3VyZVBhc3N3b3JkbGVzc0F1dGgoKSB7XG4gICAgLy8gVXNlIEwxIGNvbnN0cnVjdCB0byBlbmFibGUgcGFzc3dvcmRsZXNzIGF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY2ZuVXNlclBvb2xDbGllbnQgPSB0aGlzLnVzZXJQb29sQ2xpZW50Lm5vZGUuZGVmYXVsdENoaWxkIGFzIGNvZ25pdG8uQ2ZuVXNlclBvb2xDbGllbnQ7XG5cbiAgICAvLyBBZGQgQUxMT1dfVVNFUl9BVVRIIGZsb3cgdG8gdGhlIGFwcCBjbGllbnRcbiAgICAvLyBUaGlzIGlzIHJlcXVpcmVkIGZvciBwYXNzd29yZGxlc3MgYXV0aGVudGljYXRpb25cbiAgICBjZm5Vc2VyUG9vbENsaWVudC5hZGRQcm9wZXJ0eU92ZXJyaWRlKCdFeHBsaWNpdEF1dGhGbG93cycsIFtcbiAgICAgICdBTExPV19DVVNUT01fQVVUSCcsXG4gICAgICAnQUxMT1dfVVNFUl9BVVRIJywgLy8gUmVxdWlyZWQgZm9yIHBhc3N3b3JkbGVzc1xuICAgICAgJ0FMTE9XX1JFRlJFU0hfVE9LRU5fQVVUSCdcbiAgICBdKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgUGFzc3dvcmRsZXNzIGF1dGhlbnRpY2F0aW9uIGNvbmZpZ3VyZWQ6Jyk7XG4gICAgY29uc29sZS5sb2coJyAgIC0gU2VsZi1yZWdpc3RyYXRpb246IEVuYWJsZWQgdmlhIENESycpO1xuICAgIGNvbnNvbGUubG9nKCcgICAtIEN1c3RvbSBhdXRoIGZsb3dzOiBFbmFibGVkIGZvciBwYXNzd29yZGxlc3MnKTtcbiAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgY29uc29sZS5sb2coJ+KaoO+4jyAgTUFOVUFMIFNURVAgUkVRVUlSRUQ6Jyk7XG4gICAgY29uc29sZS5sb2coJyAgIFBsZWFzZSBlbmFibGUgXCJFbWFpbCBPVFBcIiBhdXRoZW50aWNhdGlvbiBtZXRob2QgaW4gdGhlIENvZ25pdG8gVXNlciBQb29sIGNvbnNvbGUnKTtcbiAgICBjb25zb2xlLmxvZyhgICAgR28gdG86IEFXUyBDb25zb2xlID4gQ29nbml0byA+IFVzZXIgUG9vbHMgPiAke3RoaXMudXNlclBvb2xOYW1lfSA+IFNpZ24taW4gZXhwZXJpZW5jZWApO1xuICAgIGNvbnNvbGUubG9nKCcgICBFbmFibGU6IFwiRW1haWwgT1RQXCIgdW5kZXIgQXV0aGVudGljYXRpb24gbWV0aG9kcycpO1xuICAgIGNvbnNvbGUubG9nKCcgICAoVGhpcyBzZXR0aW5nIGlzIG5vdCB5ZXQgYXZhaWxhYmxlIGluIENsb3VkRm9ybWF0aW9uL0NESyknKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpIHtcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHRoaXMudGFnQnVpbGRlci5jb25maWcuZW52aXJvbm1lbnQ7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMudGFnQnVpbGRlci5jb25maWcuYXBwTmFtZX0tVXNlclBvb2xJZC0ke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWV9LVVzZXJQb29sQ2xpZW50SWQtJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlcnNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlcnMgRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnRhZ0J1aWxkZXIuY29uZmlnLmFwcE5hbWV9LVVzZXJzVGFibGUtJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Nlc3Npb25UYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZXNzaW9uVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIFNlc3Npb25zIER5bmFtb0RCIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy50YWdCdWlsZGVyLmNvbmZpZy5hcHBOYW1lfS1TZXNzaW9uVGFibGUtJHtlbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuICB9XG59Il19