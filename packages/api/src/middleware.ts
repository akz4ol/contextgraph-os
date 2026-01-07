/**
 * API Middleware
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import type { ApiResponse } from './types.js';

// ============================================================================
// Error Types
// ============================================================================

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(resource: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

// ============================================================================
// Validation Middleware
// ============================================================================

export interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidateOptions): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(ApiError.badRequest('Validation failed', error.errors));
      } else {
        next(error);
      }
    }
  };
}

// ============================================================================
// Authentication Middleware
// ============================================================================

export interface AuthConfig {
  apiKeys?: Set<string>;
  enabled?: boolean;
}

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  authenticated?: boolean;
}

export function createAuthMiddleware(config: AuthConfig): RequestHandler {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!config.enabled) {
      req.authenticated = true;
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      return next(ApiError.unauthorized('API key required'));
    }

    if (config.apiKeys && !config.apiKeys.has(apiKey)) {
      return next(ApiError.unauthorized('Invalid API key'));
    }

    req.apiKey = apiKey;
    req.authenticated = true;
    next();
  };
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof ZodError) {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.errors,
      },
    };
    res.status(400).json(response);
    return;
  }

  // Unknown error
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  };
  res.status(500).json(response);
}

// ============================================================================
// Request Logging Middleware
// ============================================================================

export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
      );
    });

    next();
  };
}

// ============================================================================
// Not Found Handler
// ============================================================================

export function notFoundHandler(): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound('Endpoint'));
  };
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
