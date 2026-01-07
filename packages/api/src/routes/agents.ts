/**
 * Agent Routes
 */

import { Router } from 'express';
import type { ContextGraph } from '@contextgraph/sdk';
import { validate, asyncHandler, ApiError } from '../middleware.js';
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  ExecuteActionSchema,
  IdParamSchema,
  PaginationSchema,
} from '../types.js';
import type { ApiResponse } from '../types.js';

export function createAgentRoutes(client: ContextGraph): Router {
  const router = Router();

  // List agents
  router.get(
    '/',
    validate({ query: PaginationSchema }),
    asyncHandler(async (req, res) => {
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      const result = await client.getActiveAgents();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const agents = result.value.slice(offset, offset + limit);

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: agents.map((a) => a.data),
        meta: { total: result.value.length, limit, offset },
      };
      res.json(response);
    })
  );

  // Create agent
  router.post(
    '/',
    validate({ body: CreateAgentSchema }),
    asyncHandler(async (req, res) => {
      const result = await client.createAgent(req.body);

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

  // Get agent by ID or name
  router.get(
    '/:id',
    validate({ params: IdParamSchema }),
    asyncHandler(async (req, res) => {
      const idOrName = req.params['id'] as string;

      // Try by ID first
      let result = await client.getAgent(idOrName);

      // If not found by ID, try by name
      if (!result.ok || !result.value) {
        result = await client.findAgentByName(idOrName);
      }

      if (!result.ok || !result.value) {
        throw ApiError.notFound('Agent');
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value.data,
      };
      res.json(response);
    })
  );

  // Update agent
  router.put(
    '/:id',
    validate({ params: IdParamSchema, body: UpdateAgentSchema }),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as string;
      const existing = await client.getAgent(id);
      if (!existing.ok || !existing.value) {
        throw ApiError.notFound('Agent');
      }

      // TODO: Implement agent update in SDK
      const response: ApiResponse<unknown> = {
        success: true,
        data: existing.value.data,
      };
      res.json(response);
    })
  );

  // Execute action as agent
  router.post(
    '/:id/execute',
    validate({ params: IdParamSchema, body: ExecuteActionSchema }),
    asyncHandler(async (req, res) => {
      const agentId = req.params['id'] as string;
      const { action, resourceType, resourceId, parameters } = req.body;

      const result = await client.execute({
        agentId,
        action,
        resourceType,
        resourceId,
        parameters,
      });

      if (!result.ok) {
        throw ApiError.badRequest(result.error.message);
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: result.value,
      };
      res.json(response);
    })
  );

  return router;
}
