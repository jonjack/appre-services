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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBNkI7QUFDN0IseUJBQXlCO0FBQ3pCLGlDQUFpQztBQVlqQzs7R0FFRztBQUNVLFFBQUEsa0JBQWtCLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBVSxDQUFDO0FBR25FOzs7Ozs7R0FNRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLFdBQW9CLEVBQUUsVUFBVSxHQUFHLEtBQUs7SUFDNUUsMEVBQTBFO0lBQzFFLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFFcEIsdURBQXVEO1FBQ3ZELElBQUksV0FBVyxFQUFFO1lBQ2YsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDdEQsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFO2dCQUNqQyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQy9CO1NBQ0Y7UUFFRCx5QkFBeUI7UUFDekIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDM0QsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQzlCLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDNUI7UUFFRCxnRUFBZ0U7UUFDaEUsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsOEJBQThCLENBQUMsQ0FBQztRQUNoRixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDakMsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUMvQjtRQUVELGdFQUFnRTtRQUNoRSxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3pCLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FBQztLQUNKO0lBRUQsaUNBQWlDO0lBQ2pDLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0lBQ3JDLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO0lBQzVDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUM7SUFDeEUsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQztJQUU5RSwyQkFBMkI7SUFDM0IsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQztLQUM5RDtJQUVELElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO0tBQ2pFO0lBRUQsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsbUVBQW1FLENBQUMsQ0FBQztLQUN0RjtJQUVELDZCQUE2QjtJQUM3QixJQUFJLENBQUMsMEJBQWtCLENBQUMsUUFBUSxDQUFDLFdBQTBCLENBQUMsRUFBRTtRQUM1RCxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQiwwQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ2pGO0lBRUQsT0FBTztRQUNMLE9BQU87UUFDUCxXQUFXO1FBQ1gsTUFBTTtRQUNOLE9BQU87S0FDUixDQUFDO0FBQ0osQ0FBQztBQTdERCxzREE2REM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEdBQVEsRUFBRSxXQUFvQjtJQUNqRSwwQ0FBMEM7SUFDMUMsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFdEQsdUNBQXVDO0lBQ3ZDLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7SUFDcEYsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQztJQUN4RSxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO0lBRXJFLHFDQUFxQztJQUNyQyxJQUFJLENBQUMsMEJBQWtCLENBQUMsUUFBUSxDQUFDLFdBQTBCLENBQUMsRUFBRTtRQUM1RCxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQiwwQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ2pGO0lBRUQsT0FBTztRQUNMLEdBQUcsVUFBVTtRQUNiLFdBQVc7UUFDWCxPQUFPO1FBQ1AsTUFBTTtLQUNQLENBQUM7QUFDSixDQUFDO0FBcEJELG9EQW9CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcblxuLyoqXG4gKiBFbnZpcm9ubWVudCBjb25maWd1cmF0aW9uIGludGVyZmFjZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVudmlyb25tZW50Q29uZmlnIHtcbiAgYXBwTmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICByZWdpb246IHN0cmluZztcbiAgYWNjb3VudD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBWYWxpZCBlbnZpcm9ubWVudCB2YWx1ZXNcbiAqL1xuZXhwb3J0IGNvbnN0IFZBTElEX0VOVklST05NRU5UUyA9IFsnZGV2JywgJ3Rlc3QnLCAncHJvZCddIGFzIGNvbnN0O1xuZXhwb3J0IHR5cGUgRW52aXJvbm1lbnQgPSB0eXBlb2YgVkFMSURfRU5WSVJPTk1FTlRTW251bWJlcl07XG5cbi8qKlxuICogTG9hZCBlbnZpcm9ubWVudCBjb25maWd1cmF0aW9uIGZyb20gLmVudiBmaWxlc1xuICogTG9va3MgZm9yIC5lbnYgZmlsZXMgaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAqIDEuIFNlcnZpY2Utc3BlY2lmaWMgLmVudiBmaWxlIChlLmcuLCBhcHByZS1zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi8uZW52KVxuICogMi4gUm9vdCBzZXJ2aWNlcyAuZW52IGZpbGUgKGFwcHJlLXNlcnZpY2VzLy5lbnYpXG4gKiAzLiBFbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvYWRFbnZpcm9ubWVudENvbmZpZyhzZXJ2aWNlUGF0aD86IHN0cmluZywgc2tpcERvdEVudiA9IGZhbHNlKTogRW52aXJvbm1lbnRDb25maWcge1xuICAvLyBMb2FkIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIC5lbnYgZmlsZXMgKHVubGVzcyBza2lwcGVkIGZvciB0ZXN0aW5nKVxuICBpZiAoIXNraXBEb3RFbnYpIHtcbiAgICBjb25zdCBlbnZQYXRocyA9IFtdO1xuICAgIFxuICAgIC8vIEFkZCBzZXJ2aWNlLXNwZWNpZmljIC5lbnYgaWYgc2VydmljZVBhdGggaXMgcHJvdmlkZWRcbiAgICBpZiAoc2VydmljZVBhdGgpIHtcbiAgICAgIGNvbnN0IHNlcnZpY2VFbnZQYXRoID0gcGF0aC5qb2luKHNlcnZpY2VQYXRoLCAnLmVudicpO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2VydmljZUVudlBhdGgpKSB7XG4gICAgICAgIGVudlBhdGhzLnB1c2goc2VydmljZUVudlBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBBZGQgcm9vdCBzZXJ2aWNlcyAuZW52XG4gICAgY29uc3Qgcm9vdEVudlBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJy4uLy4uLy5lbnYnKTtcbiAgICBpZiAoZnMuZXhpc3RzU3luYyhyb290RW52UGF0aCkpIHtcbiAgICAgIGVudlBhdGhzLnB1c2gocm9vdEVudlBhdGgpO1xuICAgIH1cbiAgICBcbiAgICAvLyBBbHRlcm5hdGl2ZSByb290IHBhdGggZm9yIHdoZW4gcnVubmluZyBmcm9tIHNlcnZpY2UgZGlyZWN0b3J5XG4gICAgY29uc3QgYWx0Um9vdEVudlBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJy4uLy4uLy4uL2FwcHJlLXNlcnZpY2VzLy5lbnYnKTtcbiAgICBpZiAoZnMuZXhpc3RzU3luYyhhbHRSb290RW52UGF0aCkpIHtcbiAgICAgIGVudlBhdGhzLnB1c2goYWx0Um9vdEVudlBhdGgpO1xuICAgIH1cbiAgICBcbiAgICAvLyBMb2FkIGFsbCBmb3VuZCAuZW52IGZpbGVzIChsYXRlciBmaWxlcyBvdmVycmlkZSBlYXJsaWVyIG9uZXMpXG4gICAgZW52UGF0aHMuZm9yRWFjaChlbnZQYXRoID0+IHtcbiAgICAgIGRvdGVudi5jb25maWcoeyBwYXRoOiBlbnZQYXRoIH0pO1xuICAgIH0pO1xuICB9XG4gIFxuICAvLyBFeHRyYWN0IHJlcXVpcmVkIGNvbmZpZ3VyYXRpb25cbiAgY29uc3QgYXBwTmFtZSA9IHByb2Nlc3MuZW52LkFQUF9OQU1FO1xuICBjb25zdCBlbnZpcm9ubWVudCA9IHByb2Nlc3MuZW52LkVOVklST05NRU5UO1xuICBjb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTjtcbiAgY29uc3QgYWNjb3VudCA9IHByb2Nlc3MuZW52LkFXU19BQ0NPVU5UX0lEIHx8IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQ7XG4gIFxuICAvLyBWYWxpZGF0ZSByZXF1aXJlZCBmaWVsZHNcbiAgaWYgKCFhcHBOYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBUFBfTkFNRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyByZXF1aXJlZCcpO1xuICB9XG4gIFxuICBpZiAoIWVudmlyb25tZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdFTlZJUk9OTUVOVCBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyByZXF1aXJlZCcpO1xuICB9XG4gIFxuICBpZiAoIXJlZ2lvbikge1xuICAgIHRocm93IG5ldyBFcnJvcignQVdTX1JFR0lPTiBvciBDREtfREVGQVVMVF9SRUdJT04gZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWQnKTtcbiAgfVxuICBcbiAgLy8gVmFsaWRhdGUgZW52aXJvbm1lbnQgdmFsdWVcbiAgaWYgKCFWQUxJRF9FTlZJUk9OTUVOVFMuaW5jbHVkZXMoZW52aXJvbm1lbnQgYXMgRW52aXJvbm1lbnQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFTlZJUk9OTUVOVCBtdXN0IGJlIG9uZSBvZjogJHtWQUxJRF9FTlZJUk9OTUVOVFMuam9pbignLCAnKX1gKTtcbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBhcHBOYW1lLFxuICAgIGVudmlyb25tZW50LFxuICAgIHJlZ2lvbixcbiAgICBhY2NvdW50LFxuICB9O1xufVxuXG4vKipcbiAqIEdldCBlbnZpcm9ubWVudCBjb25maWd1cmF0aW9uIHdpdGggQ0RLIGNvbnRleHQgb3ZlcnJpZGUgc3VwcG9ydFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW52aXJvbm1lbnRDb25maWcoYXBwOiBhbnksIHNlcnZpY2VQYXRoPzogc3RyaW5nKTogRW52aXJvbm1lbnRDb25maWcge1xuICAvLyBMb2FkIGJhc2UgY29uZmlndXJhdGlvbiBmcm9tIC5lbnYgZmlsZXNcbiAgY29uc3QgYmFzZUNvbmZpZyA9IGxvYWRFbnZpcm9ubWVudENvbmZpZyhzZXJ2aWNlUGF0aCk7XG4gIFxuICAvLyBBbGxvdyBDREsgY29udGV4dCB0byBvdmVycmlkZSB2YWx1ZXNcbiAgY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8IGJhc2VDb25maWcuZW52aXJvbm1lbnQ7XG4gIGNvbnN0IGFjY291bnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhY2NvdW50JykgfHwgYmFzZUNvbmZpZy5hY2NvdW50O1xuICBjb25zdCByZWdpb24gPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdyZWdpb24nKSB8fCBiYXNlQ29uZmlnLnJlZ2lvbjtcbiAgXG4gIC8vIFZhbGlkYXRlIGVudmlyb25tZW50IGlmIG92ZXJyaWRkZW5cbiAgaWYgKCFWQUxJRF9FTlZJUk9OTUVOVFMuaW5jbHVkZXMoZW52aXJvbm1lbnQgYXMgRW52aXJvbm1lbnQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFTlZJUk9OTUVOVCBtdXN0IGJlIG9uZSBvZjogJHtWQUxJRF9FTlZJUk9OTUVOVFMuam9pbignLCAnKX1gKTtcbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICAuLi5iYXNlQ29uZmlnLFxuICAgIGVudmlyb25tZW50LFxuICAgIGFjY291bnQsXG4gICAgcmVnaW9uLFxuICB9O1xufSJdfQ==