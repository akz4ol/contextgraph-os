/**
 * Decision Repository
 *
 * Manages decision persistence with status tracking and audit logging.
 */

import {
  type DecisionId,
  type EntityId,
  type Result,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import { ProvenanceLedger } from '@contextgraph/provenance';
import type {
  DecisionRecord,
  CreateDecisionInput,
  DecisionQueryOptions,
  DecisionStatus,
  TransitionResult,
} from './types.js';
import { Decision } from './decision.js';

/**
 * Decision Repository
 *
 * Provides CRUD operations for decisions with provenance tracking.
 */
export class DecisionRepository {
  private readonly collection = 'decisions';

  constructor(
    private readonly storage: StorageInterface,
    private readonly provenance: ProvenanceLedger
  ) {}

  /**
   * Create a new decision
   */
  async create(input: CreateDecisionInput): Promise<Result<Decision, Error>> {
    const decisionResult = Decision.create(input);
    if (!decisionResult.ok) {
      return decisionResult;
    }

    const decision = decisionResult.value;

    // Record provenance for decision creation
    const provenanceResult = await this.provenance.record({
      sourceType: 'system',
      sourceId: 'dtg',
      action: 'create',
      outputRefs: [{ type: 'decision', id: decision.data.id }],
      metadata: {
        decisionType: decision.data.type,
        title: decision.data.title,
      },
    });

    if (!provenanceResult.ok) {
      return err(provenanceResult.error);
    }

    const insertResult = await this.storage.insert(this.collection, decision.toRecord());
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    return ok(decision);
  }

  /**
   * Get decision by ID
   */
  async findById(id: DecisionId): Promise<Result<Decision | null, Error>> {
    const result = await this.storage.findById<DecisionRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(Decision.fromRecord(result.value));
  }

  /**
   * Query decisions
   */
  async query(options: DecisionQueryOptions): Promise<Result<readonly Decision[], Error>> {
    const criteria: Record<string, unknown> = {};

    if (options.type !== undefined) {
      criteria['type'] = options.type;
    }

    if (options.status !== undefined) {
      criteria['status'] = options.status;
    }

    if (options.proposedBy !== undefined) {
      criteria['proposedBy'] = options.proposedBy;
    }

    if (options.riskLevel !== undefined) {
      criteria['riskLevel'] = options.riskLevel;
    }

    const queryOptions: { limit?: number; offset?: number; orderBy?: string; orderDirection?: 'asc' | 'desc' } = {
      orderBy: 'createdAt',
      orderDirection: 'desc',
    };

    if (options.limit !== undefined) {
      queryOptions.limit = options.limit;
    }
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<DecisionRecord>(this.collection, criteria, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    let decisions = result.value.items.map((record) => Decision.fromRecord(record));

    // Apply time range filter (post-filter on proposedAt)
    if (options.timeRange !== undefined) {
      const { start, end } = options.timeRange;
      decisions = decisions.filter((d) => {
        const ts = d.data.proposedAt;
        return ts >= start && ts <= end;
      });
    }

    return ok(decisions);
  }

  /**
   * Find decisions by status
   */
  async findByStatus(status: DecisionStatus): Promise<Result<readonly Decision[], Error>> {
    return this.query({ status });
  }

  /**
   * Find decisions by proposer
   */
  async findByProposer(proposedBy: EntityId): Promise<Result<readonly Decision[], Error>> {
    return this.query({ proposedBy });
  }

  /**
   * Find pending decisions (proposed but not yet approved/rejected)
   */
  async findPending(): Promise<Result<readonly Decision[], Error>> {
    return this.query({ status: 'proposed' });
  }

  /**
   * Find high-risk decisions requiring attention
   */
  async findHighRisk(): Promise<Result<readonly Decision[], Error>> {
    const highResult = await this.query({ riskLevel: 'high', status: 'proposed' });
    if (!highResult.ok) return highResult;

    const criticalResult = await this.query({ riskLevel: 'critical', status: 'proposed' });
    if (!criticalResult.ok) return criticalResult;

    return ok([...highResult.value, ...criticalResult.value]);
  }

  /**
   * Update decision status
   */
  async updateStatus(
    id: DecisionId,
    newStatus: DecisionStatus,
    actorId?: EntityId,
    outcome?: Readonly<Record<string, unknown>>
  ): Promise<Result<TransitionResult, Error>> {
    const decisionResult = await this.findById(id);
    if (!decisionResult.ok) {
      return err(decisionResult.error);
    }

    if (decisionResult.value === null) {
      return err(new ValidationError(`Decision not found: ${id}`, 'id'));
    }

    const decision = decisionResult.value;
    const previousStatus = decision.data.status;

    const transitionResult = decision.transitionTo(newStatus, actorId, outcome);
    if (!transitionResult.ok) {
      return ok({
        success: false,
        previousStatus,
        newStatus,
        error: transitionResult.error.message,
      });
    }

    const updatedDecision = transitionResult.value;

    // Record provenance for status change
    const provenanceInput = {
      sourceType: actorId !== undefined ? 'human' as const : 'system' as const,
      sourceId: actorId ?? 'dtg',
      action: newStatus === 'approved' ? 'approve' as const : newStatus === 'rejected' ? 'reject' as const : 'execute' as const,
      inputRefs: [{ type: 'decision' as const, id }],
      metadata: {
        previousStatus,
        newStatus,
        outcome,
      },
      ...(actorId !== undefined ? { actor: actorId } : {}),
    };
    const provenanceResult = await this.provenance.record(provenanceInput);

    if (!provenanceResult.ok) {
      return err(provenanceResult.error);
    }

    // Update the record in storage
    // Note: In a real implementation, we'd use an update method
    // For now, we'll delete and re-insert (since storage doesn't have update)
    const deleteResult = await this.storage.find<DecisionRecord>(this.collection, { id });
    if (!deleteResult.ok) {
      return err(deleteResult.error);
    }

    // Use upsert to update the decision in storage
    const record = updatedDecision.toRecord();
    const upsertResult = await this.storage.upsert(this.collection, record);
    if (!upsertResult.ok) {
      return err(upsertResult.error);
    }

    return ok({
      success: true,
      previousStatus,
      newStatus,
      error: undefined,
    });
  }

  /**
   * Approve a decision
   */
  async approve(id: DecisionId, approverId: EntityId): Promise<Result<TransitionResult, Error>> {
    return this.updateStatus(id, 'approved', approverId);
  }

  /**
   * Reject a decision
   */
  async reject(id: DecisionId, rejecterId: EntityId): Promise<Result<TransitionResult, Error>> {
    return this.updateStatus(id, 'rejected', rejecterId);
  }

  /**
   * Mark decision as executed
   */
  async markExecuted(
    id: DecisionId,
    outcome?: Readonly<Record<string, unknown>>
  ): Promise<Result<TransitionResult, Error>> {
    return this.updateStatus(id, 'executed', undefined, outcome);
  }

  /**
   * Mark decision as failed
   */
  async markFailed(
    id: DecisionId,
    outcome?: Readonly<Record<string, unknown>>
  ): Promise<Result<TransitionResult, Error>> {
    return this.updateStatus(id, 'failed', undefined, outcome);
  }

  /**
   * Count decisions by status
   */
  async countByStatus(status: DecisionStatus): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, { status });
  }

  /**
   * Count all decisions
   */
  async count(): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, {});
  }
}
