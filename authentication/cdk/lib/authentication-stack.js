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
        // User Sessions Table
        this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
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
            code: lambda.Code.fromAsset('../lambda/target/lambda/create-auth-challenge/'),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                OTP_TABLE_NAME: this.otpTable.tableName,
                RATE_LIMIT_TABLE_NAME: this.rateLimitTable.tableName,
                USERS_TABLE_NAME: this.usersTable.tableName,
                SESSION_TABLE_NAME: this.sessionTable.tableName,
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
        new cdk.CfnOutput(this, 'SessionTableName', {
            value: this.sessionTable.tableName,
            description: 'User Sessions DynamoDB Table Name',
            exportName: `ApreciataSessionTable-${this.node.tryGetContext('environment') || 'dev'}`,
        });
    }
}
exports.AuthenticationStack = AuthenticationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb24tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdXRoZW50aWNhdGlvbi1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsbURBQW1EO0FBQ25ELGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQsMkNBQTJDO0FBTzNDLE1BQWEsbUJBQW9CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFRaEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUErQjtRQUN2RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU3Qyx3Q0FBd0M7UUFDeEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV0RSwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFFL0Qsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBRWpDLFVBQVU7UUFDVixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVPLG9CQUFvQixDQUFDLFdBQW1CO1FBQzlDLG9CQUFvQjtRQUNuQixJQUFZLENBQUMsUUFBUSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQzVELFNBQVMsRUFBRSx3QkFBd0IsV0FBVyxFQUFFO1lBQ2hELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3BFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7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SUFBSSxLQUFLLEVBQUU7U0FDM0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVztZQUNoQyxXQUFXLEVBQUUsdUJBQXVCO1NBQ3JDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUztZQUNoQyxXQUFXLEVBQUUsMkJBQTJCO1lBQ3hDLFVBQVUsRUFBRSx1QkFBdUIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFO1NBQ3JGLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUztZQUNsQyxXQUFXLEVBQUUsbUNBQW1DO1lBQ2hELFVBQVUsRUFBRSx5QkFBeUIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxFQUFFO1NBQ3ZGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWpZRCxrREFpWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmludGVyZmFjZSBBdXRoZW50aWNhdGlvblN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBdXRoZW50aWNhdGlvblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sITogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50ITogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IG90cFRhYmxlITogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSByYXRlTGltaXRUYWJsZSE6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlcnNUYWJsZSE6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgc2Vzc2lvblRhYmxlITogZHluYW1vZGIuVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEF1dGhlbnRpY2F0aW9uU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgdGhpcy5jcmVhdGVEeW5hbW9EQlRhYmxlcyhwcm9wcy5lbnZpcm9ubWVudCk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25zIGZvciBDb2duaXRvIFRyaWdnZXJzXG4gICAgY29uc3QgbGFtYmRhRnVuY3Rpb25zID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbnMocHJvcHMuZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgd2l0aCBDdXN0b20gQXV0aGVudGljYXRpb25cbiAgICB0aGlzLmNyZWF0ZUNvZ25pdG9Vc2VyUG9vbChwcm9wcy5lbnZpcm9ubWVudCwgbGFtYmRhRnVuY3Rpb25zKTtcblxuICAgIC8vIENvbmZpZ3VyZSBwYXNzd29yZGxlc3MgYXV0aGVudGljYXRpb25cbiAgICB0aGlzLmNvbmZpZ3VyZVBhc3N3b3JkbGVzc0F1dGgoKTtcblxuICAgIC8vIE91dHB1dHNcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRHluYW1vREJUYWJsZXMoZW52aXJvbm1lbnQ6IHN0cmluZykge1xuICAgIC8vIE9UUCBTdG9yYWdlIFRhYmxlXG4gICAgKHRoaXMgYXMgYW55KS5vdHBUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnT1RQVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGBhcHByZWNpYXRhLWF1dGgtb3Rwcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFJhdGUgTGltaXRpbmcgVGFibGVcbiAgICAodGhpcyBhcyBhbnkpLnJhdGVMaW1pdFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdSYXRlTGltaXRUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGFwcHJlY2lhdGEtYXV0aC1yYXRlLWxpbWl0cy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3JlcXVlc3RfdGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gVXNlcnMgVGFibGVcbiAgICAodGhpcyBhcyBhbnkpLnVzZXJzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzZXJzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGBhcHByZWNpYXRhLXVzZXJzLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcl9pZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gR1NJIGZvciBlbWFpbCBsb29rdXBcbiAgICB0aGlzLnVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZW1haWwtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdlbWFpbCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gR1NJIGZvciBzdGF0dXMgcXVlcmllcyAoZm9yIGFkbWluIGRhc2hib2FyZClcbiAgICB0aGlzLnVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnc3RhdHVzLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc3RhdHVzJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NyZWF0ZWRfYXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgU2Vzc2lvbnMgVGFibGVcbiAgICAodGhpcyBhcyBhbnkpLnNlc3Npb25UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2Vzc2lvblRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgdXNlci1zZXNzaW9ucy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Nlc3Npb25faWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdleHBpcmVzX2F0JyxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgdXNlciBsb29rdXAgKHRvIGZpbmQgYWxsIHNlc3Npb25zIGZvciBhIHVzZXIpXG4gICAgdGhpcy5zZXNzaW9uVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAndXNlci1zZXNzaW9ucy1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJfaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZF9hdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gR1NJIGZvciBjbGVhbnVwIHF1ZXJpZXMgKG9wdGlvbmFsIC0gZm9yIG1vbml0b3JpbmcgZXhwaXJlZCBzZXNzaW9ucylcbiAgICB0aGlzLnNlc3Npb25UYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdleHBpcmVzLWF0LWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcl9pZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdleHBpcmVzX2F0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5LRVlTX09OTFksXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUZ1bmN0aW9ucyhlbnZpcm9ubWVudDogc3RyaW5nKSB7XG4gICAgLy8gSUFNIHJvbGUgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBdXRoTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgdGhpcy5vdHBUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgdGhpcy5yYXRlTGltaXRUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcbiAgICB0aGlzLnNlc3Npb25UYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBHcmFudCBTRVMgcGVybWlzc2lvbnNcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NlczpTZW5kRW1haWwnLFxuICAgICAgICAnc2VzOlNlbmRSYXdFbWFpbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gUmVzdHJpY3QgdGhpcyB0byB5b3VyIHZlcmlmaWVkIGRvbWFpbiBpbiBwcm9kdWN0aW9uXG4gICAgfSkpO1xuXG4gICAgLy8gR3JhbnQgQ29nbml0byBhZG1pbiBwZXJtaXNzaW9ucyBmb3IgdXNlciBtYW5hZ2VtZW50XG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNvbmZpcm1TaWduVXAnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpjb2duaXRvLWlkcDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dXNlcnBvb2wvKmBcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gQ3JlYXRlIEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IGNyZWF0ZUF1dGhDaGFsbGVuZ2UgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVBdXRoQ2hhbGxlbmdlJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgYXBwcmVjaWF0YS1hdXRoLWNyZWF0ZS1jaGFsbGVuZ2UtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbmV3IGxhbWJkYS5SdW50aW1lKCdwcm92aWRlZC5hbDIwMjMnKSxcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYW1iZGEvdGFyZ2V0L2xhbWJkYS9jcmVhdGUtYXV0aC1jaGFsbGVuZ2UvJyksIC8vIFdpbGwgYmUgYnVpbHQgc2VwYXJhdGVseVxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE9UUF9UQUJMRV9OQU1FOiB0aGlzLm90cFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUkFURV9MSU1JVF9UQUJMRV9OQU1FOiB0aGlzLnJhdGVMaW1pdFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUlNfVEFCTEVfTkFNRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU0VTU0lPTl9UQUJMRV9OQU1FOiB0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgRlJPTV9FTUFJTDogYG5vcmVwbHlAYXBwcmVjaWF0YS5jb21gLCAvLyBVcGRhdGUgd2l0aCB5b3VyIHZlcmlmaWVkIFNFUyBkb21haW5cbiAgICAgICAgREVQTE9ZTUVOVF9USU1FU1RBTVA6IERhdGUubm93KCkudG9TdHJpbmcoKSwgLy8gRm9yY2UgcmVkZXBsb3ltZW50XG4gICAgICB9LFxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxuICAgIH0pO1xuXG4gICAgLy8gVmVyaWZ5IEF1dGggQ2hhbGxlbmdlIExhbWJkYVxuICAgIGNvbnN0IHZlcmlmeUF1dGhDaGFsbGVuZ2UgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdWZXJpZnlBdXRoQ2hhbGxlbmdlJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgYXBwcmVjaWF0YS1hdXRoLXZlcmlmeS1jaGFsbGVuZ2UtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbmV3IGxhbWJkYS5SdW50aW1lKCdwcm92aWRlZC5hbDIwMjMnKSxcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYW1iZGEvdGFyZ2V0L2xhbWJkYS92ZXJpZnktYXV0aC1jaGFsbGVuZ2UvJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgT1RQX1RBQkxFX05BTUU6IHRoaXMub3RwVGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSU19UQUJMRV9OQU1FOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTRVNTSU9OX1RBQkxFX05BTUU6IHRoaXMuc2Vzc2lvblRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBERVBMT1lNRU5UX1RJTUVTVEFNUDogRGF0ZS5ub3coKS50b1N0cmluZygpLCAvLyBGb3JjZSByZWRlcGxveW1lbnRcbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXG4gICAgfSk7XG5cbiAgICAvLyBEZWZpbmUgQXV0aCBDaGFsbGVuZ2UgTGFtYmRhXG4gICAgY29uc3QgZGVmaW5lQXV0aENoYWxsZW5nZSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RlZmluZUF1dGhDaGFsbGVuZ2UnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBhcHByZWNpYXRhLWF1dGgtZGVmaW5lLWNoYWxsZW5nZS0ke2Vudmlyb25tZW50fWAsXG4gICAgICBydW50aW1lOiBuZXcgbGFtYmRhLlJ1bnRpbWUoJ3Byb3ZpZGVkLmFsMjAyMycpLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2xhbWJkYS90YXJnZXQvbGFtYmRhL2RlZmluZS1hdXRoLWNoYWxsZW5nZS8nKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIERFUExPWU1FTlRfVElNRVNUQU1QOiBEYXRlLm5vdygpLnRvU3RyaW5nKCksIC8vIEZvcmNlIHJlZGVwbG95bWVudFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBjcmVhdGVBdXRoQ2hhbGxlbmdlLFxuICAgICAgdmVyaWZ5QXV0aENoYWxsZW5nZSxcbiAgICAgIGRlZmluZUF1dGhDaGFsbGVuZ2UsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ29nbml0b1VzZXJQb29sKGVudmlyb25tZW50OiBzdHJpbmcsIGxhbWJkYUZ1bmN0aW9uczogYW55KSB7XG4gICAgLy8gVXNlciBQb29sIC0gZm9yY2UgcmVwbGFjZW1lbnQgYnkgY2hhbmdpbmcgdGhlIGNvbnN0cnVjdCBJRFxuICAgICh0aGlzIGFzIGFueSkudXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnVXNlclBvb2xWMicsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogYGFwcHJlY2lhdGEtdXNlcnMtJHtlbnZpcm9ubWVudH0tdjJgLFxuXG4gICAgICAvLyBTaWduLWluIGNvbmZpZ3VyYXRpb25cbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIHVzZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgcGhvbmU6IGZhbHNlLFxuICAgICAgfSxcblxuICAgICAgLy8gQXV0by12ZXJpZmllZCBhdHRyaWJ1dGVzXG4gICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgIGVtYWlsOiBmYWxzZSwgLy8gV2UgaGFuZGxlIHZlcmlmaWNhdGlvbiB2aWEgT1RQXG4gICAgICB9LFxuXG4gICAgICAvLyBTdGFuZGFyZCBhdHRyaWJ1dGVzXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcblxuICAgICAgLy8gQ3VzdG9tIGF0dHJpYnV0ZXMgZm9yIG91ciB1c2VyIHN0YXR1c1xuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICAndXNlcl9zdGF0dXMnOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG1pbkxlbjogMSxcbiAgICAgICAgICBtYXhMZW46IDUwLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICAnc3RyaXBlX2FjY291bnRfaWQnOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xuICAgICAgICAgIG1pbkxlbjogMSxcbiAgICAgICAgICBtYXhMZW46IDEwMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIFBhc3N3b3JkIHBvbGljeSAobm90IHVzZWQgYnV0IHJlcXVpcmVkKVxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiAxMixcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXG4gICAgICB9LFxuXG4gICAgICAvLyBBY2NvdW50IHJlY292ZXJ5XG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG5cbiAgICAgIC8vIEVuYWJsZSBwYXNzd29yZGxlc3MgYXV0aGVudGljYXRpb25cbiAgICAgIHNpZ25JbkNhc2VTZW5zaXRpdmU6IGZhbHNlLFxuXG4gICAgICAvLyBMYW1iZGEgdHJpZ2dlcnMgZm9yIGN1c3RvbSBhdXRoXG4gICAgICBsYW1iZGFUcmlnZ2Vyczoge1xuICAgICAgICBjcmVhdGVBdXRoQ2hhbGxlbmdlOiBsYW1iZGFGdW5jdGlvbnMuY3JlYXRlQXV0aENoYWxsZW5nZSxcbiAgICAgICAgZGVmaW5lQXV0aENoYWxsZW5nZTogbGFtYmRhRnVuY3Rpb25zLmRlZmluZUF1dGhDaGFsbGVuZ2UsXG4gICAgICAgIHZlcmlmeUF1dGhDaGFsbGVuZ2VSZXNwb25zZTogbGFtYmRhRnVuY3Rpb25zLnZlcmlmeUF1dGhDaGFsbGVuZ2UsXG4gICAgICB9LFxuXG4gICAgICAvLyBEZWxldGlvbiBwcm90ZWN0aW9uXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGVudmlyb25tZW50ID09PSAncHJvZCcsXG5cbiAgICAgIC8vIFJlbW92ZSBkZWZhdWx0IHBvbGljeVxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBVc2VyIFBvb2wgQ2xpZW50XG4gICAgKHRoaXMgYXMgYW55KS51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdVc2VyUG9vbENsaWVudFYyJywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGBhcHByZWNpYXRhLWNsaWVudC0ke2Vudmlyb25tZW50fS12MmAsXG5cbiAgICAgIC8vIEF1dGhlbnRpY2F0aW9uIGZsb3dzXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgICBjdXN0b206IHRydWUsIC8vIEVuYWJsZSBjdXN0b20gYXV0aGVudGljYXRpb24gZmxvd1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgICB1c2VyU3JwOiBmYWxzZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIFRva2VuIHZhbGlkaXR5XG4gICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG5cbiAgICAgIC8vIFByZXZlbnQgdXNlciBleGlzdGVuY2UgZXJyb3JzXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcblxuICAgICAgLy8gU3VwcG9ydGVkIGlkZW50aXR5IHByb3ZpZGVyc1xuICAgICAgc3VwcG9ydGVkSWRlbnRpdHlQcm92aWRlcnM6IFtcbiAgICAgICAgY29nbml0by5Vc2VyUG9vbENsaWVudElkZW50aXR5UHJvdmlkZXIuQ09HTklUTyxcbiAgICAgIF0sXG5cbiAgICAgIC8vIE9BdXRoIHNldHRpbmdzIGRpc2FibGVkIGZvciBjdXN0b20gYXV0aCBmbG93XG4gICAgICAvLyBvQXV0aDoge1xuICAgICAgLy8gICBmbG93czoge1xuICAgICAgLy8gICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IGZhbHNlLFxuICAgICAgLy8gICAgIGltcGxpY2l0Q29kZUdyYW50OiBmYWxzZSxcbiAgICAgIC8vICAgfSxcbiAgICAgIC8vIH0sXG5cbiAgICAgIC8vIFNlY3VyaXR5XG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIEZvciB3ZWIgYXBwbGljYXRpb25zXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDb2duaXRvIHBlcm1pc3Npb24gdG8gaW52b2tlIExhbWJkYSBmdW5jdGlvbnNcbiAgICBsYW1iZGFGdW5jdGlvbnMuY3JlYXRlQXV0aENoYWxsZW5nZS5hZGRQZXJtaXNzaW9uKCdDb2duaXRvSW52b2tlQ3JlYXRlQ2hhbGxlbmdlJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2NvZ25pdG8taWRwLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybixcbiAgICB9KTtcblxuICAgIGxhbWJkYUZ1bmN0aW9ucy52ZXJpZnlBdXRoQ2hhbGxlbmdlLmFkZFBlcm1pc3Npb24oJ0NvZ25pdG9JbnZva2VWZXJpZnlDaGFsbGVuZ2UnLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY29nbml0by1pZHAuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuLFxuICAgIH0pO1xuXG4gICAgbGFtYmRhRnVuY3Rpb25zLmRlZmluZUF1dGhDaGFsbGVuZ2UuYWRkUGVybWlzc2lvbignQ29nbml0b0ludm9rZURlZmluZUNoYWxsZW5nZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpZ3VyZVBhc3N3b3JkbGVzc0F1dGgoKSB7XG4gICAgLy8gVXNlIEwxIGNvbnN0cnVjdCB0byBlbmFibGUgcGFzc3dvcmRsZXNzIGF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY2ZuVXNlclBvb2xDbGllbnQgPSB0aGlzLnVzZXJQb29sQ2xpZW50Lm5vZGUuZGVmYXVsdENoaWxkIGFzIGNvZ25pdG8uQ2ZuVXNlclBvb2xDbGllbnQ7XG4gICAgXG4gICAgLy8gQWRkIEFMTE9XX1VTRVJfQVVUSCBmbG93IHRvIHRoZSBhcHAgY2xpZW50XG4gICAgLy8gVGhpcyBpcyByZXF1aXJlZCBmb3IgcGFzc3dvcmRsZXNzIGF1dGhlbnRpY2F0aW9uXG4gICAgY2ZuVXNlclBvb2xDbGllbnQuYWRkUHJvcGVydHlPdmVycmlkZSgnRXhwbGljaXRBdXRoRmxvd3MnLCBbXG4gICAgICAnQUxMT1dfQ1VTVE9NX0FVVEgnLFxuICAgICAgJ0FMTE9XX1VTRVJfQVVUSCcsIC8vIFJlcXVpcmVkIGZvciBwYXNzd29yZGxlc3NcbiAgICAgICdBTExPV19SRUZSRVNIX1RPS0VOX0FVVEgnXG4gICAgXSk7XG5cbiAgICAvLyBOb3RlOiBFbWFpbCBPVFAgYXV0aGVudGljYXRpb24gbWV0aG9kIG5lZWRzIHRvIGJlIGVuYWJsZWQgbWFudWFsbHkgaW4gdGhlIEFXUyBDb25zb2xlXG4gICAgLy8gb3IgdGhyb3VnaCBBV1MgQ0xJIGFzIGl0J3Mgbm90IHlldCBzdXBwb3J0ZWQgaW4gQ2xvdWRGb3JtYXRpb24vQ0RLXG4gICAgY29uc29sZS5sb2coJ+KaoO+4jyAgTUFOVUFMIFNURVAgUkVRVUlSRUQ6Jyk7XG4gICAgY29uc29sZS5sb2coJyAgIFBsZWFzZSBlbmFibGUgXCJFbWFpbCBPVFBcIiBhdXRoZW50aWNhdGlvbiBtZXRob2QgaW4gdGhlIENvZ25pdG8gVXNlciBQb29sIGNvbnNvbGUnKTtcbiAgICBjb25zb2xlLmxvZygnICAgR28gdG86IEFXUyBDb25zb2xlID4gQ29nbml0byA+IFVzZXIgUG9vbHMgPiBhcHByZWNpYXRhLXVzZXJzLWRldiA+IFNpZ24taW4gZXhwZXJpZW5jZScpO1xuICAgIGNvbnNvbGUubG9nKCcgICBFbmFibGU6IFwiRW1haWwgT1RQXCIgdW5kZXIgQXV0aGVudGljYXRpb24gbWV0aG9kcycpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCkge1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYEFwcmVjaWF0YVVzZXJQb29sSWQtJHt0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2J31gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYEFwcmVjaWF0YVVzZXJQb29sQ2xpZW50SWQtJHt0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2J31gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlcnNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlcnMgRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgQXByZWNpYXRhVXNlcnNUYWJsZS0ke3RoaXMubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICdkZXYnfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2Vzc2lvblRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlc3Npb25UYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgU2Vzc2lvbnMgRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgQXByZWNpYXRhU2Vzc2lvblRhYmxlLSR7dGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgJ2Rldid9YCxcbiAgICB9KTtcbiAgfVxufSJdfQ==