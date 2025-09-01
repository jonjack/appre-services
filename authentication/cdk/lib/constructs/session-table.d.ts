import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface SessionTableProps {
    environment: string;
    tableName?: string;
}
export declare class SessionTable extends Construct {
    readonly table: dynamodb.Table;
    constructor(scope: Construct, id: string, props: SessionTableProps);
    /**
     * Grant read and write permissions to a principal
     */
    grantReadWriteData(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant;
    /**
     * Grant read-only permissions to a principal
     */
    grantReadData(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant;
    /**
     * Grant write-only permissions to a principal
     */
    grantWriteData(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant;
}
