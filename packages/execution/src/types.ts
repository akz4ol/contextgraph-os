/**
 * Execution Types
 *
 * Types for agent execution framework.
 */

import type { Timestamp, EntityId, Result, DecisionId } from '@contextgraph/core';
import type { AgentId } from '@contextgraph/agent';
import type { AssembledContext } from '@contextgraph/retrieval';
import type { AggregateEvaluationResult } from '@contextgraph/policy';

/**
 * Branded type for Execution IDs
 */
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };

/**
 * Action type
 */
export type ActionType =
  | 'read'
  | 'write'
  | 'execute'
  | 'communicate'
  | 'delegate'
  | 'approve'
  | 'reject';

/**
 * Execution status
 */
export type ExecutionStatus =
  | 'pending'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

/**
 * Action definition
 */
export interface ActionDefinition {
  readonly type: ActionType;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly description?: string;
}

/**
 * Execution request
 */
export interface ExecutionRequest {
  readonly agentId: AgentId;
  readonly action: ActionDefinition;
  readonly context?: AssembledContext;
  readonly requestedBy?: EntityId;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  readonly executionId: ExecutionId;
  readonly status: ExecutionStatus;
  readonly output?: unknown;
  readonly error?: string;
  readonly decisionId?: DecisionId;
  readonly policyResult?: AggregateEvaluationResult;
  readonly startedAt: Timestamp;
  readonly completedAt?: Timestamp;
  readonly durationMs?: number;
}

/**
 * Execution data
 */
export interface ExecutionData {
  readonly id: ExecutionId;
  readonly agentId: AgentId;
  readonly action: ActionDefinition;
  readonly status: ExecutionStatus;
  readonly decisionId?: DecisionId;
  readonly policyResult?: AggregateEvaluationResult;
  readonly contextId?: string;
  readonly output?: unknown;
  readonly error?: string;
  readonly requestedBy?: EntityId;
  readonly approvedBy?: EntityId;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly startedAt?: Timestamp;
  readonly completedAt?: Timestamp;
}

/**
 * Execution record for storage
 */
export interface ExecutionRecord {
  readonly [key: string]: string | number | null | Timestamp;
  readonly id: string;
  readonly agentId: string;
  readonly action: string;
  readonly status: string;
  readonly decisionId: string | null;
  readonly policyResult: string | null;
  readonly contextId: string | null;
  readonly output: string | null;
  readonly error: string | null;
  readonly requestedBy: string | null;
  readonly approvedBy: string | null;
  readonly metadata: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly startedAt: Timestamp | null;
  readonly completedAt: Timestamp | null;
}

/**
 * Action handler function type
 */
export type ActionHandler = (
  action: ActionDefinition,
  context: ExecutionContext
) => Promise<Result<unknown, Error>>;

/**
 * Execution context provided to action handlers
 */
export interface ExecutionContext {
  readonly executionId: ExecutionId;
  readonly agentId: AgentId;
  readonly assembledContext?: AssembledContext;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Execution query options
 */
export interface ExecutionQueryOptions {
  readonly agentId?: AgentId;
  readonly status?: ExecutionStatus;
  readonly actionType?: ActionType;
  readonly from?: Timestamp;
  readonly to?: Timestamp;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  readonly executionId: ExecutionId;
  readonly approverId: EntityId;
  readonly comment?: string;
}

/**
 * Rejection request
 */
export interface RejectionRequest {
  readonly executionId: ExecutionId;
  readonly rejecterId: EntityId;
  readonly reason: string;
}
