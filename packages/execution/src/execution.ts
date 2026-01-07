/**
 * Execution Model
 *
 * Represents an agent action execution with lifecycle management.
 */

import {
  type EntityId,
  type DecisionId,
  type Result,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type { AgentId } from '@contextgraph/agent';
import type { AggregateEvaluationResult } from '@contextgraph/policy';
import type {
  ExecutionId,
  ExecutionData,
  ExecutionRecord,
  ExecutionStatus,
  ActionDefinition,
} from './types.js';

/**
 * Generate execution ID
 */
function createExecutionId(): ExecutionId {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as ExecutionId;
}

/**
 * Execution class
 *
 * Represents an agent action execution.
 */
export class Execution {
  private constructor(public readonly data: ExecutionData) {}

  /**
   * Create a new execution
   */
  static create(input: {
    agentId: AgentId;
    action: ActionDefinition;
    contextId?: string;
    requestedBy?: EntityId;
    metadata?: Readonly<Record<string, unknown>>;
  }): Result<Execution, ValidationError> {
    // Validate action
    if (!input.action.type) {
      return err(new ValidationError('Action type is required', 'action'));
    }

    if (!input.action.resourceType) {
      return err(new ValidationError('Resource type is required', 'action'));
    }

    const id = createExecutionId();
    const now = createTimestamp();

    const data: ExecutionData = {
      id,
      agentId: input.agentId,
      action: input.action,
      status: 'pending',
      ...(input.contextId !== undefined ? { contextId: input.contextId } : {}),
      ...(input.requestedBy !== undefined ? { requestedBy: input.requestedBy } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      createdAt: now,
      updatedAt: now,
    };

    return ok(new Execution(data));
  }

  /**
   * Reconstruct execution from stored record
   */
  static fromRecord(record: ExecutionRecord): Execution {
    const action = JSON.parse(record.action) as ActionDefinition;
    const policyResult = record.policyResult !== null
      ? JSON.parse(record.policyResult) as AggregateEvaluationResult
      : undefined;
    const output = record.output !== null
      ? JSON.parse(record.output)
      : undefined;
    const metadata = record.metadata !== null
      ? JSON.parse(record.metadata) as Record<string, unknown>
      : undefined;

    return new Execution({
      id: record.id as ExecutionId,
      agentId: record.agentId as AgentId,
      action,
      status: record.status as ExecutionStatus,
      ...(record.decisionId !== null ? { decisionId: record.decisionId as DecisionId } : {}),
      ...(policyResult !== undefined ? { policyResult } : {}),
      ...(record.contextId !== null ? { contextId: record.contextId } : {}),
      ...(output !== undefined ? { output } : {}),
      ...(record.error !== null ? { error: record.error } : {}),
      ...(record.requestedBy !== null ? { requestedBy: record.requestedBy as EntityId } : {}),
      ...(record.approvedBy !== null ? { approvedBy: record.approvedBy as EntityId } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.startedAt !== null ? { startedAt: record.startedAt } : {}),
      ...(record.completedAt !== null ? { completedAt: record.completedAt } : {}),
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): ExecutionRecord {
    return {
      id: this.data.id,
      agentId: this.data.agentId,
      action: JSON.stringify(this.data.action),
      status: this.data.status,
      decisionId: this.data.decisionId ?? null,
      policyResult: this.data.policyResult !== undefined ? JSON.stringify(this.data.policyResult) : null,
      contextId: this.data.contextId ?? null,
      output: this.data.output !== undefined ? JSON.stringify(this.data.output) : null,
      error: this.data.error ?? null,
      requestedBy: this.data.requestedBy ?? null,
      approvedBy: this.data.approvedBy ?? null,
      metadata: this.data.metadata !== undefined ? JSON.stringify(this.data.metadata) : null,
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
      startedAt: this.data.startedAt ?? null,
      completedAt: this.data.completedAt ?? null,
    };
  }

  /**
   * Set policy evaluation result
   */
  setPolicyResult(result: AggregateEvaluationResult): Result<Execution, ValidationError> {
    if (this.data.status !== 'pending') {
      return err(new ValidationError(`Cannot set policy result in ${this.data.status} state`, 'status'));
    }

    return ok(new Execution({
      ...this.data,
      policyResult: result,
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Approve the execution
   */
  approve(approverId: EntityId): Result<Execution, ValidationError> {
    if (this.data.status !== 'pending') {
      return err(new ValidationError(`Cannot approve execution in ${this.data.status} state`, 'status'));
    }

    return ok(new Execution({
      ...this.data,
      status: 'approved',
      approvedBy: approverId,
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Start execution
   */
  start(decisionId?: DecisionId): Result<Execution, ValidationError> {
    if (this.data.status !== 'pending' && this.data.status !== 'approved') {
      return err(new ValidationError(`Cannot start execution in ${this.data.status} state`, 'status'));
    }

    const now = createTimestamp();
    return ok(new Execution({
      ...this.data,
      status: 'executing',
      ...(decisionId !== undefined ? { decisionId } : {}),
      startedAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Complete execution successfully
   */
  complete(output?: unknown): Result<Execution, ValidationError> {
    if (this.data.status !== 'executing') {
      return err(new ValidationError(`Cannot complete execution in ${this.data.status} state`, 'status'));
    }

    const now = createTimestamp();

    return ok(new Execution({
      ...this.data,
      status: 'completed',
      ...(output !== undefined ? { output } : {}),
      completedAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Fail execution
   */
  fail(error: string): Result<Execution, ValidationError> {
    if (this.data.status !== 'executing') {
      return err(new ValidationError(`Cannot fail execution in ${this.data.status} state`, 'status'));
    }

    const now = createTimestamp();
    return ok(new Execution({
      ...this.data,
      status: 'failed',
      error,
      completedAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Reject execution
   */
  reject(reason: string): Result<Execution, ValidationError> {
    if (this.data.status !== 'pending') {
      return err(new ValidationError(`Cannot reject execution in ${this.data.status} state`, 'status'));
    }

    return ok(new Execution({
      ...this.data,
      status: 'rejected',
      error: reason,
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Cancel execution
   */
  cancel(): Result<Execution, ValidationError> {
    if (this.data.status === 'completed' || this.data.status === 'failed') {
      return err(new ValidationError(`Cannot cancel ${this.data.status} execution`, 'status'));
    }

    return ok(new Execution({
      ...this.data,
      status: 'cancelled',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Check if execution is terminal
   */
  isTerminal(): boolean {
    return ['completed', 'failed', 'rejected', 'cancelled'].includes(this.data.status);
  }

  /**
   * Check if execution requires approval
   */
  requiresApproval(): boolean {
    return this.data.policyResult?.finalDecision === 'require_approval';
  }

  /**
   * Check if execution is allowed
   */
  isAllowed(): boolean {
    if (this.data.policyResult === undefined) {
      return true; // No policy evaluated
    }
    return this.data.policyResult.finalDecision === 'allow';
  }

  /**
   * Check if execution is denied
   */
  isDenied(): boolean {
    return this.data.policyResult?.finalDecision === 'deny';
  }

  /**
   * Get execution duration in milliseconds
   */
  getDurationMs(): number | undefined {
    if (this.data.startedAt === undefined || this.data.completedAt === undefined) {
      return undefined;
    }
    return this.data.completedAt - this.data.startedAt;
  }
}
