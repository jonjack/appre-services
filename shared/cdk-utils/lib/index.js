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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMEJBQTBCO0FBQzFCLG1DQU1rQjtBQUpoQiw0R0FBQSxrQkFBa0IsT0FBQTtBQUVsQiwrR0FBQSxxQkFBcUIsT0FBQTtBQUNyQiw4R0FBQSxvQkFBb0IsT0FBQTtBQUd0Qiw0QkFBNEI7QUFDNUIsbUNBS2tCO0FBSGhCLDRHQUFBLGtCQUFrQixPQUFBO0FBQ2xCLDhHQUFBLG9CQUFvQixPQUFBO0FBQ3BCLHVHQUFBLGFBQWEsT0FBQTtBQUdmLG9CQUFvQjtBQUNwQixxQ0FNbUI7QUFKakIsMkdBQUEsZ0JBQWdCLE9BQUE7QUFDaEIsMEdBQUEsZUFBZSxPQUFBO0FBRWYscUdBQUEsVUFBVSxPQUFBO0FBR1osZ0RBQWdEO0FBQ2hELGlDQUE2QztBQUFwQywyR0FBQSxrQkFBa0IsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvbmZpZ3VyYXRpb24gdXRpbGl0aWVzXG5leHBvcnQge1xuICBFbnZpcm9ubWVudENvbmZpZyxcbiAgVkFMSURfRU5WSVJPTk1FTlRTLFxuICBFbnZpcm9ubWVudCxcbiAgbG9hZEVudmlyb25tZW50Q29uZmlnLFxuICBnZXRFbnZpcm9ubWVudENvbmZpZyxcbn0gZnJvbSAnLi9jb25maWcnO1xuXG4vLyBSZXNvdXJjZSBuYW1pbmcgdXRpbGl0aWVzXG5leHBvcnQge1xuICBSZXNvdXJjZU5hbWluZyxcbiAgY3JlYXRlUmVzb3VyY2VOYW1lLFxuICBjcmVhdGVSZXNvdXJjZU5hbWluZyxcbiAgUmVzb3VyY2VOYW1lcyxcbn0gZnJvbSAnLi9uYW1pbmcnO1xuXG4vLyBUYWdnaW5nIHV0aWxpdGllc1xuZXhwb3J0IHtcbiAgR2xvYmFsVGFncyxcbiAgY3JlYXRlR2xvYmFsVGFncyxcbiAgU0VSVklDRV9ET01BSU5TLFxuICBTZXJ2aWNlRG9tYWluLFxuICBUYWdCdWlsZGVyLFxufSBmcm9tICcuL3RhZ2dpbmcnO1xuXG4vLyBVdGlsaXR5IGNsYXNzIHRoYXQgY29tYmluZXMgYWxsIGZ1bmN0aW9uYWxpdHlcbmV4cG9ydCB7IEFwcFJlc291cmNlQnVpbGRlciB9IGZyb20gJy4vdXRpbHMnOyJdfQ==