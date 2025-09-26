import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig, ResourceNames, TagBuilder, SERVICE_DOMAINS, createResourceName } from '../../../shared/cdk-utils/src';

interface AuthenticationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

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
export class AuthenticationStack extends cdk.Stack {
  public readonly userPool!: cognito.UserPool;
  public readonly userPoolClient!: cognito.UserPoolClient;
  public readonly otpTable!: dynamodb.Table;
  public readonly rateLimitTable!: dynamodb.Table;
  public readonly usersTable!: dynamodb.Table;
  public readonly sessionTable!: dynamodb.Table;

  private readonly resourceNames: ResourceNames;
  private readonly tagBuilder: TagBuilder;
  private readonly userPoolName: string;

  constructor(scope: Construct, id: string, props: AuthenticationStackProps) {
    super(scope, id, props);

    // Initialize naming and tagging utilities
    this.resourceNames = new ResourceNames(props.config);
    this.tagBuilder = new TagBuilder(props.config, SERVICE_DOMAINS.AUTHENTICATION);
    this.userPoolName = createResourceName('users', this.tagBuilder.config);

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

  private createDynamoDBTables() {
    const isProd = this.tagBuilder.config.environment === 'prod';

    // OTP Table
    (this as any).otpTable = new dynamodb.Table(this, 'OTPTable', {
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
    (this as any).rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
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
    (this as any).usersTable = new dynamodb.Table(this, 'UsersTable', {
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
    (this as any).sessionTable = new dynamodb.Table(this, 'SessionTable', {
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

  private createLambdaFunctions() {
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
      resources: ['*'], // SES doesn't support resource-level permissions for sending
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

  private createCognitoUserPool(lambdaFunctions: any) {

    // User Pool
    (this as any).userPool = new cognito.UserPool(this, 'UserPool', {
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
    (this as any).userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: createResourceName('client', this.tagBuilder.config),

      // Authentication flows
      authFlows: {
        adminUserPassword: false,
        custom: true, // Enable custom authentication flow
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

  private configurePasswordlessAuth() {
    // Use L1 construct to enable passwordless authentication
    const cfnUserPoolClient = this.userPoolClient.node.defaultChild as cognito.CfnUserPoolClient;

    // Add ALLOW_USER_AUTH flow to the app client
    // This is required for passwordless authentication
    cfnUserPoolClient.addPropertyOverride('ExplicitAuthFlows', [
      'ALLOW_CUSTOM_AUTH',
      'ALLOW_USER_AUTH', // Required for passwordless
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

  private createOutputs() {
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