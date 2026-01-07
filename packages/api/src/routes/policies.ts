/**
 * Policy Routes
 */

import { Router } from 'express';
import type { ContextGraph } from '@contextgraph/sdk';
import { validate, asyncHandler, ApiError } from '../middleware.js';
import {
  CreatePolicySchema,
  UpdatePolicySchema,
  IdParamSchema,
  PaginationSchema,
} from '../types.js';
import type { ApiResponse } from '../types.js';

export function createPolicyRoutes(client: ContextGraph): Router {
  const router = Router();

  // List policies
  router.get(
    '/',
    validate({ query: PaginationSchema }),
    asyncHandler(async (req, res) => {
      const limit = Number(req.query['limit']) || 20;
      const offset = Number(req.query['offset']) || 0;

      const result = await client.getEffectivePolicies();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const policies = result.value.slice(offset, offset + limit);

      const response: ApiResponse<unknown[]> = {
        success: true,
        data: policies.map((p) => p.data),
        meta: { total: result.value.length, limit, offset },
      };
      res.json(response);
    })
  );

  // Create policy
  router.post(
    '/',
    validate({ body: CreatePolicySchema }),
    asyncHandler(async (req, res) => {
      const result = await client.createPolicy(req.body);

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

  // Get policy by ID
  router.get(
    '/:id',
    validate({ params: IdParamSchema }),
    asyncHandler(async (req, res) => {
      const policyId = req.params['id'] as string;

      // TODO: Add getPolicy method to SDK
      const result = await client.getEffectivePolicies();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const policy = result.value.find((p) => p.data.id === policyId);

      if (!policy) {
        throw ApiError.notFound('Policy');
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: policy.data,
      };
      res.json(response);
    })
  );

  // Update policy
  router.put(
    '/:id',
    validate({ params: IdParamSchema, body: UpdatePolicySchema }),
    asyncHandler(async (req, res) => {
      const policyId = req.params['id'] as string;

      // TODO: Add updatePolicy method to SDK
      const result = await client.getEffectivePolicies();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const policy = result.value.find((p) => p.data.id === policyId);

      if (!policy) {
        throw ApiError.notFound('Policy');
      }

      const response: ApiResponse<unknown> = {
        success: true,
        data: policy.data,
      };
      res.json(response);
    })
  );

  // Delete (archive) policy
  router.delete(
    '/:id',
    validate({ params: IdParamSchema }),
    asyncHandler(async (req, res) => {
      const policyId = req.params['id'] as string;

      // TODO: Add archivePolicy method to SDK
      const result = await client.getEffectivePolicies();

      if (!result.ok) {
        throw ApiError.internal(result.error.message);
      }

      const policy = result.value.find((p) => p.data.id === policyId);

      if (!policy) {
        throw ApiError.notFound('Policy');
      }

      const response: ApiResponse<{ archived: boolean }> = {
        success: true,
        data: { archived: true },
      };
      res.json(response);
    })
  );

  return router;
}
