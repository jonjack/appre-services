"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppResourceBuilder = void 0;
const config_1 = require("./config");
const naming_1 = require("./naming");
const tagging_1 = require("./tagging");
/**
 * Comprehensive utility class that combines configuration, naming, and tagging
 * This is the main class that CDK stacks should use
 */
class AppResourceBuilder {
    constructor(app, domain, servicePath) {
        this.config = (0, config_1.getEnvironmentConfig)(app, servicePath);
        this.names = new naming_1.ResourceNames(this.config);
        this.tags = new tagging_1.TagBuilder(this.config, domain);
    }
    /**
     * Get stack name following the naming convention
     */
    getStackName(stackBaseName) {
        return this.names.stack(stackBaseName);
    }
    /**
     * Get stack props with environment and base tags
     */
    getStackProps(additionalTags = {}) {
        return {
            env: {
                account: this.config.account,
                region: this.config.region,
            },
            tags: this.tags.getBaseTags(additionalTags),
        };
    }
    /**
     * Get environment-specific configuration for Lambda functions
     * This provides the ENVIRONMENT variable that Lambda functions need at runtime
     */
    getLambdaEnvironment(additionalEnv = {}) {
        return {
            ENVIRONMENT: this.config.environment,
            AWS_REGION: this.config.region,
            ...additionalEnv,
        };
    }
    /**
     * Get build-time configuration that can be embedded in Lambda functions
     * This provides APP_NAME at build time for resource name construction
     */
    getBuildTimeConfig() {
        return {
            appName: this.config.appName,
            environment: this.config.environment,
        };
    }
}
exports.AppResourceBuilder = AppResourceBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQW1FO0FBQ25FLHFDQUF5QztBQUN6Qyx1Q0FBc0Q7QUFFdEQ7OztHQUdHO0FBQ0gsTUFBYSxrQkFBa0I7SUFLN0IsWUFBWSxHQUFRLEVBQUUsTUFBcUIsRUFBRSxXQUFvQjtRQUMvRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUEsNkJBQW9CLEVBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxzQkFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksb0JBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRDs7T0FFRztJQUNILFlBQVksQ0FBQyxhQUFxQjtRQUNoQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWEsQ0FBQyxpQkFBeUMsRUFBRTtRQUN2RCxPQUFPO1lBQ0wsR0FBRyxFQUFFO2dCQUNILE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU87Z0JBQzVCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU07YUFDM0I7WUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDO1NBQzVDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsb0JBQW9CLENBQUMsZ0JBQXdDLEVBQUU7UUFDN0QsT0FBTztZQUNMLFdBQVcsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVc7WUFDcEMsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTTtZQUM5QixHQUFHLGFBQWE7U0FDakIsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxrQkFBa0I7UUFDaEIsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU87WUFDNUIsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVztTQUNyQyxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBckRELGdEQXFEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnLCBnZXRFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4vY29uZmlnJztcbmltcG9ydCB7IFJlc291cmNlTmFtZXMgfSBmcm9tICcuL25hbWluZyc7XG5pbXBvcnQgeyBUYWdCdWlsZGVyLCBTZXJ2aWNlRG9tYWluIH0gZnJvbSAnLi90YWdnaW5nJztcblxuLyoqXG4gKiBDb21wcmVoZW5zaXZlIHV0aWxpdHkgY2xhc3MgdGhhdCBjb21iaW5lcyBjb25maWd1cmF0aW9uLCBuYW1pbmcsIGFuZCB0YWdnaW5nXG4gKiBUaGlzIGlzIHRoZSBtYWluIGNsYXNzIHRoYXQgQ0RLIHN0YWNrcyBzaG91bGQgdXNlXG4gKi9cbmV4cG9ydCBjbGFzcyBBcHBSZXNvdXJjZUJ1aWxkZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgcHVibGljIHJlYWRvbmx5IG5hbWVzOiBSZXNvdXJjZU5hbWVzO1xuICBwdWJsaWMgcmVhZG9ubHkgdGFnczogVGFnQnVpbGRlcjtcbiAgXG4gIGNvbnN0cnVjdG9yKGFwcDogYW55LCBkb21haW46IFNlcnZpY2VEb21haW4sIHNlcnZpY2VQYXRoPzogc3RyaW5nKSB7XG4gICAgdGhpcy5jb25maWcgPSBnZXRFbnZpcm9ubWVudENvbmZpZyhhcHAsIHNlcnZpY2VQYXRoKTtcbiAgICB0aGlzLm5hbWVzID0gbmV3IFJlc291cmNlTmFtZXModGhpcy5jb25maWcpO1xuICAgIHRoaXMudGFncyA9IG5ldyBUYWdCdWlsZGVyKHRoaXMuY29uZmlnLCBkb21haW4pO1xuICB9XG4gIFxuICAvKipcbiAgICogR2V0IHN0YWNrIG5hbWUgZm9sbG93aW5nIHRoZSBuYW1pbmcgY29udmVudGlvblxuICAgKi9cbiAgZ2V0U3RhY2tOYW1lKHN0YWNrQmFzZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMubmFtZXMuc3RhY2soc3RhY2tCYXNlTmFtZSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgc3RhY2sgcHJvcHMgd2l0aCBlbnZpcm9ubWVudCBhbmQgYmFzZSB0YWdzXG4gICAqL1xuICBnZXRTdGFja1Byb3BzKGFkZGl0aW9uYWxUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pIHtcbiAgICByZXR1cm4ge1xuICAgICAgZW52OiB7XG4gICAgICAgIGFjY291bnQ6IHRoaXMuY29uZmlnLmFjY291bnQsXG4gICAgICAgIHJlZ2lvbjogdGhpcy5jb25maWcucmVnaW9uLFxuICAgICAgfSxcbiAgICAgIHRhZ3M6IHRoaXMudGFncy5nZXRCYXNlVGFncyhhZGRpdGlvbmFsVGFncyksXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCBlbnZpcm9ubWVudC1zcGVjaWZpYyBjb25maWd1cmF0aW9uIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAqIFRoaXMgcHJvdmlkZXMgdGhlIEVOVklST05NRU5UIHZhcmlhYmxlIHRoYXQgTGFtYmRhIGZ1bmN0aW9ucyBuZWVkIGF0IHJ1bnRpbWVcbiAgICovXG4gIGdldExhbWJkYUVudmlyb25tZW50KGFkZGl0aW9uYWxFbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICAgIHJldHVybiB7XG4gICAgICBFTlZJUk9OTUVOVDogdGhpcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICBBV1NfUkVHSU9OOiB0aGlzLmNvbmZpZy5yZWdpb24sXG4gICAgICAuLi5hZGRpdGlvbmFsRW52LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgYnVpbGQtdGltZSBjb25maWd1cmF0aW9uIHRoYXQgY2FuIGJlIGVtYmVkZGVkIGluIExhbWJkYSBmdW5jdGlvbnNcbiAgICogVGhpcyBwcm92aWRlcyBBUFBfTkFNRSBhdCBidWlsZCB0aW1lIGZvciByZXNvdXJjZSBuYW1lIGNvbnN0cnVjdGlvblxuICAgKi9cbiAgZ2V0QnVpbGRUaW1lQ29uZmlnKCk6IHsgYXBwTmFtZTogc3RyaW5nOyBlbnZpcm9ubWVudDogc3RyaW5nIH0ge1xuICAgIHJldHVybiB7XG4gICAgICBhcHBOYW1lOiB0aGlzLmNvbmZpZy5hcHBOYW1lLFxuICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuY29uZmlnLmVudmlyb25tZW50LFxuICAgIH07XG4gIH1cbn0iXX0=