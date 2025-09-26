import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
interface NotificationStackProps extends cdk.StackProps {
    environment: string;
}
export declare class NotificationStack extends cdk.Stack {
    otpTemplate: ses.CfnTemplate;
    welcomeTemplate: ses.CfnTemplate;
    completeRegistrationUserInfoTemplate: ses.CfnTemplate;
    completeRegistrationStripeTemplate: ses.CfnTemplate;
    newsletterTemplate: ses.CfnTemplate;
    emailQueue: sqs.Queue;
    emailProcessor: lambda.Function;
    private config;
    private resourceNames;
    private tagBuilder;
    constructor(scope: Construct, id: string, props: NotificationStackProps);
    private createSESTemplates;
    private createEmailQueue;
    private createOutputs;
}
export {};
