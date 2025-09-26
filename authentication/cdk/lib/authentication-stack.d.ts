import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../../shared/cdk-utils/src';
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
export declare class AuthenticationStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly otpTable: dynamodb.Table;
    readonly rateLimitTable: dynamodb.Table;
    readonly usersTable: dynamodb.Table;
    readonly sessionTable: dynamodb.Table;
    private readonly resourceNames;
    private readonly tagBuilder;
    private readonly userPoolName;
    constructor(scope: Construct, id: string, props: AuthenticationStackProps);
    private createDynamoDBTables;
    private createLambdaFunctions;
    private createCognitoUserPool;
    private configurePasswordlessAuth;
    private createOutputs;
}
export {};
