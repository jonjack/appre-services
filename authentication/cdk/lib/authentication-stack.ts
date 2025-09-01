import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface AuthenticationStackProps extends cdk.StackProps {
  environment: string;
}

export class AuthenticationStack extends cdk.Stack {
  public readonly userPool!: cognito.UserPool;
  public readonly userPoolClient!: cognito.UserPoolClient;
  public readonly otpTable!: dynamodb.Table;
  public readonly rateLimitTable!: dynamodb.Table;
  public readonly usersTable!: dynamodb.Table;
  public readonly sessionTable!: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AuthenticationStackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    this.createDynamoDBTables(props.environment);

    // Lambda Functions for Cognito Triggers
    const lambdaFunctions = this.createLambdaFunctions(props.environment);

    // Cognito User Pool with Custom Authentication
    this.createCognitoUserPool(props.environment, lambdaFunctions);

    // Configure passwordless authentication
    this.configurePasswordlessAuth();

    // Outputs
    this.createOutputs();
  }

  private createDynamoDBTables(environment: string) {
    // OTP Storage Table
    (this as any).otpTable = new dynamodb.Table(this, 'OTPTable', {
      tableName: `appreciata-auth-otps-${environment}`,
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: environment === 'prod',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Rate Limiting Table
    (this as any).rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `appreciata-auth-rate-limits-${environment}`,
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'request_timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Users Table
    (this as any).usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `appreciata-users-${environment}`,
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: environment === 'prod',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for email lookup
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for status queries (for admin dashboard)
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // User Sessions Table
    (this as any).sessionTable = new dynamodb.Table(this, 'SessionTable', {
      tableName: `user-sessions-${environment}`,
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: environment === 'prod',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for user lookup (to find all sessions for a user)
    this.sessionTable.addGlobalSecondaryIndex({
      indexName: 'user-sessions-index',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for cleanup queries (optional - for monitoring expired sessions)
    this.sessionTable.addGlobalSecondaryIndex({
      indexName: 'expires-at-index',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'expires_at', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });
  }

  private createLambdaFunctions(environment: string) {
    // IAM role for Lambda functions
    const lambdaRole = new iam.Role(this, 'AuthLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions
    this.otpTable.grantReadWriteData(lambdaRole);
    this.rateLimitTable.grantReadWriteData(lambdaRole);
    this.usersTable.grantReadWriteData(lambdaRole);
    this.sessionTable.grantReadWriteData(lambdaRole);

    // Grant SES permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
      resources: ['*'], // Restrict this to your verified domain in production
    }));

    // Grant Cognito admin permissions for user management
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
    }));

    // Create Auth Challenge Lambda
    const createAuthChallenge = new lambda.Function(this, 'CreateAuthChallenge', {
      functionName: `appreciata-auth-create-challenge-${environment}`,
      runtime: new lambda.Runtime('provided.al2023'),
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../lambda/target/lambda/create-auth-challenge/'), // Will be built separately
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        OTP_TABLE_NAME: this.otpTable.tableName,
        RATE_LIMIT_TABLE_NAME: this.rateLimitTable.tableName,
        USERS_TABLE_NAME: this.usersTable.tableName,
        SESSION_TABLE_NAME: this.sessionTable.tableName,
        ENVIRONMENT: environment,
        FROM_EMAIL: `noreply@appreciata.com`, // Update with your verified SES domain
        DEPLOYMENT_TIMESTAMP: Date.now().toString(), // Force redeployment
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Verify Auth Challenge Lambda
    const verifyAuthChallenge = new lambda.Function(this, 'VerifyAuthChallenge', {
      functionName: `appreciata-auth-verify-challenge-${environment}`,
      runtime: new lambda.Runtime('provided.al2023'),
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../lambda/target/lambda/verify-auth-challenge/'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        OTP_TABLE_NAME: this.otpTable.tableName,
        USERS_TABLE_NAME: this.usersTable.tableName,
        SESSION_TABLE_NAME: this.sessionTable.tableName,
        ENVIRONMENT: environment,
        DEPLOYMENT_TIMESTAMP: Date.now().toString(), // Force redeployment
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Define Auth Challenge Lambda
    const defineAuthChallenge = new lambda.Function(this, 'DefineAuthChallenge', {
      functionName: `appreciata-auth-define-challenge-${environment}`,
      runtime: new lambda.Runtime('provided.al2023'),
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../lambda/target/lambda/define-auth-challenge/'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        ENVIRONMENT: environment,
        DEPLOYMENT_TIMESTAMP: Date.now().toString(), // Force redeployment
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    return {
      createAuthChallenge,
      verifyAuthChallenge,
      defineAuthChallenge,
    };
  }

  private createCognitoUserPool(environment: string, lambdaFunctions: any) {
    // User Pool - force replacement by changing the construct ID
    (this as any).userPool = new cognito.UserPool(this, 'UserPoolV2', {
      userPoolName: `appreciata-users-${environment}-v2`,

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
      },

      // Deletion protection
      deletionProtection: environment === 'prod',

      // Remove default policy
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    (this as any).userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClientV2', {
      userPool: this.userPool,
      userPoolClientName: `appreciata-client-${environment}-v2`,

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

    // Note: Email OTP authentication method needs to be enabled manually in the AWS Console
    // or through AWS CLI as it's not yet supported in CloudFormation/CDK
    console.log('⚠️  MANUAL STEP REQUIRED:');
    console.log('   Please enable "Email OTP" authentication method in the Cognito User Pool console');
    console.log('   Go to: AWS Console > Cognito > User Pools > appreciata-users-dev > Sign-in experience');
    console.log('   Enable: "Email OTP" under Authentication methods');
  }

  private createOutputs() {
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `ApreciataUserPoolId-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `ApreciataUserPoolClientId-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: `ApreciataUsersTable-${this.node.tryGetContext('environment') || 'dev'}`,
    });

    new cdk.CfnOutput(this, 'SessionTableName', {
      value: this.sessionTable.tableName,
      description: 'User Sessions DynamoDB Table Name',
      exportName: `ApreciataSessionTable-${this.node.tryGetContext('environment') || 'dev'}`,
    });
  }
}