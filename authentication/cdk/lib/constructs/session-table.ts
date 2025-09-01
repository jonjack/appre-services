import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface SessionTableProps {
  environment: string;
  tableName?: string;
}

export class SessionTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: SessionTableProps) {
    super(scope, id);

    const tableName = props.tableName || `user-sessions-${props.environment}`;

    this.table = new dynamodb.Table(this, 'Table', {
      tableName,
      partitionKey: { 
        name: 'session_id', 
        type: dynamodb.AttributeType.STRING 
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: props.environment === 'prod',
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for user lookup - find all sessions for a user
    this.table.addGlobalSecondaryIndex({
      indexName: 'user-sessions-index',
      partitionKey: { 
        name: 'user_id', 
        type: dynamodb.AttributeType.STRING 
      },
      sortKey: { 
        name: 'created_at', 
        type: dynamodb.AttributeType.NUMBER 
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for expiry monitoring - useful for cleanup and monitoring
    this.table.addGlobalSecondaryIndex({
      indexName: 'expires-at-index',
      partitionKey: { 
        name: 'user_id', 
        type: dynamodb.AttributeType.STRING 
      },
      sortKey: { 
        name: 'expires_at', 
        type: dynamodb.AttributeType.NUMBER 
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Tags for cost tracking and management
    cdk.Tags.of(this.table).add('Service', 'Authentication');
    cdk.Tags.of(this.table).add('Component', 'SessionManagement');
    cdk.Tags.of(this.table).add('Environment', props.environment);
  }

  /**
   * Grant read and write permissions to a principal
   */
  public grantReadWriteData(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant {
    return this.table.grantReadWriteData(grantee);
  }

  /**
   * Grant read-only permissions to a principal
   */
  public grantReadData(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant {
    return this.table.grantReadData(grantee);
  }

  /**
   * Grant write-only permissions to a principal
   */
  public grantWriteData(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant {
    return this.table.grantWriteData(grantee);
  }
}