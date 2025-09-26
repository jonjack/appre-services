"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentConfig = exports.loadEnvironmentConfig = exports.VALID_ENVIRONMENTS = void 0;
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
/**
 * Valid environment values
 */
exports.VALID_ENVIRONMENTS = ['dev', 'test', 'prod'];
/**
 * Load environment configuration from .env files
 * Looks for .env files in the following order:
 * 1. Service-specific .env file (e.g., appre-services/authentication/.env)
 * 2. Root services .env file (appre-services/.env)
 * 3. Environment variables
 */
function loadEnvironmentConfig(servicePath, skipDotEnv = false) {
    // Load environment variables from .env files (unless skipped for testing)
    if (!skipDotEnv) {
        const envPaths = [];
        // Add service-specific .env if servicePath is provided
        if (servicePath) {
            const serviceEnvPath = path.join(servicePath, '.env');
            if (fs.existsSync(serviceEnvPath)) {
                envPaths.push(serviceEnvPath);
            }
        }
        // Add root services .env
        const rootEnvPath = path.join(process.cwd(), '../../.env');
        if (fs.existsSync(rootEnvPath)) {
            envPaths.push(rootEnvPath);
        }
        // Alternative root path for when running from service directory
        const altRootEnvPath = path.join(process.cwd(), '../../../appre-services/.env');
        if (fs.existsSync(altRootEnvPath)) {
            envPaths.push(altRootEnvPath);
        }
        // Load all found .env files (later files override earlier ones)
        envPaths.forEach(envPath => {
            dotenv.config({ path: envPath });
        });
    }
    // Extract required configuration
    const appName = process.env.APP_NAME;
    const environment = process.env.ENVIRONMENT;
    const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION;
    const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
    // Validate required fields
    if (!appName) {
        throw new Error('APP_NAME environment variable is required');
    }
    if (!environment) {
        throw new Error('ENVIRONMENT environment variable is required');
    }
    if (!region) {
        throw new Error('AWS_REGION or CDK_DEFAULT_REGION environment variable is required');
    }
    // Validate environment value
    if (!exports.VALID_ENVIRONMENTS.includes(environment)) {
        throw new Error(`ENVIRONMENT must be one of: ${exports.VALID_ENVIRONMENTS.join(', ')}`);
    }
    return {
        appName,
        environment,
        region,
        account,
    };
}
exports.loadEnvironmentConfig = loadEnvironmentConfig;
/**
 * Get environment configuration with CDK context override support
 */
