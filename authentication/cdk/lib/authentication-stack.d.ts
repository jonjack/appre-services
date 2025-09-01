import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
interface AuthenticationStackProps extends cdk.StackProps {
    environment: string;
}
export declare class AuthenticationStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly otpTable: dynamodb.Table;
    readonly rateLimitTable: dynamodb.Table;
    readonly usersTable: dynamodb.Table;
    readonly sessionTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: AuthenticationStackProps);
    private createDynamoDBTables;
    private createLambdaFunctions;
    private createCognitoUserPool;
    private configurePasswordlessAuth;
    private createOutputs;
}
export {};
