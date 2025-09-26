"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagBuilder = exports.SERVICE_DOMAINS = exports.createGlobalTags = void 0;
/**
 * Create global tags for AWS resources
 */
function createGlobalTags(config, domain, additionalTags = {}) {
    return {
        Application: config.appName,
        Environment: config.environment,
        Domain: domain,
        ManagedBy: 'cdk',
        ...additionalTags,
    };
}
exports.createGlobalTags = createGlobalTags;
/**
 * Service domain constants
 */
exports.SERVICE_DOMAINS = {
    AUTHENTICATION: 'auth',
    NOTIFICATIONS: 'notifications',
    USER_MANAGEMENT: 'user-management',
    PAYMENTS: 'payments',
    SHARED: 'shared',
};
/**
 * Utility class for creating consistent tags across services
 */
class TagBuilder {
    constructor(config, domain) {
        this.config = config;
        this.domain = domain;
    }
    /**
     * Get base tags for this service
     */
    getBaseTags(additionalTags = {}) {
        return createGlobalTags(this.config, this.domain, additionalTags);
    }
    /**
     * Get tags for a specific component within the service
     */
    getComponentTags(component, additionalTags = {}) {
        return createGlobalTags(this.config, this.domain, {
            Component: component,
            ...additionalTags,
        });
    }
    /**
     * Get tags for Lambda functions
     */
    getLambdaTags(functionName, additionalTags = {}) {
        return this.getComponentTags('lambda', {
            Function: functionName,
            ...additionalTags,
        });
    }
    /**
     * Get tags for DynamoDB tables
     */
    getDynamoTags(tableName, additionalTags = {}) {
        return this.getComponentTags('dynamodb', {
            Table: tableName,
            ...additionalTags,
        });
    }
    /**
     * Get tags for SQS queues
     */
    getSqsTags(queueName, additionalTags = {}) {
        return this.getComponentTags('sqs', {
            Queue: queueName,
            ...additionalTags,
        });
    }
    /**
     * Get tags for SES templates
     */
    getSesTags(templateName, additionalTags = {}) {
        return this.getComponentTags('ses', {
            Template: templateName,
            ...additionalTags,
        });
    }
    /**
     * Get tags for IAM roles
     */
    getIamTags(roleName, additionalTags = {}) {
        return this.getComponentTags('iam', {
            Role: roleName,
            ...additionalTags,
        });
    }
}
exports.TagBuilder = TagBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnZ2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWdnaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQWFBOztHQUVHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLE1BQXlCLEVBQ3pCLE1BQWMsRUFDZCxpQkFBeUMsRUFBRTtJQUUzQyxPQUFPO1FBQ0wsV0FBVyxFQUFFLE1BQU0sQ0FBQyxPQUFPO1FBQzNCLFdBQVcsRUFBRSxNQUFNLENBQUMsV0FBVztRQUMvQixNQUFNLEVBQUUsTUFBTTtRQUNkLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLEdBQUcsY0FBYztLQUNsQixDQUFDO0FBQ0osQ0FBQztBQVpELDRDQVlDO0FBRUQ7O0dBRUc7QUFDVSxRQUFBLGVBQWUsR0FBRztJQUM3QixjQUFjLEVBQUUsTUFBTTtJQUN0QixhQUFhLEVBQUUsZUFBZTtJQUM5QixlQUFlLEVBQUUsaUJBQWlCO0lBQ2xDLFFBQVEsRUFBRSxVQUFVO0lBQ3BCLE1BQU0sRUFBRSxRQUFRO0NBQ1IsQ0FBQztBQUlYOztHQUVHO0FBQ0gsTUFBYSxVQUFVO0lBQ3JCLFlBQTRCLE1BQXlCLEVBQVUsTUFBcUI7UUFBeEQsV0FBTSxHQUFOLE1BQU0sQ0FBbUI7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFlO0lBQUcsQ0FBQztJQUV4Rjs7T0FFRztJQUNILFdBQVcsQ0FBQyxpQkFBeUMsRUFBRTtRQUNyRCxPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxnQkFBZ0IsQ0FBQyxTQUFpQixFQUFFLGlCQUF5QyxFQUFFO1FBQzdFLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ2hELFNBQVMsRUFBRSxTQUFTO1lBQ3BCLEdBQUcsY0FBYztTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhLENBQUMsWUFBb0IsRUFBRSxpQkFBeUMsRUFBRTtRQUM3RSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUU7WUFDckMsUUFBUSxFQUFFLFlBQVk7WUFDdEIsR0FBRyxjQUFjO1NBQ2xCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWEsQ0FBQyxTQUFpQixFQUFFLGlCQUF5QyxFQUFFO1FBQzFFLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsU0FBUztZQUNoQixHQUFHLGNBQWM7U0FDbEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLFNBQWlCLEVBQUUsaUJBQXlDLEVBQUU7UUFDdkUsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFO1lBQ2xDLEtBQUssRUFBRSxTQUFTO1lBQ2hCLEdBQUcsY0FBYztTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsWUFBb0IsRUFBRSxpQkFBeUMsRUFBRTtRQUMxRSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7WUFDbEMsUUFBUSxFQUFFLFlBQVk7WUFDdEIsR0FBRyxjQUFjO1NBQ2xCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxRQUFnQixFQUFFLGlCQUF5QyxFQUFFO1FBQ3RFLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRTtZQUNsQyxJQUFJLEVBQUUsUUFBUTtZQUNkLEdBQUcsY0FBYztTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyRUQsZ0NBcUVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuL2NvbmZpZyc7XG5cbi8qKlxuICogR2xvYmFsIHRhZ3MgaW50ZXJmYWNlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgR2xvYmFsVGFncyB7XG4gIEFwcGxpY2F0aW9uOiBzdHJpbmc7XG4gIEVudmlyb25tZW50OiBzdHJpbmc7XG4gIERvbWFpbjogc3RyaW5nO1xuICBNYW5hZ2VkQnk6ICdjZGsnO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmc7XG59XG5cbi8qKlxuICogQ3JlYXRlIGdsb2JhbCB0YWdzIGZvciBBV1MgcmVzb3VyY2VzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVHbG9iYWxUYWdzKFxuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnLFxuICBkb21haW46IHN0cmluZyxcbiAgYWRkaXRpb25hbFRhZ3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuKTogR2xvYmFsVGFncyB7XG4gIHJldHVybiB7XG4gICAgQXBwbGljYXRpb246IGNvbmZpZy5hcHBOYW1lLFxuICAgIEVudmlyb25tZW50OiBjb25maWcuZW52aXJvbm1lbnQsXG4gICAgRG9tYWluOiBkb21haW4sXG4gICAgTWFuYWdlZEJ5OiAnY2RrJyxcbiAgICAuLi5hZGRpdGlvbmFsVGFncyxcbiAgfTtcbn1cblxuLyoqXG4gKiBTZXJ2aWNlIGRvbWFpbiBjb25zdGFudHNcbiAqL1xuZXhwb3J0IGNvbnN0IFNFUlZJQ0VfRE9NQUlOUyA9IHtcbiAgQVVUSEVOVElDQVRJT046ICdhdXRoJyxcbiAgTk9USUZJQ0FUSU9OUzogJ25vdGlmaWNhdGlvbnMnLFxuICBVU0VSX01BTkFHRU1FTlQ6ICd1c2VyLW1hbmFnZW1lbnQnLFxuICBQQVlNRU5UUzogJ3BheW1lbnRzJyxcbiAgU0hBUkVEOiAnc2hhcmVkJyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFNlcnZpY2VEb21haW4gPSB0eXBlb2YgU0VSVklDRV9ET01BSU5TW2tleW9mIHR5cGVvZiBTRVJWSUNFX0RPTUFJTlNdO1xuXG4vKipcbiAqIFV0aWxpdHkgY2xhc3MgZm9yIGNyZWF0aW5nIGNvbnNpc3RlbnQgdGFncyBhY3Jvc3Mgc2VydmljZXNcbiAqL1xuZXhwb3J0IGNsYXNzIFRhZ0J1aWxkZXIge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZywgcHJpdmF0ZSBkb21haW46IFNlcnZpY2VEb21haW4pIHt9XG4gIFxuICAvKipcbiAgICogR2V0IGJhc2UgdGFncyBmb3IgdGhpcyBzZXJ2aWNlXG4gICAqL1xuICBnZXRCYXNlVGFncyhhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogR2xvYmFsVGFncyB7XG4gICAgcmV0dXJuIGNyZWF0ZUdsb2JhbFRhZ3ModGhpcy5jb25maWcsIHRoaXMuZG9tYWluLCBhZGRpdGlvbmFsVGFncyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgdGFncyBmb3IgYSBzcGVjaWZpYyBjb21wb25lbnQgd2l0aGluIHRoZSBzZXJ2aWNlXG4gICAqL1xuICBnZXRDb21wb25lbnRUYWdzKGNvbXBvbmVudDogc3RyaW5nLCBhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogR2xvYmFsVGFncyB7XG4gICAgcmV0dXJuIGNyZWF0ZUdsb2JhbFRhZ3ModGhpcy5jb25maWcsIHRoaXMuZG9tYWluLCB7XG4gICAgICBDb21wb25lbnQ6IGNvbXBvbmVudCxcbiAgICAgIC4uLmFkZGl0aW9uYWxUYWdzLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICogR2V0IHRhZ3MgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICovXG4gIGdldExhbWJkYVRhZ3MoZnVuY3Rpb25OYW1lOiBzdHJpbmcsIGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBHbG9iYWxUYWdzIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb21wb25lbnRUYWdzKCdsYW1iZGEnLCB7XG4gICAgICBGdW5jdGlvbjogZnVuY3Rpb25OYW1lLFxuICAgICAgLi4uYWRkaXRpb25hbFRhZ3MsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgdGFncyBmb3IgRHluYW1vREIgdGFibGVzXG4gICAqL1xuICBnZXREeW5hbW9UYWdzKHRhYmxlTmFtZTogc3RyaW5nLCBhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogR2xvYmFsVGFncyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29tcG9uZW50VGFncygnZHluYW1vZGInLCB7XG4gICAgICBUYWJsZTogdGFibGVOYW1lLFxuICAgICAgLi4uYWRkaXRpb25hbFRhZ3MsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgdGFncyBmb3IgU1FTIHF1ZXVlc1xuICAgKi9cbiAgZ2V0U3FzVGFncyhxdWV1ZU5hbWU6IHN0cmluZywgYWRkaXRpb25hbFRhZ3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSk6IEdsb2JhbFRhZ3Mge1xuICAgIHJldHVybiB0aGlzLmdldENvbXBvbmVudFRhZ3MoJ3NxcycsIHtcbiAgICAgIFF1ZXVlOiBxdWV1ZU5hbWUsXG4gICAgICAuLi5hZGRpdGlvbmFsVGFncyxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCB0YWdzIGZvciBTRVMgdGVtcGxhdGVzXG4gICAqL1xuICBnZXRTZXNUYWdzKHRlbXBsYXRlTmFtZTogc3RyaW5nLCBhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogR2xvYmFsVGFncyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29tcG9uZW50VGFncygnc2VzJywge1xuICAgICAgVGVtcGxhdGU6IHRlbXBsYXRlTmFtZSxcbiAgICAgIC4uLmFkZGl0aW9uYWxUYWdzLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICogR2V0IHRhZ3MgZm9yIElBTSByb2xlc1xuICAgKi9cbiAgZ2V0SWFtVGFncyhyb2xlTmFtZTogc3RyaW5nLCBhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogR2xvYmFsVGFncyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29tcG9uZW50VGFncygnaWFtJywge1xuICAgICAgUm9sZTogcm9sZU5hbWUsXG4gICAgICAuLi5hZGRpdGlvbmFsVGFncyxcbiAgICB9KTtcbiAgfVxufSJdfQ==