function getEnvironmentConfig(app, servicePath) {
    // Load base configuration from .env files
    const baseConfig = loadEnvironmentConfig(servicePath);
    // Allow CDK context to override values
    const environment = app.node.tryGetContext('environment') || baseConfig.environment;
    const account = app.node.tryGetContext('account') || baseConfig.account;
    const region = app.node.tryGetContext('region') || baseConfig.region;
    // Validate environment if overridden
    if (!exports.VALID_ENVIRONMENTS.includes(environment)) {
        throw new Error(`ENVIRONMENT must be one of: ${exports.VALID_ENVIRONMENTS.join(', ')}`);
    }
    return {
        ...baseConfig,
        environment,
        account,
        region,
    };
}
exports.getEnvironmentConfig = getEnvironmentConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZCQUE2QjtBQUM3Qix5QkFBeUI7QUFDekIsaUNBQWlDO0FBWWpDOztHQUVHO0FBQ1UsUUFBQSxrQkFBa0IsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFVLENBQUM7QUFHbkU7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IscUJBQXFCLENBQUMsV0FBb0IsRUFBRSxVQUFVLEdBQUcsS0FBSztJQUM1RSwwRUFBMEU7SUFDMUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtRQUNmLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUVwQix1REFBdUQ7UUFDdkQsSUFBSSxXQUFXLEVBQUU7WUFDZixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUN0RCxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQ2pDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7YUFDL0I7U0FDRjtRQUVELHlCQUF5QjtRQUN6QixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUMzRCxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDOUIsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUM1QjtRQUVELGdFQUFnRTtRQUNoRSxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO1FBQ2hGLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRTtZQUNqQyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQy9CO1FBRUQsZ0VBQWdFO1FBQ2hFLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDekIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxpQ0FBaUM7SUFDakMsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDckMsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUM7SUFDNUMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztJQUN4RSxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0lBRTlFLDJCQUEyQjtJQUMzQixJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0tBQzlEO0lBRUQsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLDhDQUE4QyxDQUFDLENBQUM7S0FDakU7SUFFRCxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyxtRUFBbUUsQ0FBQyxDQUFDO0tBQ3RGO0lBRUQsNkJBQTZCO0lBQzdCLElBQUksQ0FBQywwQkFBa0IsQ0FBQyxRQUFRLENBQUMsV0FBMEIsQ0FBQyxFQUFFO1FBQzVELE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLDBCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDakY7SUFFRCxPQUFPO1FBQ0wsT0FBTztRQUNQLFdBQVc7UUFDWCxNQUFNO1FBQ04sT0FBTztLQUNSLENBQUM7QUFDSixDQUFDO0FBN0RELHNEQTZEQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQUMsR0FBUSxFQUFFLFdBQW9CO0lBQ2pFLDBDQUEwQztJQUMxQyxNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUV0RCx1Q0FBdUM7SUFDdkMsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztJQUNwRixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDO0lBQ3hFLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7SUFFckUscUNBQXFDO0lBQ3JDLElBQUksQ0FBQywwQkFBa0IsQ0FBQyxRQUFRLENBQUMsV0FBMEIsQ0FBQyxFQUFFO1FBQzVELE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLDBCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDakY7SUFFRCxPQUFPO1FBQ0wsR0FBRyxVQUFVO1FBQ2IsV0FBVztRQUNYLE9BQU87UUFDUCxNQUFNO0tBQ1AsQ0FBQztBQUNKLENBQUM7QUFwQkQsb0RBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xuXG4vKipcbiAqIEVudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gaW50ZXJmYWNlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW52aXJvbm1lbnRDb25maWcge1xuICBhcHBOYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBhY2NvdW50Pzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFZhbGlkIGVudmlyb25tZW50IHZhbHVlc1xuICovXG5leHBvcnQgY29uc3QgVkFMSURfRU5WSVJPTk1FTlRTID0gWydkZXYnLCAndGVzdCcsICdwcm9kJ10gYXMgY29uc3Q7XG5leHBvcnQgdHlwZSBFbnZpcm9ubWVudCA9IHR5cGVvZiBWQUxJRF9FTlZJUk9OTUVOVFNbbnVtYmVyXTtcblxuLyoqXG4gKiBMb2FkIGVudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gZnJvbSAuZW52IGZpbGVzXG4gKiBMb29rcyBmb3IgLmVudiBmaWxlcyBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICogMS4gU2VydmljZS1zcGVjaWZpYyAuZW52IGZpbGUgKGUuZy4sIGFwcHJlLXNlcnZpY2VzL2F1dGhlbnRpY2F0aW9uLy5lbnYpXG4gKiAyLiBSb290IHNlcnZpY2VzIC5lbnYgZmlsZSAoYXBwcmUtc2VydmljZXMvLmVudilcbiAqIDMuIEVudmlyb25tZW50IHZhcmlhYmxlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gbG9hZEVudmlyb25tZW50Q29uZmlnKHNlcnZpY2VQYXRoPzogc3RyaW5nLCBza2lwRG90RW52ID0gZmFsc2UpOiBFbnZpcm9ubWVudENvbmZpZyB7XG4gIC8vIExvYWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZyb20gLmVudiBmaWxlcyAodW5sZXNzIHNraXBwZWQgZm9yIHRlc3RpbmcpXG4gIGlmICghc2tpcERvdEVudikge1xuICAgIGNvbnN0IGVudlBhdGhzID0gW107XG4gICAgXG4gICAgLy8gQWRkIHNlcnZpY2Utc3BlY2lmaWMgLmVudiBpZiBzZXJ2aWNlUGF0aCBpcyBwcm92aWRlZFxuICAgIGlmIChzZXJ2aWNlUGF0aCkge1xuICAgICAgY29uc3Qgc2VydmljZUVudlBhdGggPSBwYXRoLmpvaW4oc2VydmljZVBhdGgsICcuZW52Jyk7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZXJ2aWNlRW52UGF0aCkpIHtcbiAgICAgICAgZW52UGF0aHMucHVzaChzZXJ2aWNlRW52UGF0aCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIEFkZCByb290IHNlcnZpY2VzIC5lbnZcbiAgICBjb25zdCByb290RW52UGF0aCA9IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCAnLi4vLi4vLmVudicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHJvb3RFbnZQYXRoKSkge1xuICAgICAgZW52UGF0aHMucHVzaChyb290RW52UGF0aCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEFsdGVybmF0aXZlIHJvb3QgcGF0aCBmb3Igd2hlbiBydW5uaW5nIGZyb20gc2VydmljZSBkaXJlY3RvcnlcbiAgICBjb25zdCBhbHRSb290RW52UGF0aCA9IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCAnLi4vLi4vLi4vYXBwcmUtc2VydmljZXMvLmVudicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKGFsdFJvb3RFbnZQYXRoKSkge1xuICAgICAgZW52UGF0aHMucHVzaChhbHRSb290RW52UGF0aCk7XG4gICAgfVxuICAgIFxuICAgIC8vIExvYWQgYWxsIGZvdW5kIC5lbnYgZmlsZXMgKGxhdGVyIGZpbGVzIG92ZXJyaWRlIGVhcmxpZXIgb25lcylcbiAgICBlbnZQYXRocy5mb3JFYWNoKGVudlBhdGggPT4ge1xuICAgICAgZG90ZW52LmNvbmZpZyh7IHBhdGg6IGVudlBhdGggfSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIC8vIEV4dHJhY3QgcmVxdWlyZWQgY29uZmlndXJhdGlvblxuICBjb25zdCBhcHBOYW1lID0gcHJvY2Vzcy5lbnYuQVBQX05BTUU7XG4gIGNvbnN0IGVudmlyb25tZW50ID0gcHJvY2Vzcy5lbnYuRU5WSVJPTk1FTlQ7XG4gIGNvbnN0IHJlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfHwgcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OO1xuICBjb25zdCBhY2NvdW50ID0gcHJvY2Vzcy5lbnYuQVdTX0FDQ09VTlRfSUQgfHwgcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVDtcbiAgXG4gIC8vIFZhbGlkYXRlIHJlcXVpcmVkIGZpZWxkc1xuICBpZiAoIWFwcE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FQUF9OQU1FIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkJyk7XG4gIH1cbiAgXG4gIGlmICghZW52aXJvbm1lbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VOVklST05NRU5UIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkJyk7XG4gIH1cbiAgXG4gIGlmICghcmVnaW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBV1NfUkVHSU9OIG9yIENES19ERUZBVUxUX1JFR0lPTiBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyByZXF1aXJlZCcpO1xuICB9XG4gIFxuICAvLyBWYWxpZGF0ZSBlbnZpcm9ubWVudCB2YWx1ZVxuICBpZiAoIVZBTElEX0VOVklST05NRU5UUy5pbmNsdWRlcyhlbnZpcm9ubWVudCBhcyBFbnZpcm9ubWVudCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVOVklST05NRU5UIG11c3QgYmUgb25lIG9mOiAke1ZBTElEX0VOVklST05NRU5UUy5qb2luKCcsICcpfWApO1xuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIGFwcE5hbWUsXG4gICAgZW52aXJvbm1lbnQsXG4gICAgcmVnaW9uLFxuICAgIGFjY291bnQsXG4gIH07XG59XG5cbi8qKlxuICogR2V0IGVudmlyb25tZW50IGNvbmZpZ3VyYXRpb24gd2l0aCBDREsgY29udGV4dCBvdmVycmlkZSBzdXBwb3J0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbnZpcm9ubWVudENvbmZpZyhhcHA6IGFueSwgc2VydmljZVBhdGg/OiBzdHJpbmcpOiBFbnZpcm9ubWVudENvbmZpZyB7XG4gIC8vIExvYWQgYmFzZSBjb25maWd1cmF0aW9uIGZyb20gLmVudiBmaWxlc1xuICBjb25zdCBiYXNlQ29uZmlnID0gbG9hZEVudmlyb25tZW50Q29uZmlnKHNlcnZpY2VQYXRoKTtcbiAgXG4gIC8vIEFsbG93IENESyBjb250ZXh0IHRvIG92ZXJyaWRlIHZhbHVlc1xuICBjb25zdCBlbnZpcm9ubWVudCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgYmFzZUNvbmZpZy5lbnZpcm9ubWVudDtcbiAgY29uc3QgYWNjb3VudCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2FjY291bnQnKSB8fCBiYXNlQ29uZmlnLmFjY291bnQ7XG4gIGNvbnN0IHJlZ2lvbiA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8IGJhc2VDb25maWcucmVnaW9uO1xuICBcbiAgLy8gVmFsaWRhdGUgZW52aXJvbm1lbnQgaWYgb3ZlcnJpZGRlblxuICBpZiAoIVZBTElEX0VOVklST05NRU5UUy5pbmNsdWRlcyhlbnZpcm9ubWVudCBhcyBFbnZpcm9ubWVudCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVOVklST05NRU5UIG11c3QgYmUgb25lIG9mOiAke1ZBTElEX0VOVklST05NRU5UUy5qb2luKCcsICcpfWApO1xuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIC4uLmJhc2VDb25maWcsXG4gICAgZW52aXJvbm1lbnQsXG4gICAgYWNjb3VudCxcbiAgICByZWdpb24sXG4gIH07XG59Il19