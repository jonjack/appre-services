"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppResourceBuilder = exports.TagBuilder = exports.SERVICE_DOMAINS = exports.createGlobalTags = exports.ResourceNames = exports.createResourceNaming = exports.createResourceName = exports.getEnvironmentConfig = exports.loadEnvironmentConfig = exports.VALID_ENVIRONMENTS = void 0;
// Configuration utilities
var config_1 = require("./config");
Object.defineProperty(exports, "VALID_ENVIRONMENTS", { enumerable: true, get: function () { return config_1.VALID_ENVIRONMENTS; } });
Object.defineProperty(exports, "loadEnvironmentConfig", { enumerable: true, get: function () { return config_1.loadEnvironmentConfig; } });
Object.defineProperty(exports, "getEnvironmentConfig", { enumerable: true, get: function () { return config_1.getEnvironmentConfig; } });
// Resource naming utilities
var naming_1 = require("./naming");
Object.defineProperty(exports, "createResourceName", { enumerable: true, get: function () { return naming_1.createResourceName; } });
Object.defineProperty(exports, "createResourceNaming", { enumerable: true, get: function () { return naming_1.createResourceNaming; } });
Object.defineProperty(exports, "ResourceNames", { enumerable: true, get: function () { return naming_1.ResourceNames; } });
// Tagging utilities
var tagging_1 = require("./tagging");
Object.defineProperty(exports, "createGlobalTags", { enumerable: true, get: function () { return tagging_1.createGlobalTags; } });
Object.defineProperty(exports, "SERVICE_DOMAINS", { enumerable: true, get: function () { return tagging_1.SERVICE_DOMAINS; } });
Object.defineProperty(exports, "TagBuilder", { enumerable: true, get: function () { return tagging_1.TagBuilder; } });
// Utility class that combines all functionality
var utils_1 = require("./utils");
Object.defineProperty(exports, "AppResourceBuilder", { enumerable: true, get: function () { return utils_1.AppResourceBuilder; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwwQkFBMEI7QUFDMUIsbUNBTWtCO0FBSmhCLDRHQUFBLGtCQUFrQixPQUFBO0FBRWxCLCtHQUFBLHFCQUFxQixPQUFBO0FBQ3JCLDhHQUFBLG9CQUFvQixPQUFBO0FBR3RCLDRCQUE0QjtBQUM1QixtQ0FLa0I7QUFIaEIsNEdBQUEsa0JBQWtCLE9BQUE7QUFDbEIsOEdBQUEsb0JBQW9CLE9BQUE7QUFDcEIsdUdBQUEsYUFBYSxPQUFBO0FBR2Ysb0JBQW9CO0FBQ3BCLHFDQU1tQjtBQUpqQiwyR0FBQSxnQkFBZ0IsT0FBQTtBQUNoQiwwR0FBQSxlQUFlLE9BQUE7QUFFZixxR0FBQSxVQUFVLE9BQUE7QUFHWixnREFBZ0Q7QUFDaEQsaUNBQTZDO0FBQXBDLDJHQUFBLGtCQUFrQixPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29uZmlndXJhdGlvbiB1dGlsaXRpZXNcbmV4cG9ydCB7XG4gIEVudmlyb25tZW50Q29uZmlnLFxuICBWQUxJRF9FTlZJUk9OTUVOVFMsXG4gIEVudmlyb25tZW50LFxuICBsb2FkRW52aXJvbm1lbnRDb25maWcsXG4gIGdldEVudmlyb25tZW50Q29uZmlnLFxufSBmcm9tICcuL2NvbmZpZyc7XG5cbi8vIFJlc291cmNlIG5hbWluZyB1dGlsaXRpZXNcbmV4cG9ydCB7XG4gIFJlc291cmNlTmFtaW5nLFxuICBjcmVhdGVSZXNvdXJjZU5hbWUsXG4gIGNyZWF0ZVJlc291cmNlTmFtaW5nLFxuICBSZXNvdXJjZU5hbWVzLFxufSBmcm9tICcuL25hbWluZyc7XG5cbi8vIFRhZ2dpbmcgdXRpbGl0aWVzXG5leHBvcnQge1xuICBHbG9iYWxUYWdzLFxuICBjcmVhdGVHbG9iYWxUYWdzLFxuICBTRVJWSUNFX0RPTUFJTlMsXG4gIFNlcnZpY2VEb21haW4sXG4gIFRhZ0J1aWxkZXIsXG59IGZyb20gJy4vdGFnZ2luZyc7XG5cbi8vIFV0aWxpdHkgY2xhc3MgdGhhdCBjb21iaW5lcyBhbGwgZnVuY3Rpb25hbGl0eVxuZXhwb3J0IHsgQXBwUmVzb3VyY2VCdWlsZGVyIH0gZnJvbSAnLi91dGlscyc7Il19