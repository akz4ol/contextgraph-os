/**
 * Decision Trace Graph
 *
 * The main graph interface for decision tracking and analysis.
 * Provides traversal, analysis, and audit capabilities.
 */

import {
  type DecisionId,
  type EntityId,
  type Result,
  ok,
  err,
} from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import { ProvenanceLedger } from '@contextgraph/provenance';
import type {
  DecisionQueryOptions,
  DecisionStatus,
  DecisionType,
  RiskLevel,
} from './types.js';
import { Decision } from './decision.js';
import { DecisionRepository } from './repository.js';

/**
 * Decision statistics
 */
export interface DecisionStats {
  readonly total: number;
  readonly byStatus: Readonly<Record<DecisionStatus, number>>;
  readonly byType: Readonly<Record<DecisionType, number>>;
  readonly byRiskLevel: Readonly<Record<RiskLevel, number>>;
}

/**
 * Decision chain - sequence of related decisions
 */
export interface DecisionChain {
  readonly decisions: readonly Decision[];
  readonly rootDecision: Decision;
  readonly length: number;
}

/**
 * Decision Trace Graph
 *
 * Manages the complete decision trace with analysis capabilities.
 */
export class DecisionTraceGraph {
  private readonly repository: DecisionRepository;
  private readonly provenance: ProvenanceLedger;

  constructor(storage: StorageInterface, provenance?: ProvenanceLedger) {
    this.provenance = provenance ?? new ProvenanceLedger(storage);
    this.repository = new DecisionRepository(storage, this.provenance);
  }

  /**
   * Initialize the graph
   */
  async initialize(): Promise<Result<void, Error>> {
    return this.provenance.initialize();
  }

  /**
   * Record a new decision
   */
  async recordDecision(input: {
    type: DecisionType;
    title: string;
    description?: string;
    proposedBy: EntityId;
    riskLevel?: RiskLevel;
  }): Promise<Result<Decision, Error>> {
    // First record provenance for the decision
    const provenanceResult = await this.provenance.record({
      sourceType: 'agent',
      sourceId: input.proposedBy,
      actor: input.proposedBy,
      action: 'create',
      metadata: {
        decisionType: input.type,
        title: input.title,
      },
    });

    if (!provenanceResult.ok) {
      return err(provenanceResult.error);
    }

    const createInput = {
      type: input.type,
      title: input.title,
      proposedBy: input.proposedBy,
      provenanceId: provenanceResult.value.data.id,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.riskLevel !== undefined ? { riskLevel: input.riskLevel } : {}),
    };

    return this.repository.create(createInput);
  }

  /**
   * Get decision by ID
   */
  async getDecision(id: DecisionId): Promise<Result<Decision | null, Error>> {
    return this.repository.findById(id);
  }

  /**
   * Query decisions
   */
  async queryDecisions(options: DecisionQueryOptions): Promise<Result<readonly Decision[], Error>> {
    return this.repository.query(options);
  }

  /**
   * Approve a decision
   */
  async approveDecision(id: DecisionId, approverId: EntityId): Promise<Result<Decision | null, Error>> {
    const result = await this.repository.approve(id, approverId);
    if (!result.ok) {
      return err(result.error);
    }

    if (!result.value.success) {
      return err(new Error(result.value.error ?? 'Approval failed'));
    }

    return this.repository.findById(id);
  }

  /**
   * Reject a decision
   */
  async rejectDecision(id: DecisionId, rejecterId: EntityId): Promise<Result<Decision | null, Error>> {
    const result = await this.repository.reject(id, rejecterId);
    if (!result.ok) {
      return err(result.error);
    }

    if (!result.value.success) {
      return err(new Error(result.value.error ?? 'Rejection failed'));
    }

    return this.repository.findById(id);
  }

  /**
   * Execute a decision
   */
  async executeDecision(
    id: DecisionId,
    outcome?: Readonly<Record<string, unknown>>
  ): Promise<Result<Decision | null, Error>> {
    const result = await this.repository.markExecuted(id, outcome);
    if (!result.ok) {
      return err(result.error);
    }

    if (!result.value.success) {
      return err(new Error(result.value.error ?? 'Execution failed'));
    }

    return this.repository.findById(id);
  }

  /**
   * Get pending decisions
   */
  async getPendingDecisions(): Promise<Result<readonly Decision[], Error>> {
    return this.repository.findPending();
  }

  /**
   * Get high-risk decisions requiring attention
   */
  async getHighRiskDecisions(): Promise<Result<readonly Decision[], Error>> {
    return this.repository.findHighRisk();
  }

  /**
   * Get decisions by proposer
   */
  async getDecisionsByProposer(proposerId: EntityId): Promise<Result<readonly Decision[], Error>> {
    return this.repository.findByProposer(proposerId);
  }

  /**
   * Get decision statistics
   */
  async getStats(): Promise<Result<DecisionStats, Error>> {
    const statuses: DecisionStatus[] = ['proposed', 'approved', 'rejected', 'executed', 'failed', 'rolled_back'];
    const types: DecisionType[] = [
      'claim_creation', 'claim_update', 'entity_creation', 'entity_update',
      'policy_change', 'workflow_step', 'external_action', 'approval_request', 'exception_request',
    ];
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    // Count by status
    for (const status of statuses) {
      const result = await this.repository.countByStatus(status);
      if (result.ok) {
        byStatus[status] = result.value;
      }
    }

    // For type and risk level, we'd need to query and aggregate
    // Simplified: query all and count locally
    const allResult = await this.repository.query({});
    if (!allResult.ok) {
      return err(allResult.error);
    }

    for (const type of types) {
      byType[type] = allResult.value.filter((d) => d.data.type === type).length;
    }

    for (const level of riskLevels) {
      byRiskLevel[level] = allResult.value.filter((d) => d.data.riskLevel === level).length;
    }

    const totalResult = await this.repository.count();
    if (!totalResult.ok) {
      return err(totalResult.error);
    }

    return ok({
      total: totalResult.value,
      byStatus: byStatus as Record<DecisionStatus, number>,
      byType: byType as Record<DecisionType, number>,
      byRiskLevel: byRiskLevel as Record<RiskLevel, number>,
    });
  }

  /**
   * Find similar precedent decisions
   */
  async findPrecedents(
    type: DecisionType,
    limit: number = 5
  ): Promise<Result<readonly Decision[], Error>> {
    // Find executed decisions of the same type
    const result = await this.repository.query({
      type,
      status: 'executed',
      limit,
    });

    return result;
  }

  /**
   * Check if a decision can be auto-approved based on precedents
   */
  async canAutoApprove(decision: Decision): Promise<Result<boolean, Error>> {
    // Don't auto-approve high risk decisions
    if (decision.requiresApproval()) {
      return ok(false);
    }

    // Don't auto-approve decisions with policy violations
    if (decision.hasPolicyViolations()) {
      return ok(false);
    }

    // Check for successful precedents
    const precedentsResult = await this.findPrecedents(decision.data.type);
    if (!precedentsResult.ok) {
      return err(precedentsResult.error);
    }

    // Need at least 3 successful precedents for auto-approval
    const successfulPrecedents = precedentsResult.value.filter(
      (d) => d.data.status === 'executed'
    );

    return ok(successfulPrecedents.length >= 3);
  }

  /**
   * Get provenance ledger (for direct access if needed)
   */
  getProvenanceLedger(): ProvenanceLedger {
    return this.provenance;
  }
}
