/**
 * API Types and Validation Schemas
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

// ============================================================================
// Entity Schemas
// ============================================================================

export const CreateEntitySchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
  aliases: z.array(z.string()).optional(),
});

export const UpdateEntitySchema = z.object({
  name: z.string().min(1).optional(),
  properties: z.record(z.unknown()).optional(),
  aliases: z.array(z.string()).optional(),
});

export const ListEntitiesQuerySchema = PaginationSchema.extend({
  type: z.string().optional(),
});

// ============================================================================
// Claim Schemas
// ============================================================================

export const CreateClaimSchema = z.object({
  predicate: z.string().min(1),
  value: z.unknown(),
  objectId: z.string().optional(),
  context: z.object({
    scope: z.string().optional(),
    jurisdiction: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().nullable().optional(),
  }).optional(),
});

export const ListClaimsQuerySchema = PaginationSchema.extend({
  predicate: z.string().optional(),
});

// ============================================================================
// Agent Schemas
// ============================================================================

export const CreateAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateAgentSchema = z.object({
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});

export const ExecuteActionSchema = z.object({
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

// ============================================================================
// Decision Schemas
// ============================================================================

export const CreateDecisionSchema = z.object({
  type: z.enum(['workflow_step', 'claim_creation', 'action', 'approval', 'rejection']),
  title: z.string().min(1),
  description: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  proposedBy: z.string().min(1),
});

export const ListDecisionsQuerySchema = PaginationSchema.extend({
  status: z.enum(['proposed', 'approved', 'rejected', 'executed', 'reverted']).optional(),
});

export const ApproveDecisionSchema = z.object({
  approverId: z.string().min(1),
  comment: z.string().optional(),
});

export const RejectDecisionSchema = z.object({
  rejecterId: z.string().min(1),
  reason: z.string().min(1),
});

// ============================================================================
// Policy Schemas
// ============================================================================

export const PolicyConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equals', 'not_equals', 'less_than', 'greater_than', 'contains', 'matches']),
  value: z.unknown(),
});

export const CreatePolicySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  effect: z.enum(['allow', 'deny']),
  subjects: z.array(z.string()),
  actions: z.array(z.string()),
  resources: z.array(z.string()),
  conditions: z.array(PolicyConditionSchema).optional(),
  priority: z.number().int().min(0).default(0),
});

export const UpdatePolicySchema = z.object({
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  priority: z.number().int().min(0).optional(),
});

// ============================================================================
// System Schemas
// ============================================================================

export const AuditQuerySchema = PaginationSchema.extend({
  action: z.string().optional(),
  agentId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export const ProvenanceQuerySchema = PaginationSchema.extend({
  sourceType: z.enum(['system', 'agent', 'human', 'external']).optional(),
  action: z.string().optional(),
});

// ============================================================================
// Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// Type Exports
// ============================================================================

export type CreateEntityInput = z.infer<typeof CreateEntitySchema>;
export type UpdateEntityInput = z.infer<typeof UpdateEntitySchema>;
export type ListEntitiesQuery = z.infer<typeof ListEntitiesQuerySchema>;

export type CreateClaimInput = z.infer<typeof CreateClaimSchema>;
export type ListClaimsQuery = z.infer<typeof ListClaimsQuerySchema>;

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type ExecuteActionInput = z.infer<typeof ExecuteActionSchema>;

export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;
export type ListDecisionsQuery = z.infer<typeof ListDecisionsQuerySchema>;
export type ApproveDecisionInput = z.infer<typeof ApproveDecisionSchema>;
export type RejectDecisionInput = z.infer<typeof RejectDecisionSchema>;

export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;
export type UpdatePolicyInput = z.infer<typeof UpdatePolicySchema>;

export type AuditQuery = z.infer<typeof AuditQuerySchema>;
export type ProvenanceQuery = z.infer<typeof ProvenanceQuerySchema>;
