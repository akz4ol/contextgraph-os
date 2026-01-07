/**
 * System Routes (stats, audit, provenance)
 */

import { Router } from 'express';
import type { ContextGraph } from '@contextgraph/sdk';
import { validate, asyncHandler, ApiError } from '../middleware.js';
import { AuditQuerySchema, ProvenanceQuerySchema } from '../types.js';
import type { ApiResponse } from '../types.js';

export function createSystemRoutes(client: ContextGraph): Router {
  const router = Router();

  // Get system statistics
  router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
      const result = await client.getStats();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value,
      };
      res.json(response);
    })
  );

  // Get audit trail
  router.get(
    '/audit',
    validate({ query: AuditQuerySchema }),
    asyncHandler(async (req, res) => {
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      const result = await client.getAuditTrail({ limit: limit + offset });

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const entries = result.value.slice(offset, offset + limit);

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: entries,
        meta: { limit, offset },
      };
      res.json(response);
    })
  );

  // Query provenance
  router.get(
    '/provenance',
    validate({ query: ProvenanceQuerySchema }),
    asyncHandler(async (req, res) => {
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      const result = await client.queryProvenance({ limit: limit + offset });

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const entries = result.value.slice(offset, offset + limit);

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: entries.map((e) => e.data),
        meta: { limit, offset },
      };
      res.json(response);
    })
  );

  // Verify provenance chain
  router.post(
    '/provenance/verify',
    asyncHandler(async (_req, res) => {
      const result = await client.verifyProvenance();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value,
      };
      res.json(response);
    })
  );

  // Health check
  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const stats = await client.getStats();

      const response: ApiResponse<{ status: string; timestamp: string }> = {
        success: true,
        data: {
          status: stats.ok ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
        },
      };
      res.json(response);
    })
  );

  return router;
}
