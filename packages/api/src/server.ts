/**
 * ContextGraph API Server
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ContextGraph } from '@contextgraph/sdk';
import {
  createAuthMiddleware,
  errorHandler,
  notFoundHandler,
  requestLogger,
  type AuthConfig,
} from './middleware.js';
import {
  createEntityRoutes,
  createAgentRoutes,
  createDecisionRoutes,
  createPolicyRoutes,
  createSystemRoutes,
} from './routes/index.js';

// ============================================================================
// Server Configuration
// ============================================================================

export interface ServerConfig {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: 'localhost') */
  host?: string;
  /** Enable CORS (default: true) */
  cors?: boolean;
  /** CORS origins (default: '*') */
  corsOrigins?: string | string[];
  /** Enable rate limiting (default: true) */
  rateLimit?: boolean;
  /** Rate limit max requests per window (default: 100) */
  rateLimitMax?: number;
  /** Rate limit window in ms (default: 60000) */
  rateLimitWindow?: number;
  /** Enable request logging (default: true) */
  logging?: boolean;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** API prefix (default: '/api/v1') */
  apiPrefix?: string;
}

const defaultConfig: Required<ServerConfig> = {
  port: 3000,
  host: 'localhost',
  cors: true,
  corsOrigins: '*',
  rateLimit: true,
  rateLimitMax: 100,
  rateLimitWindow: 60000,
  logging: true,
  auth: { enabled: false },
  apiPrefix: '/api/v1',
};

// ============================================================================
// Server Factory
// ============================================================================

export interface ContextGraphServer {
  app: Express;
  client: ContextGraph;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export async function createServer(
  config: ServerConfig = {}
): Promise<ContextGraphServer> {
  const cfg = { ...defaultConfig, ...config };

  // Create ContextGraph client
  const clientResult = await ContextGraph.create({
    enablePolicies: false,
    enableCapabilities: false,
  });

  if (!clientResult.ok) {
    throw new Error(`Failed to create ContextGraph client: ${clientResult.error.message}`);
  }

  const client = clientResult.value;

  // Create Express app
  const app = express();

  // Security middleware
  app.use(helmet());

  // Compression
  app.use(compression());

  // CORS
  if (cfg.cors) {
    app.use(cors({ origin: cfg.corsOrigins }));
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  if (cfg.logging) {
    app.use(requestLogger());
  }

  // Rate limiting
  if (cfg.rateLimit) {
    app.use(
      rateLimit({
        windowMs: cfg.rateLimitWindow,
        max: cfg.rateLimitMax,
        message: {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
          },
        },
      })
    );
  }

  // Authentication
  app.use(createAuthMiddleware(cfg.auth));

  // API Routes
  const apiRouter = express.Router();
  apiRouter.use('/entities', createEntityRoutes(client));
  apiRouter.use('/agents', createAgentRoutes(client));
  apiRouter.use('/decisions', createDecisionRoutes(client));
  apiRouter.use('/policies', createPolicyRoutes(client));
  apiRouter.use('/', createSystemRoutes(client));

  app.use(cfg.apiPrefix, apiRouter);

  // Not found handler
  app.use(notFoundHandler());

  // Error handler
  app.use(errorHandler);

  // Server instance
  let server: ReturnType<typeof app.listen> | null = null;

  return {
    app,
    client,
    async start() {
      return new Promise((resolve) => {
        server = app.listen(cfg.port, cfg.host, () => {
          console.log(`ContextGraph API server running at http://${cfg.host}:${cfg.port}`);
          console.log(`API endpoints available at http://${cfg.host}:${cfg.port}${cfg.apiPrefix}`);
          resolve();
        });
      });
    },
    async stop() {
      return new Promise((resolve, reject) => {
        if (server) {
          server.close((err) => {
            if (err) {
              reject(err);
            } else {
              console.log('Server stopped');
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    },
  };
}

// ============================================================================
// Express App Factory (for testing)
// ============================================================================

export async function createApp(client: ContextGraph, config: ServerConfig = {}): Promise<Express> {
  const cfg = { ...defaultConfig, ...config };

  const app = express();

  // Security middleware
  app.use(helmet());

  // Compression
  app.use(compression());

  // CORS
  if (cfg.cors) {
    app.use(cors({ origin: cfg.corsOrigins }));
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Authentication
  app.use(createAuthMiddleware(cfg.auth));

  // API Routes
  const apiRouter = express.Router();
  apiRouter.use('/entities', createEntityRoutes(client));
  apiRouter.use('/agents', createAgentRoutes(client));
  apiRouter.use('/decisions', createDecisionRoutes(client));
  apiRouter.use('/policies', createPolicyRoutes(client));
  apiRouter.use('/', createSystemRoutes(client));

  app.use(cfg.apiPrefix, apiRouter);

  // Not found handler
  app.use(notFoundHandler());

  // Error handler
  app.use(errorHandler);

  return app;
}
