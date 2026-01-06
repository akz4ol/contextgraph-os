/**
 * Decision Model
 *
 * Decisions are immutable records of proposed, approved, and executed actions.
 * They form a complete audit trail of all agent decisions.
 */

import {
  type DecisionId,
  type EntityId,
  type ProvenanceId,
  type Result,
  createDecisionId,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type {
  DecisionData,
  DecisionRecord,
  CreateDecisionInput,
  DecisionStatus,
  DecisionType,
  RiskLevel,
  ClaimRef,
  PrecedentRef,
  PolicyRef,
} from './types.js';

/**
 * Valid decision types
 */
const VALID_DECISION_TYPES: readonly DecisionType[] = [
  'claim_creation',
  'claim_update',
  'entity_creation',
  'entity_update',
  'policy_change',
  'workflow_step',
  'external_action',
  'approval_request',
  'exception_request',
];

/**
 * Valid risk levels
 */
const VALID_RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'];

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: ReadonlyMap<DecisionStatus, readonly DecisionStatus[]> = new Map([
  ['proposed', ['approved', 'rejected']],
  ['approved', ['executed', 'failed', 'rejected']],
  ['rejected', []], // Terminal state
  ['executed', ['rolled_back']],
  ['failed', ['proposed']], // Can retry
  ['rolled_back', []], // Terminal state
]);

/**
 * Decision class
 *
 * Represents a single decision in the trace graph.
 * Decisions are immutable - state changes create new records in the ledger.
 */
export class Decision {
  private constructor(public readonly data: DecisionData) {}

  /**
   * Create a new decision (always starts as 'proposed')
   */
  static create(input: CreateDecisionInput): Result<Decision, ValidationError> {
    // Validate decision type
    if (!VALID_DECISION_TYPES.includes(input.type)) {
      return err(new ValidationError(`Invalid decision type: ${input.type}`, 'type'));
    }

    // Validate title
    if (!input.title || input.title.trim().length === 0) {
      return err(new ValidationError('Decision title is required', 'title'));
    }

    // Validate risk level if provided
    const riskLevel = input.riskLevel ?? 'medium';
    if (!VALID_RISK_LEVELS.includes(riskLevel)) {
      return err(new ValidationError(`Invalid risk level: ${riskLevel}`, 'riskLevel'));
    }

    const id = createDecisionId();
    const createdAt = createTimestamp();
    const proposedAt = createTimestamp();

    const data: DecisionData = {
      id,
      type: input.type,
      status: 'proposed',
      title: input.title.trim(),
      description: input.description?.trim(),
      claimRefs: input.claimRefs ?? [],
      precedentRefs: input.precedentRefs ?? [],
      policyRefs: input.policyRefs ?? [],
      riskLevel,
      proposedBy: input.proposedBy,
      proposedAt,
      approvedBy: undefined,
      approvedAt: undefined,
      executedAt: undefined,
      outcome: undefined,
      provenanceId: input.provenanceId,
      createdAt,
    };

    return ok(new Decision(data));
  }

  /**
   * Reconstruct decision from stored record
   */
  static fromRecord(record: DecisionRecord): Decision {
    const claimRefs = record.claimRefs !== null
      ? (typeof record.claimRefs === 'string'
          ? JSON.parse(record.claimRefs) as ClaimRef[]
          : record.claimRefs as unknown as ClaimRef[])
      : [];

    const precedentRefs = record.precedentRefs !== null
      ? (typeof record.precedentRefs === 'string'
          ? JSON.parse(record.precedentRefs) as PrecedentRef[]
          : record.precedentRefs as unknown as PrecedentRef[])
      : [];

    const policyRefs = record.policyRefs !== null
      ? (typeof record.policyRefs === 'string'
          ? JSON.parse(record.policyRefs) as PolicyRef[]
          : record.policyRefs as unknown as PolicyRef[])
      : [];

    const outcome = record.outcome !== null
      ? (typeof record.outcome === 'string'
          ? JSON.parse(record.outcome) as Record<string, unknown>
          : record.outcome as Record<string, unknown>)
      : undefined;

    return new Decision({
      id: record.id as DecisionId,
      type: record.type as DecisionType,
      status: record.status as DecisionStatus,
      title: record.title,
      description: record.description ?? undefined,
      claimRefs,
      precedentRefs,
      policyRefs,
      riskLevel: record.riskLevel as RiskLevel,
      proposedBy: record.proposedBy as EntityId,
      proposedAt: record.proposedAt,
      approvedBy: record.approvedBy !== null ? (record.approvedBy as EntityId) : undefined,
      approvedAt: record.approvedAt ?? undefined,
      executedAt: record.executedAt ?? undefined,
      outcome,
      provenanceId: record.provenanceId as ProvenanceId,
      createdAt: record.createdAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): DecisionRecord {
    return {
      id: this.data.id,
      type: this.data.type,
      status: this.data.status,
      title: this.data.title,
      description: this.data.description ?? null,
      claimRefs: this.data.claimRefs.length > 0 ? JSON.stringify(this.data.claimRefs) : null,
      precedentRefs: this.data.precedentRefs.length > 0 ? JSON.stringify(this.data.precedentRefs) : null,
      policyRefs: this.data.policyRefs.length > 0 ? JSON.stringify(this.data.policyRefs) : null,
      riskLevel: this.data.riskLevel,
      proposedBy: this.data.proposedBy,
      proposedAt: this.data.proposedAt,
      approvedBy: this.data.approvedBy ?? null,
      approvedAt: this.data.approvedAt ?? null,
      executedAt: this.data.executedAt ?? null,
      outcome: this.data.outcome !== undefined ? JSON.stringify(this.data.outcome) : null,
      provenanceId: this.data.provenanceId,
      createdAt: this.data.createdAt,
    };
  }

  /**
   * Check if a status transition is valid
   */
  canTransitionTo(newStatus: DecisionStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS.get(this.data.status);
    return allowedTransitions?.includes(newStatus) ?? false;
  }

  /**
   * Create a new decision with updated status (immutable update)
   */
  transitionTo(
    newStatus: DecisionStatus,
    actorId?: EntityId,
    outcome?: Readonly<Record<string, unknown>>
  ): Result<Decision, ValidationError> {
    if (!this.canTransitionTo(newStatus)) {
      return err(
        new ValidationError(
          `Invalid transition from ${this.data.status} to ${newStatus}`,
          'status'
        )
      );
    }

    const now = createTimestamp();
    let updates: Partial<DecisionData> = { status: newStatus };

    // Set additional fields based on transition
    if (newStatus === 'approved') {
      updates = {
        ...updates,
        approvedBy: actorId,
        approvedAt: now,
      };
    } else if (newStatus === 'executed') {
      updates = {
        ...updates,
        executedAt: now,
        outcome,
      };
    } else if (newStatus === 'failed') {
      updates = {
        ...updates,
        executedAt: now,
        outcome,
      };
    }

    const newData: DecisionData = {
      ...this.data,
      ...updates,
    };

    return ok(new Decision(newData));
  }

  /**
   * Check if decision requires approval based on risk level
   */
  requiresApproval(): boolean {
    return this.data.riskLevel === 'high' || this.data.riskLevel === 'critical';
  }

  /**
   * Check if decision has policy violations
   */
  hasPolicyViolations(): boolean {
    return this.data.policyRefs.some(
      (ref) => ref.violatedRequirements.length > 0
    );
  }

  /**
   * Get all policy violations
   */
  getPolicyViolations(): readonly { policyId: string; violations: readonly string[] }[] {
    return this.data.policyRefs
      .filter((ref) => ref.violatedRequirements.length > 0)
      .map((ref) => ({
        policyId: ref.id,
        violations: ref.violatedRequirements,
      }));
  }
}

/**
 * Check if a transition is valid between two statuses
 */
export function isValidTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS.get(from);
  return allowedTransitions?.includes(to) ?? false;
}

/**
 * Get all valid transitions from a given status
 */
export function getValidTransitions(status: DecisionStatus): readonly DecisionStatus[] {
  return VALID_TRANSITIONS.get(status) ?? [];
}
