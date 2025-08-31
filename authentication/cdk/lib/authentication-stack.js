"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const lambda = require("aws-cdk-lib/aws-lambda");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
class AuthenticationStack extends cdk.Stack {
    constructor(scope, id, props) {
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
    createDynamoDBTables(environment) {
        // OTP Storage Table
        this.otpTable = new dynamodb.Table(this, 'OTPTable', {
            tableName: `appreciata-auth-otps-${environment}`,
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: environment === 'prod',
            removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Rate Limiting Table
        this.rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
            tableName: `appreciata-auth-rate-limits-${environment}`,
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'request_timestamp', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Users Table
        this.usersTable = new dynamodb.Table(this, 'UsersTable', {
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
    }
    createLambdaFunctions(environment) {
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
            code: lambda.Code.fromAsset('../lambda/target/lambda/create-auth-challenge/'),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                OTP_TABLE_NAME: this.otpTable.tableName,
                RATE_LIMIT_TABLE_NAME: this.rateLimitTable.tableName,
                USERS_TABLE_NAME: this.usersTable.tableName,
                ENVIRONMENT: environment,
                FROM_EMAIL: `noreply@appreciata.com`,
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
    createCognitoUserPool(environment, lambdaFunctions) {
        // User Pool - force replacement by changing the construct ID
        this.userPool = new cognito.UserPool(this, 'UserPoolV2', {
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
        this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClientV2', {
            userPool: this.userPool,
            userPoolClientName: `appreciata-client-${environment}-v2`,
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
        // Note: Email OTP authentication method needs to be enabled manually in the AWS Console
        // or through AWS CLI as it's not yet supported in CloudFormation/CDK
        console.log('⚠️  MANUAL STEP REQUIRED:');
        console.log('   Please enable "Email OTP" authentication method in the Cognito User Pool console');
        console.log('   Go to: AWS Console > Cognito > User Pools > appreciata-users-dev > Sign-in experience');
        console.log('   Enable: "Email OTP" under Authentication methods');
    }
    createOutputs() {
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
    }
}
exports.AuthenticationStack = AuthenticationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb24tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdXRoZW50aWNhdGlvbi1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsbURBQW1EO0FBQ25ELGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQsMkNBQTJDO0FBTzNDLE1BQWEsbUJBQW9CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFPaEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUErQjtRQUN2RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU3Qyx3Q0FBd0M7UUFDeEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV0RSwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFFL0Qsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBRWpDLFVBQVU7UUFDVixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVPLG9CQUFvQixDQUFDLFdBQW1CO1FBQzlDLG9CQUFvQjtRQUNuQixJQUFZLENBQUMsUUFBUSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQzVELFNBQVMsRUFBRSx3QkFBd0IsV0FBVyxFQUFFO1lBQ2hELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3BFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7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LEVBQUUsdUJBQXVCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssRUFBRTtTQUNyRixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE1VkQsa0RBNFZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5pbnRlcmZhY2UgQXV0aGVudGljYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQXV0aGVudGljYXRpb25TdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbCE6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudCE6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSBvdHBUYWJsZSE6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgcmF0ZUxpbWl0VGFibGUhOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJzVGFibGUhOiBkeW5hbW9kYi5UYWJsZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXV0aGVudGljYXRpb25TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICB0aGlzLmNyZWF0ZUR5bmFtb0RCVGFibGVzKHByb3BzLmVudmlyb25tZW50KTtcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnMgZm9yIENvZ25pdG8gVHJpZ2dlcnNcbiAgICBjb25zdCBsYW1iZGFGdW5jdGlvbnMgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9ucyhwcm9wcy5lbnZpcm9ubWVudCk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCB3aXRoIEN1c3RvbSBBdXRoZW50aWNhdGlvblxuICAgIHRoaXMuY3JlYXRlQ29nbml0b1VzZXJQb29sKHByb3BzLmVudmlyb25tZW50LCBsYW1iZGFGdW5jdGlvbnMpO1xuXG4gICAgLy8gQ29uZmlndXJlIHBhc3N3b3JkbGVzcyBhdXRoZW50aWNhdGlvblxuICAgIHRoaXMuY29uZmlndXJlUGFzc3dvcmRsZXNzQXV0aCgpO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEeW5hbW9EQlRhYmxlcyhlbnZpcm9ubWVudDogc3RyaW5nKSB7XG4gICAgLy8gT1RQIFN0b3JhZ2UgVGFibGVcbiAgICAodGhpcyBhcyBhbnkpLm90cFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdPVFBUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGFwcHJlY2lhdGEtYXV0aC1vdHBzLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gUmF0ZSBMaW1pdGluZyBUYWJsZVxuICAgICh0aGlzIGFzIGFueSkucmF0ZUxpbWl0VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1JhdGVMaW1pdFRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgYXBwcmVjaWF0YS1hdXRoLXJhdGUtbGltaXRzLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAncmVxdWVzdF90aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBVc2VycyBUYWJsZVxuICAgICh0aGlzIGFzIGFueSkudXNlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXNlcnNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGFwcHJlY2lhdGEtdXNlcnMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VyX2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBHU0kgZm9yIGVtYWlsIGxvb2t1cFxuICAgIHRoaXMudXNlcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdlbWFpbC1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXG4gICAgfSk7XG5cbiAgICAvLyBHU0kgZm9yIHN0YXR1cyBxdWVyaWVzIChmb3IgYWRtaW4gZGFzaGJvYXJkKVxuICAgIHRoaXMudXNlcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdzdGF0dXMtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdGF0dXMnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZF9hdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbnMoZW52aXJvbm1lbnQ6IHN0cmluZykge1xuICAgIC8vIElBTSByb2xlIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQXV0aExhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIHRoaXMub3RwVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIHRoaXMucmF0ZUxpbWl0VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBHcmFudCBTRVMgcGVybWlzc2lvbnNcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NlczpTZW5kRW1haWwnLFxuICAgICAgICAnc2VzOlNlbmRSYXdFbWFpbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gUmVzdHJpY3QgdGhpcyB0byB5b3VyIHZlcmlmaWVkIGRvbWFpbiBpbiBwcm9kdWN0aW9uXG4gICAgfSkpO1xuXG4gICAgLy8gR3JhbnQgQ29nbml0byBhZG1pbiBwZXJtaXNzaW9ucyBmb3IgdXNlciBtYW5hZ2VtZW50XG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNvbmZpcm1TaWduVXAnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpjb2duaXRvLWlkcDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dXNlcnBvb2wvKmBcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gQ3JlYXRlIEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IGNyZWF0ZUF1dGhDaGFsbGVuZ2UgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVBdXRoQ2hhbGxlbmdlJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgYXBwcmVjaWF0YS1hdXRoLWNyZWF0ZS1jaGFsbGVuZ2UtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbmV3IGxhbWJkYS5SdW50aW1lKCdwcm92aWRlZC5hbDIwMjMnKSxcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYW1iZGEvdGFyZ2V0L2xhbWJkYS9jcmVhdGUtYXV0aC1jaGFsbGVuZ2UvJyksIC8vIFdpbGwgYmUgYnVpbHQgc2VwYXJhdGVseVxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE9UUF9UQUJMRV9OQU1FOiB0aGlzLm90cFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUkFURV9MSU1JVF9UQUJMRV9OQU1FOiB0aGlzLnJhdGVMaW1pdFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUlNfVEFCTEVfTkFNRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBGUk9NX0VNQUlMOiBgbm9yZXBseUBhcHByZWNpYXRhLmNvbWAsIC8vIFVwZGF0ZSB3aXRoIHlvdXIgdmVyaWZpZWQgU0VTIGRvbWFpblxuICAgICAgICBERVBMT1lNRU5UX1RJTUVTVEFNUDogRGF0ZS5ub3coKS50b1N0cmluZygpLCAvLyBGb3JjZSByZWRlcGxveW1lbnRcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgfSk7XG5cbiAgICAvLyBWZXJpZnkgQXV0aCBDaGFsbGVuZ2UgTGFtYmRhXG4gICAgY29uc3QgdmVyaWZ5QXV0aENoYWxsZW5nZSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1ZlcmlmeUF1dGhDaGFsbGVuZ2UnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBhcHByZWNpYXRhLWF1dGgtdmVyaWZ5LWNoYWxsZW5nZS0ke2Vudmlyb25tZW50fWAsXG4gICAgICBydW50aW1lOiBuZXcgbGFtYmRhLlJ1bnRpbWUoJ3Byb3ZpZGVkLmFsMjAyMycpLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2xhbWJkYS90YXJnZXQvbGFtYmRhL3ZlcmlmeS1hdXRoLWNoYWxsZW5nZS8nKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBPVFBfVEFCTEVfTkFNRTogdGhpcy5vdHBUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJTX1RBQkxFX05BTUU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgREVQTE9ZTUVOVF9USU1FU1RBTVA6IERhdGUubm93KCkudG9TdHJpbmcoKSwgLy8gRm9yY2UgcmVkZXBsb3ltZW50XG4gICAgICB9LFxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgIH0pO1xuXG4gICAgLy8gRGVmaW5lIEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IGRlZmluZUF1dGhDaGFsbGVuZ2UgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWZpbmVBdXRoQ2hhbGxlbmdlJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgYXBwcmVjaWF0YS1hdXRoLWRlZmluZS1jaGFsbGVuZ2UtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbmV3IGxhbWJkYS5SdW50aW1lKCdwcm92aWRlZC5hbDIwMjMnKSxcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYW1iZGEvdGFyZ2V0L2xhbWJkYS9kZWZpbmUtYXV0aC1jaGFsbGVuZ2UvJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBERVBMT1lNRU5UX1RJTUVTVEFNUDogRGF0ZS5ub3coKS50b1N0cmluZygpLCAvLyBGb3JjZSByZWRlcGxveW1lbnRcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY3JlYXRlQXV0aENoYWxsZW5nZSxcbiAgICAgIHZlcmlmeUF1dGhDaGFsbGVuZ2UsXG4gICAgICBkZWZpbmVBdXRoQ2hhbGxlbmdlLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUNvZ25pdG9Vc2VyUG9vbChlbnZpcm9ubWVudDogc3RyaW5nLCBsYW1iZGFGdW5jdGlvbnM6IGFueSkge1xuICAgIC8vIFVzZXIgUG9vbCAtIGZvcmNlIHJlcGxhY2VtZW50IGJ5IGNoYW5naW5nIHRoZSBjb25zdHJ1Y3QgSURcbiAgICAodGhpcyBhcyBhbnkpLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sVjInLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGBhcHByZWNpYXRhLXVzZXJzLSR7ZW52aXJvbm1lbnR9LXYyYCxcblxuICAgICAgLy8gU2lnbi1pbiBjb25maWd1cmF0aW9uXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB1c2VybmFtZTogZmFsc2UsXG4gICAgICAgIHBob25lOiBmYWxzZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIEF1dG8tdmVyaWZpZWQgYXR0cmlidXRlc1xuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogZmFsc2UsIC8vIFdlIGhhbmRsZSB2ZXJpZmljYXRpb24gdmlhIE9UUFxuICAgICAgfSxcblxuICAgICAgLy8gU3RhbmRhcmQgYXR0cmlidXRlc1xuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIEN1c3RvbSBhdHRyaWJ1dGVzIGZvciBvdXIgdXNlciBzdGF0dXNcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgJ3VzZXJfc3RhdHVzJzogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiA1MCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgJ3N0cmlwZV9hY2NvdW50X2lkJzogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDEsXG4gICAgICAgICAgbWF4TGVuOiAxMDAsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuXG4gICAgICAvLyBQYXNzd29yZCBwb2xpY3kgKG5vdCB1c2VkIGJ1dCByZXF1aXJlZClcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTIsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcblxuICAgICAgLy8gQWNjb3VudCByZWNvdmVyeVxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuXG4gICAgICAvLyBFbmFibGUgcGFzc3dvcmRsZXNzIGF1dGhlbnRpY2F0aW9uXG4gICAgICBzaWduSW5DYXNlU2Vuc2l0aXZlOiBmYWxzZSxcblxuICAgICAgLy8gTGFtYmRhIHRyaWdnZXJzIGZvciBjdXN0b20gYXV0aFxuICAgICAgbGFtYmRhVHJpZ2dlcnM6IHtcbiAgICAgICAgY3JlYXRlQXV0aENoYWxsZW5nZTogbGFtYmRhRnVuY3Rpb25zLmNyZWF0ZUF1dGhDaGFsbGVuZ2UsXG4gICAgICAgIGRlZmluZUF1dGhDaGFsbGVuZ2U6IGxhbWJkYUZ1bmN0aW9ucy5kZWZpbmVBdXRoQ2hhbGxlbmdlLFxuICAgICAgICB2ZXJpZnlBdXRoQ2hhbGxlbmdlUmVzcG9uc2U6IGxhbWJkYUZ1bmN0aW9ucy52ZXJpZnlBdXRoQ2hhbGxlbmdlLFxuICAgICAgfSxcblxuICAgICAgLy8gRGVsZXRpb24gcHJvdGVjdGlvblxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuXG4gICAgICAvLyBSZW1vdmUgZGVmYXVsdCBwb2xpY3lcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gVXNlciBQb29sIENsaWVudFxuICAgICh0aGlzIGFzIGFueSkudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnVXNlclBvb2xDbGllbnRWMicsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiBgYXBwcmVjaWF0YS1jbGllbnQtJHtlbnZpcm9ubWVudH0tdjJgLFxuXG4gICAgICAvLyBBdXRoZW50aWNhdGlvbiBmbG93c1xuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgICAgY3VzdG9tOiB0cnVlLCAvLyBFbmFibGUgY3VzdG9tIGF1dGhlbnRpY2F0aW9uIGZsb3dcbiAgICAgICAgdXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgICAgdXNlclNycDogZmFsc2UsXG4gICAgICB9LFxuXG4gICAgICAvLyBUb2tlbiB2YWxpZGl0eVxuICAgICAgYWNjZXNzVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICByZWZyZXNoVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuXG4gICAgICAvLyBQcmV2ZW50IHVzZXIgZXhpc3RlbmNlIGVycm9yc1xuICAgICAgcHJldmVudFVzZXJFeGlzdGVuY2VFcnJvcnM6IHRydWUsXG5cbiAgICAgIC8vIFN1cHBvcnRlZCBpZGVudGl0eSBwcm92aWRlcnNcbiAgICAgIHN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzOiBbXG4gICAgICAgIGNvZ25pdG8uVXNlclBvb2xDbGllbnRJZGVudGl0eVByb3ZpZGVyLkNPR05JVE8sXG4gICAgICBdLFxuXG4gICAgICAvLyBPQXV0aCBzZXR0aW5ncyBkaXNhYmxlZCBmb3IgY3VzdG9tIGF1dGggZmxvd1xuICAgICAgLy8gb0F1dGg6IHtcbiAgICAgIC8vICAgZmxvd3M6IHtcbiAgICAgIC8vICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiBmYWxzZSxcbiAgICAgIC8vICAgICBpbXBsaWNpdENvZGVHcmFudDogZmFsc2UsXG4gICAgICAvLyAgIH0sXG4gICAgICAvLyB9LFxuXG4gICAgICAvLyBTZWN1cml0eVxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLCAvLyBGb3Igd2ViIGFwcGxpY2F0aW9uc1xuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQ29nbml0byBwZXJtaXNzaW9uIHRvIGludm9rZSBMYW1iZGEgZnVuY3Rpb25zXG4gICAgbGFtYmRhRnVuY3Rpb25zLmNyZWF0ZUF1dGhDaGFsbGVuZ2UuYWRkUGVybWlzc2lvbignQ29nbml0b0ludm9rZUNyZWF0ZUNoYWxsZW5nZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgfSk7XG5cbiAgICBsYW1iZGFGdW5jdGlvbnMudmVyaWZ5QXV0aENoYWxsZW5nZS5hZGRQZXJtaXNzaW9uKCdDb2duaXRvSW52b2tlVmVyaWZ5Q2hhbGxlbmdlJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2NvZ25pdG8taWRwLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybixcbiAgICB9KTtcblxuICAgIGxhbWJkYUZ1bmN0aW9ucy5kZWZpbmVBdXRoQ2hhbGxlbmdlLmFkZFBlcm1pc3Npb24oJ0NvZ25pdG9JbnZva2VEZWZpbmVDaGFsbGVuZ2UnLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY29nbml0by1pZHAuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25maWd1cmVQYXNzd29yZGxlc3NBdXRoKCkge1xuICAgIC8vIFVzZSBMMSBjb25zdHJ1Y3QgdG8gZW5hYmxlIHBhc3N3b3JkbGVzcyBhdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IGNmblVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbENsaWVudC5ub2RlLmRlZmF1bHRDaGlsZCBhcyBjb2duaXRvLkNmblVzZXJQb29sQ2xpZW50O1xuICAgIFxuICAgIC8vIEFkZCBBTExPV19VU0VSX0FVVEggZmxvdyB0byB0aGUgYXBwIGNsaWVudFxuICAgIC8vIFRoaXMgaXMgcmVxdWlyZWQgZm9yIHBhc3N3b3JkbGVzcyBhdXRoZW50aWNhdGlvblxuICAgIGNmblVzZXJQb29sQ2xpZW50LmFkZFByb3BlcnR5T3ZlcnJpZGUoJ0V4cGxpY2l0QXV0aEZsb3dzJywgW1xuICAgICAgJ0FMTE9XX0NVU1RPTV9BVVRIJyxcbiAgICAgICdBTExPV19VU0VSX0FVVEgnLCAvLyBSZXF1aXJlZCBmb3IgcGFzc3dvcmRsZXNzXG4gICAgICAnQUxMT1dfUkVGUkVTSF9UT0tFTl9BVVRIJ1xuICAgIF0pO1xuXG4gICAgLy8gTm90ZTogRW1haWwgT1RQIGF1dGhlbnRpY2F0aW9uIG1ldGhvZCBuZWVkcyB0byBiZSBlbmFibGVkIG1hbnVhbGx5IGluIHRoZSBBV1MgQ29uc29sZVxuICAgIC8vIG9yIHRocm91Z2ggQVdTIENMSSBhcyBpdCdzIG5vdCB5ZXQgc3VwcG9ydGVkIGluIENsb3VkRm9ybWF0aW9uL0NES1xuICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIE1BTlVBTCBTVEVQIFJFUVVJUkVEOicpO1xuICAgIGNvbnNvbGUubG9nKCcgICBQbGVhc2UgZW5hYmxlIFwiRW1haWwgT1RQXCIgYXV0aGVudGljYXRpb24gbWV0aG9kIGluIHRoZSBDb2duaXRvIFVzZXIgUG9vbCBjb25zb2xlJyk7XG4gICAgY29uc29sZS5sb2coJyAgIEdvIHRvOiBBV1MgQ29uc29sZSA+IENvZ25pdG8gPiBVc2VyIFBvb2xzID4gYXBwcmVjaWF0YS11c2Vycy1kZXYgPiBTaWduLWluIGV4cGVyaWVuY2UnKTtcbiAgICBjb25zb2xlLmxvZygnICAgRW5hYmxlOiBcIkVtYWlsIE9UUFwiIHVuZGVyIEF1dGhlbnRpY2F0aW9uIG1ldGhvZHMnKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpIHtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBBcHJlY2lhdGFVc2VyUG9vbElkLSR7dGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgJ2Rldid9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBBcHJlY2lhdGFVc2VyUG9vbENsaWVudElkLSR7dGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgJ2Rldid9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbEFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXJzIER5bmFtb0RCIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYEFwcmVjaWF0YVVzZXJzVGFibGUtJHt0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2J31gLFxuICAgIH0pO1xuICB9XG59Il19