"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionTable = void 0;
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const constructs_1 = require("constructs");
class SessionTable extends constructs_1.Construct {
    constructor(scope, id, props) {
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
    grantReadWriteData(grantee) {
        return this.table.grantReadWriteData(grantee);
    }
    /**
     * Grant read-only permissions to a principal
     */
    grantReadData(grantee) {
        return this.table.grantReadData(grantee);
    }
    /**
     * Grant write-only permissions to a principal
     */
    grantWriteData(grantee) {
        return this.table.grantWriteData(grantee);
    }
}
exports.SessionTable = SessionTable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Vzc2lvbi10YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlc3Npb24tdGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLHFEQUFxRDtBQUNyRCwyQ0FBdUM7QUFPdkMsTUFBYSxZQUFhLFNBQVEsc0JBQVM7SUFHekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLElBQUksaUJBQWlCLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUUxRSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQzdDLFNBQVM7WUFDVCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELG1CQUFtQixFQUFFLFlBQVk7WUFDakMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxtQkFBbUIsRUFBRSxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU07WUFDakQsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTTtnQkFDekMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtnQkFDMUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUM5QixDQUFDLENBQUM7UUFFSCxxREFBcUQ7UUFDckQsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUNqQyxTQUFTLEVBQUUscUJBQXFCO1lBQ2hDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsU0FBUztnQkFDZixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRztTQUM1QyxDQUFDLENBQUM7UUFFSCxnRUFBZ0U7UUFDaEUsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUNqQyxTQUFTLEVBQUUsa0JBQWtCO1lBQzdCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsU0FBUztnQkFDZixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUztTQUNsRCxDQUFDLENBQUM7UUFFSCx3Q0FBd0M7UUFDeEMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUN6RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQzlELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQ7O09BRUc7SUFDSSxrQkFBa0IsQ0FBQyxPQUErQjtRQUN2RCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksYUFBYSxDQUFDLE9BQStCO1FBQ2xELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVEOztPQUVHO0lBQ0ksY0FBYyxDQUFDLE9BQStCO1FBQ25ELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBN0VELG9DQTZFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2Vzc2lvblRhYmxlUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICB0YWJsZU5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTZXNzaW9uVGFibGUgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgdGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTZXNzaW9uVGFibGVQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB0YWJsZU5hbWUgPSBwcm9wcy50YWJsZU5hbWUgfHwgYHVzZXItc2Vzc2lvbnMtJHtwcm9wcy5lbnZpcm9ubWVudH1gO1xuXG4gICAgdGhpcy50YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWUsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgXG4gICAgICAgIG5hbWU6ICdzZXNzaW9uX2lkJywgXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAnZXhwaXJlc19hdCcsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgdXNlciBsb29rdXAgLSBmaW5kIGFsbCBzZXNzaW9ucyBmb3IgYSB1c2VyXG4gICAgdGhpcy50YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICd1c2VyLXNlc3Npb25zLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBcbiAgICAgICAgbmFtZTogJ3VzZXJfaWQnLCBcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgXG4gICAgICB9LFxuICAgICAgc29ydEtleTogeyBcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRfYXQnLCBcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgZXhwaXJ5IG1vbml0b3JpbmcgLSB1c2VmdWwgZm9yIGNsZWFudXAgYW5kIG1vbml0b3JpbmdcbiAgICB0aGlzLnRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2V4cGlyZXMtYXQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IFxuICAgICAgICBuYW1lOiAndXNlcl9pZCcsIFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyBcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7IFxuICAgICAgICBuYW1lOiAnZXhwaXJlc19hdCcsIFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiBcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuS0VZU19PTkxZLFxuICAgIH0pO1xuXG4gICAgLy8gVGFncyBmb3IgY29zdCB0cmFja2luZyBhbmQgbWFuYWdlbWVudFxuICAgIGNkay5UYWdzLm9mKHRoaXMudGFibGUpLmFkZCgnU2VydmljZScsICdBdXRoZW50aWNhdGlvbicpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMudGFibGUpLmFkZCgnQ29tcG9uZW50JywgJ1Nlc3Npb25NYW5hZ2VtZW50Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy50YWJsZSkuYWRkKCdFbnZpcm9ubWVudCcsIHByb3BzLmVudmlyb25tZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHcmFudCByZWFkIGFuZCB3cml0ZSBwZXJtaXNzaW9ucyB0byBhIHByaW5jaXBhbFxuICAgKi9cbiAgcHVibGljIGdyYW50UmVhZFdyaXRlRGF0YShncmFudGVlOiBjZGsuYXdzX2lhbS5JR3JhbnRhYmxlKTogY2RrLmF3c19pYW0uR3JhbnQge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShncmFudGVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHcmFudCByZWFkLW9ubHkgcGVybWlzc2lvbnMgdG8gYSBwcmluY2lwYWxcbiAgICovXG4gIHB1YmxpYyBncmFudFJlYWREYXRhKGdyYW50ZWU6IGNkay5hd3NfaWFtLklHcmFudGFibGUpOiBjZGsuYXdzX2lhbS5HcmFudCB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuZ3JhbnRSZWFkRGF0YShncmFudGVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHcmFudCB3cml0ZS1vbmx5IHBlcm1pc3Npb25zIHRvIGEgcHJpbmNpcGFsXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRXcml0ZURhdGEoZ3JhbnRlZTogY2RrLmF3c19pYW0uSUdyYW50YWJsZSk6IGNkay5hd3NfaWFtLkdyYW50IHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5ncmFudFdyaXRlRGF0YShncmFudGVlKTtcbiAgfVxufSJdfQ==