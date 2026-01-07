/**
 * Decision Routes
 */

import { Router } from 'express';
import type { ContextGraph } from '@contextgraph/sdk';
import { validate, asyncHandler, ApiError } from '../middleware.js';
import {
  CreateDecisionSchema,
  ListDecisionsQuerySchema,
  ApproveDecisionSchema,
  RejectDecisionSchema,
  IdParamSchema,
} from '../types.js';
import type { ApiResponse } from '../types.js';

export function createDecisionRoutes(client: ContextGraph): Router {
  const router = Router();

  // List decisions
  router.get(
    '/',
    validate({ query: ListDecisionsQuerySchema }),
    asyncHandler(async (req, res) => {
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      // Get pending decisions
      // TODO: Add status filter to SDK
      const result = await client.getPendingDecisions();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const decisions = result.value.slice(offset, offset + limit);

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: decisions.map((d) => d.data),
        meta: { total: result.value.length, limit, offset },
      };
      res.json(response);
    })
  );

  // Create decision
  router.post(
    '/',
    validate({ body: CreateDecisionSchema }),
    asyncHandler(async (req, res) => {
      const result = await client.recordDecision(req.body);

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

  // Get decision by ID
  router.get(
    '/:id',
    validate({ params: IdParamSchema }),
    asyncHandler(async (req, res) => {
      const decisionId = req.params['id'] as string;

      // TODO: Add getDecision method to SDK
      // For now, search in pending decisions
      const result = await client.getPendingDecisions();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const decision = result.value.find((d) => d.data.id === decisionId);

      if (!decision) {
        throw ApiError.notFound('Decision');
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: decision.data,
      };
      res.json(response);
    })
  );

  // Approve decision
  router.post(
    '/:id/approve',
    validate({ params: IdParamSchema, body: ApproveDecisionSchema }),
    asyncHandler(async (req, res) => {
      const decisionId = req.params['id'] as string;
      const { approverId } = req.body;

      const result = await client.approveDecision(decisionId, approverId);

      if (!result.ok) {
        throw ApiError.badRequest(result.error.message);
      }

      const resultValue = result.value;
      if (!resultValue) {
        throw ApiError.notFound('Decision');
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: resultValue.data,
      };
      res.json(response);
    })
  );

  // Reject decision
  router.post(
    '/:id/reject',
    validate({ params: IdParamSchema, body: RejectDecisionSchema }),
    asyncHandler(async (req, _res) => {
      const { rejecterId, reason } = req.body;

      // TODO: Add rejectDecision method to SDK
      throw ApiError.badRequest(`Rejection not implemented: ${rejecterId} - ${reason}`);
    })
  );

  return router;
}
