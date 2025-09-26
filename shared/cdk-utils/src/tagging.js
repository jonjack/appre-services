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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnZ2luZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRhZ2dpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBYUE7O0dBRUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FDOUIsTUFBeUIsRUFDekIsTUFBYyxFQUNkLGlCQUF5QyxFQUFFO0lBRTNDLE9BQU87UUFDTCxXQUFXLEVBQUUsTUFBTSxDQUFDLE9BQU87UUFDM0IsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXO1FBQy9CLE1BQU0sRUFBRSxNQUFNO1FBQ2QsU0FBUyxFQUFFLEtBQUs7UUFDaEIsR0FBRyxjQUFjO0tBQ2xCLENBQUM7QUFDSixDQUFDO0FBWkQsNENBWUM7QUFFRDs7R0FFRztBQUNVLFFBQUEsZUFBZSxHQUFHO0lBQzdCLGNBQWMsRUFBRSxNQUFNO0lBQ3RCLGFBQWEsRUFBRSxlQUFlO0lBQzlCLGVBQWUsRUFBRSxpQkFBaUI7SUFDbEMsUUFBUSxFQUFFLFVBQVU7SUFDcEIsTUFBTSxFQUFFLFFBQVE7Q0FDUixDQUFDO0FBSVg7O0dBRUc7QUFDSCxNQUFhLFVBQVU7SUFDckIsWUFBNEIsTUFBeUIsRUFBVSxNQUFxQjtRQUF4RCxXQUFNLEdBQU4sTUFBTSxDQUFtQjtRQUFVLFdBQU0sR0FBTixNQUFNLENBQWU7SUFBRyxDQUFDO0lBRXhGOztPQUVHO0lBQ0gsV0FBVyxDQUFDLGlCQUF5QyxFQUFFO1FBQ3JELE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRDs7T0FFRztJQUNILGdCQUFnQixDQUFDLFNBQWlCLEVBQUUsaUJBQXlDLEVBQUU7UUFDN0UsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDaEQsU0FBUyxFQUFFLFNBQVM7WUFDcEIsR0FBRyxjQUFjO1NBQ2xCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWEsQ0FBQyxZQUFvQixFQUFFLGlCQUF5QyxFQUFFO1FBQzdFLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRTtZQUNyQyxRQUFRLEVBQUUsWUFBWTtZQUN0QixHQUFHLGNBQWM7U0FDbEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUFDLFNBQWlCLEVBQUUsaUJBQXlDLEVBQUU7UUFDMUUsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxTQUFTO1lBQ2hCLEdBQUcsY0FBYztTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsU0FBaUIsRUFBRSxpQkFBeUMsRUFBRTtRQUN2RSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7WUFDbEMsS0FBSyxFQUFFLFNBQVM7WUFDaEIsR0FBRyxjQUFjO1NBQ2xCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxZQUFvQixFQUFFLGlCQUF5QyxFQUFFO1FBQzFFLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRTtZQUNsQyxRQUFRLEVBQUUsWUFBWTtZQUN0QixHQUFHLGNBQWM7U0FDbEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLFFBQWdCLEVBQUUsaUJBQXlDLEVBQUU7UUFDdEUsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFO1lBQ2xDLElBQUksRUFBRSxRQUFRO1lBQ2QsR0FBRyxjQUFjO1NBQ2xCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXJFRCxnQ0FxRUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4vY29uZmlnJztcblxuLyoqXG4gKiBHbG9iYWwgdGFncyBpbnRlcmZhY2VcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBHbG9iYWxUYWdzIHtcbiAgQXBwbGljYXRpb246IHN0cmluZztcbiAgRW52aXJvbm1lbnQ6IHN0cmluZztcbiAgRG9tYWluOiBzdHJpbmc7XG4gIE1hbmFnZWRCeTogJ2Nkayc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZztcbn1cblxuLyoqXG4gKiBDcmVhdGUgZ2xvYmFsIHRhZ3MgZm9yIEFXUyByZXNvdXJjZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFRhZ3MoXG4gIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWcsXG4gIGRvbWFpbjogc3RyaW5nLFxuICBhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XG4pOiBHbG9iYWxUYWdzIHtcbiAgcmV0dXJuIHtcbiAgICBBcHBsaWNhdGlvbjogY29uZmlnLmFwcE5hbWUsXG4gICAgRW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICBEb21haW46IGRvbWFpbixcbiAgICBNYW5hZ2VkQnk6ICdjZGsnLFxuICAgIC4uLmFkZGl0aW9uYWxUYWdzLFxuICB9O1xufVxuXG4vKipcbiAqIFNlcnZpY2UgZG9tYWluIGNvbnN0YW50c1xuICovXG5leHBvcnQgY29uc3QgU0VSVklDRV9ET01BSU5TID0ge1xuICBBVVRIRU5USUNBVElPTjogJ2F1dGgnLFxuICBOT1RJRklDQVRJT05TOiAnbm90aWZpY2F0aW9ucycsXG4gIFVTRVJfTUFOQUdFTUVOVDogJ3VzZXItbWFuYWdlbWVudCcsXG4gIFBBWU1FTlRTOiAncGF5bWVudHMnLFxuICBTSEFSRUQ6ICdzaGFyZWQnLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IHR5cGUgU2VydmljZURvbWFpbiA9IHR5cGVvZiBTRVJWSUNFX0RPTUFJTlNba2V5b2YgdHlwZW9mIFNFUlZJQ0VfRE9NQUlOU107XG5cbi8qKlxuICogVXRpbGl0eSBjbGFzcyBmb3IgY3JlYXRpbmcgY29uc2lzdGVudCB0YWdzIGFjcm9zcyBzZXJ2aWNlc1xuICovXG5leHBvcnQgY2xhc3MgVGFnQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBjb25maWc6IEVudmlyb25tZW50Q29uZmlnLCBwcml2YXRlIGRvbWFpbjogU2VydmljZURvbWFpbikge31cbiAgXG4gIC8qKlxuICAgKiBHZXQgYmFzZSB0YWdzIGZvciB0aGlzIHNlcnZpY2VcbiAgICovXG4gIGdldEJhc2VUYWdzKGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBHbG9iYWxUYWdzIHtcbiAgICByZXR1cm4gY3JlYXRlR2xvYmFsVGFncyh0aGlzLmNvbmZpZywgdGhpcy5kb21haW4sIGFkZGl0aW9uYWxUYWdzKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCB0YWdzIGZvciBhIHNwZWNpZmljIGNvbXBvbmVudCB3aXRoaW4gdGhlIHNlcnZpY2VcbiAgICovXG4gIGdldENvbXBvbmVudFRhZ3MoY29tcG9uZW50OiBzdHJpbmcsIGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBHbG9iYWxUYWdzIHtcbiAgICByZXR1cm4gY3JlYXRlR2xvYmFsVGFncyh0aGlzLmNvbmZpZywgdGhpcy5kb21haW4sIHtcbiAgICAgIENvbXBvbmVudDogY29tcG9uZW50LFxuICAgICAgLi4uYWRkaXRpb25hbFRhZ3MsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgdGFncyBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xuICAgKi9cbiAgZ2V0TGFtYmRhVGFncyhmdW5jdGlvbk5hbWU6IHN0cmluZywgYWRkaXRpb25hbFRhZ3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSk6IEdsb2JhbFRhZ3Mge1xuICAgIHJldHVybiB0aGlzLmdldENvbXBvbmVudFRhZ3MoJ2xhbWJkYScsIHtcbiAgICAgIEZ1bmN0aW9uOiBmdW5jdGlvbk5hbWUsXG4gICAgICAuLi5hZGRpdGlvbmFsVGFncyxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCB0YWdzIGZvciBEeW5hbW9EQiB0YWJsZXNcbiAgICovXG4gIGdldER5bmFtb1RhZ3ModGFibGVOYW1lOiBzdHJpbmcsIGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBHbG9iYWxUYWdzIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb21wb25lbnRUYWdzKCdkeW5hbW9kYicsIHtcbiAgICAgIFRhYmxlOiB0YWJsZU5hbWUsXG4gICAgICAuLi5hZGRpdGlvbmFsVGFncyxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCB0YWdzIGZvciBTUVMgcXVldWVzXG4gICAqL1xuICBnZXRTcXNUYWdzKHF1ZXVlTmFtZTogc3RyaW5nLCBhZGRpdGlvbmFsVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogR2xvYmFsVGFncyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29tcG9uZW50VGFncygnc3FzJywge1xuICAgICAgUXVldWU6IHF1ZXVlTmFtZSxcbiAgICAgIC4uLmFkZGl0aW9uYWxUYWdzLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICogR2V0IHRhZ3MgZm9yIFNFUyB0ZW1wbGF0ZXNcbiAgICovXG4gIGdldFNlc1RhZ3ModGVtcGxhdGVOYW1lOiBzdHJpbmcsIGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBHbG9iYWxUYWdzIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb21wb25lbnRUYWdzKCdzZXMnLCB7XG4gICAgICBUZW1wbGF0ZTogdGVtcGxhdGVOYW1lLFxuICAgICAgLi4uYWRkaXRpb25hbFRhZ3MsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgdGFncyBmb3IgSUFNIHJvbGVzXG4gICAqL1xuICBnZXRJYW1UYWdzKHJvbGVOYW1lOiBzdHJpbmcsIGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBHbG9iYWxUYWdzIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb21wb25lbnRUYWdzKCdpYW0nLCB7XG4gICAgICBSb2xlOiByb2xlTmFtZSxcbiAgICAgIC4uLmFkZGl0aW9uYWxUYWdzLFxuICAgIH0pO1xuICB9XG59Il19