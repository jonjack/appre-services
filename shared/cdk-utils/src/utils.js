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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBbUU7QUFDbkUscUNBQXlDO0FBQ3pDLHVDQUFzRDtBQUV0RDs7O0dBR0c7QUFDSCxNQUFhLGtCQUFrQjtJQUs3QixZQUFZLEdBQVEsRUFBRSxNQUFxQixFQUFFLFdBQW9CO1FBQy9ELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBQSw2QkFBb0IsRUFBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLHNCQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxvQkFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWSxDQUFDLGFBQXFCO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUFDLGlCQUF5QyxFQUFFO1FBQ3ZELE9BQU87WUFDTCxHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTztnQkFDNUIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTTthQUMzQjtZQUNELElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUM7U0FDNUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxvQkFBb0IsQ0FBQyxnQkFBd0MsRUFBRTtRQUM3RCxPQUFPO1lBQ0wsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVztZQUNwQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNO1lBQzlCLEdBQUcsYUFBYTtTQUNqQixDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILGtCQUFrQjtRQUNoQixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTztZQUM1QixXQUFXLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXO1NBQ3JDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFyREQsZ0RBcURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcsIGdldEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi9jb25maWcnO1xuaW1wb3J0IHsgUmVzb3VyY2VOYW1lcyB9IGZyb20gJy4vbmFtaW5nJztcbmltcG9ydCB7IFRhZ0J1aWxkZXIsIFNlcnZpY2VEb21haW4gfSBmcm9tICcuL3RhZ2dpbmcnO1xuXG4vKipcbiAqIENvbXByZWhlbnNpdmUgdXRpbGl0eSBjbGFzcyB0aGF0IGNvbWJpbmVzIGNvbmZpZ3VyYXRpb24sIG5hbWluZywgYW5kIHRhZ2dpbmdcbiAqIFRoaXMgaXMgdGhlIG1haW4gY2xhc3MgdGhhdCBDREsgc3RhY2tzIHNob3VsZCB1c2VcbiAqL1xuZXhwb3J0IGNsYXNzIEFwcFJlc291cmNlQnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICBwdWJsaWMgcmVhZG9ubHkgbmFtZXM6IFJlc291cmNlTmFtZXM7XG4gIHB1YmxpYyByZWFkb25seSB0YWdzOiBUYWdCdWlsZGVyO1xuICBcbiAgY29uc3RydWN0b3IoYXBwOiBhbnksIGRvbWFpbjogU2VydmljZURvbWFpbiwgc2VydmljZVBhdGg/OiBzdHJpbmcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGdldEVudmlyb25tZW50Q29uZmlnKGFwcCwgc2VydmljZVBhdGgpO1xuICAgIHRoaXMubmFtZXMgPSBuZXcgUmVzb3VyY2VOYW1lcyh0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy50YWdzID0gbmV3IFRhZ0J1aWxkZXIodGhpcy5jb25maWcsIGRvbWFpbik7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXQgc3RhY2sgbmFtZSBmb2xsb3dpbmcgdGhlIG5hbWluZyBjb252ZW50aW9uXG4gICAqL1xuICBnZXRTdGFja05hbWUoc3RhY2tCYXNlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lcy5zdGFjayhzdGFja0Jhc2VOYW1lKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCBzdGFjayBwcm9wcyB3aXRoIGVudmlyb25tZW50IGFuZCBiYXNlIHRhZ3NcbiAgICovXG4gIGdldFN0YWNrUHJvcHMoYWRkaXRpb25hbFRhZ3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSkge1xuICAgIHJldHVybiB7XG4gICAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogdGhpcy5jb25maWcuYWNjb3VudCxcbiAgICAgICAgcmVnaW9uOiB0aGlzLmNvbmZpZy5yZWdpb24sXG4gICAgICB9LFxuICAgICAgdGFnczogdGhpcy50YWdzLmdldEJhc2VUYWdzKGFkZGl0aW9uYWxUYWdzKSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICogR2V0IGVudmlyb25tZW50LXNwZWNpZmljIGNvbmZpZ3VyYXRpb24gZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICogVGhpcyBwcm92aWRlcyB0aGUgRU5WSVJPTk1FTlQgdmFyaWFibGUgdGhhdCBMYW1iZGEgZnVuY3Rpb25zIG5lZWQgYXQgcnVudGltZVxuICAgKi9cbiAgZ2V0TGFtYmRhRW52aXJvbm1lbnQoYWRkaXRpb25hbEVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9KTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIEVOVklST05NRU5UOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgIEFXU19SRUdJT046IHRoaXMuY29uZmlnLnJlZ2lvbixcbiAgICAgIC4uLmFkZGl0aW9uYWxFbnYsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldCBidWlsZC10aW1lIGNvbmZpZ3VyYXRpb24gdGhhdCBjYW4gYmUgZW1iZWRkZWQgaW4gTGFtYmRhIGZ1bmN0aW9uc1xuICAgKiBUaGlzIHByb3ZpZGVzIEFQUF9OQU1FIGF0IGJ1aWxkIHRpbWUgZm9yIHJlc291cmNlIG5hbWUgY29uc3RydWN0aW9uXG4gICAqL1xuICBnZXRCdWlsZFRpbWVDb25maWcoKTogeyBhcHBOYW1lOiBzdHJpbmc7IGVudmlyb25tZW50OiBzdHJpbmcgfSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFwcE5hbWU6IHRoaXMuY29uZmlnLmFwcE5hbWUsXG4gICAgICBlbnZpcm9ubWVudDogdGhpcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgfTtcbiAgfVxufSJdfQ==