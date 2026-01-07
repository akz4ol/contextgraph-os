/**
 * Entity Routes
 */

import { Router } from 'express';
import type { ContextGraph } from '@contextgraph/sdk';
import type { EntityId } from '@contextgraph/core';
import { validate, asyncHandler, ApiError } from '../middleware.js';
import {
  CreateEntitySchema,
  UpdateEntitySchema,
  ListEntitiesQuerySchema,
  IdParamSchema,
  CreateClaimSchema,
  ListClaimsQuerySchema,
} from '../types.js';
import type { ApiResponse } from '../types.js';

export function createEntityRoutes(client: ContextGraph): Router {
  const router = Router();

  // List entities
  router.get(
    '/',
    validate({ query: ListEntitiesQuerySchema }),
    asyncHandler(async (req, res) => {
      const type = req.query['type'] as string | undefined;
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      let result;
      if (type) {
        result = await client.findEntitiesByType(type, { limit, offset });
      } else {
        result = await client.findEntitiesByType('*', { limit, offset });
      }

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: result.value.map((e) => e.data),
        meta: { limit, offset },
      };
      res.json(response);
    })
  );

  // Create entity
  router.post(
    '/',
    validate({ body: CreateEntitySchema }),
    asyncHandler(async (req, res) => {
      const result = await client.createEntity(req.body);

      if (!result.ok) {
        throw ApiError.badRequest(result.error.message);
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value.data,
      };
      res.status(201).json(response);
    })
  );

  // Get entity by ID
  router.get(
    '/:id',
    validate({ params: IdParamSchema }),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as EntityId;
      const result = await client.getEntity(id);

      if (!result.ok) {
        throw ApiError.notFound('Entity');
      }

      if (!result.value) {
        throw ApiError.notFound('Entity');
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value.data,
      };
      res.json(response);
    })
  );

  // Update entity
  router.put(
    '/:id',
    validate({ params: IdParamSchema, body: UpdateEntitySchema }),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as EntityId;
      const existing = await client.getEntity(id);
      if (!existing.ok || !existing.value) {
        throw ApiError.notFound('Entity');
      }

      // TODO: Implement entity update in SDK
      const response: ApiResponse<unknown> = {
        success: true,
        data: existing.value.data,
      };
      res.json(response);
    })
  );

  // Delete entity
  router.delete(
    '/:id',
    validate({ params: IdParamSchema }),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as EntityId;
      const existing = await client.getEntity(id);
      if (!existing.ok || !existing.value) {
        throw ApiError.notFound('Entity');
      }

      // TODO: Implement entity delete in SDK
      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      res.json(response);
    })
  );

  // Get claims for entity
  router.get(
    '/:id/claims',
    validate({ params: IdParamSchema, query: ListClaimsQuerySchema }),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as EntityId;
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      const result = await client.getClaims(id);

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const claims = result.value.slice(offset, offset + limit);

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: claims.map((c) => c.data),
        meta: { total: result.value.length, limit, offset },
      };
      res.json(response);
    })
  );

  // Add claim to entity
  router.post(
    '/:id/claims',
    validate({ params: IdParamSchema, body: CreateClaimSchema }),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as EntityId;
      const { predicate, value, objectId, context } = req.body;

      const result = await client.addClaim({
        subjectId: id,
        predicate,
        value,
        objectId,
        context,
      });

      if (!result.ok) {
        throw ApiError.badRequest(result.error.message);
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value.data,
      };
      res.status(201).json(response);
    })
  );

  return router;
}
