/**
 * @contextgraph/api
 *
 * REST API server for ContextGraph OS
 */

// Server
export { createServer, createApp, type ServerConfig, type ContextGraphServer } from './server.js';

// Middleware
export {
  ApiError,
  validate,
  createAuthMiddleware,
  errorHandler,
  notFoundHandler,
  requestLogger,
  asyncHandler,
  type ValidateOptions,
  type AuthConfig,
  type AuthenticatedRequest,
} from './middleware.js';

// Types
export * from './types.js';

// Routes (for custom composition)
export {
  createEntityRoutes,
  createAgentRoutes,
  createDecisionRoutes,
  createPolicyRoutes,
  createSystemRoutes,
} from './routes/index.js';
