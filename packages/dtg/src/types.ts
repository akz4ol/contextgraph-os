/**
 * Decision Trace Graph Types
 *
 * Defines types for tracking decisions as structured data.
 * Decisions are the atomic units of agent actions with full audit trails.
 */

import { type DecisionId, type ProvenanceId, type EntityId, type ClaimId, type Timestamp } from '@contextgraph/core';

/**
 * Decision status enumeration
 */
export type DecisionStatus =
  | 'proposed'     // Decision has been proposed but not approved
  | 'approved'     // Decision has been approved for execution
  | 'rejected'     // Decision was rejected
  | 'executed'     // Decision has been executed
  | 'failed'       // Decision execution failed
  | 'rolled_back'; // Decision was rolled back

/**
 * Decision type enumeration
 */
export type DecisionType =
  | 'claim_creation'
  | 'claim_update'
  | 'entity_creation'
  | 'entity_update'
  | 'policy_change'
  | 'workflow_step'
  | 'external_action'
  | 'approval_request'
  | 'exception_request';

/**
 * Risk level for decisions
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Reference to a claim
 */
export interface ClaimRef {
  readonly id: ClaimId;
  readonly role: 'input' | 'output' | 'supporting' | 'conflicting';
}

/**
 * Reference to a policy
 */
export interface PolicyRef {
  readonly id: string;
  readonly version: string;
  readonly applicable: boolean;
  readonly satisfiedRequirements: readonly string[];
  readonly violatedRequirements: readonly string[];
}

/**
 * Reference to a precedent decision
 */
export interface PrecedentRef {
  readonly decisionId: DecisionId;
  readonly similarity: number; // 0-1 relevance score
  readonly outcome: 'success' | 'failure';
}

/**
 * Decision data structure
 */
export interface DecisionData {
  readonly id: DecisionId;
  /** Type of decision */
  readonly type: DecisionType;
  /** Current status */
  readonly status: DecisionStatus;
  /** Human-readable title */
  readonly title: string;
  /** Detailed description */
  readonly description: string | undefined;
  /** Claims referenced by this decision */
  readonly claimRefs: readonly ClaimRef[];
  /** Precedent decisions referenced */
  readonly precedentRefs: readonly PrecedentRef[];
  /** Policies applicable to this decision */
  readonly policyRefs: readonly PolicyRef[];
  /** Risk assessment */
  readonly riskLevel: RiskLevel;
  /** Entity or agent that proposed the decision */
  readonly proposedBy: EntityId;
  /** When the decision was proposed */
  readonly proposedAt: Timestamp;
  /** Entity or agent that approved the decision */
  readonly approvedBy: EntityId | undefined;
  /** When the decision was approved */
  readonly approvedAt: Timestamp | undefined;
  /** When the decision was executed */
  readonly executedAt: Timestamp | undefined;
  /** Outcome of the decision execution */
  readonly outcome: Readonly<Record<string, unknown>> | undefined;
  /** Provenance reference */
  readonly provenanceId: ProvenanceId;
  /** When the record was created */
  readonly createdAt: Timestamp;
}

/**
 * Decision storage record format
 */
export interface DecisionRecord {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly title: string;
  readonly description: string | null;
  readonly claimRefs: string | null;
  readonly precedentRefs: string | null;
  readonly policyRefs: string | null;
  readonly riskLevel: string;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
  readonly approvedBy: string | null;
  readonly approvedAt: Timestamp | null;
  readonly executedAt: Timestamp | null;
  readonly outcome: string | null;
  readonly provenanceId: string;
  readonly createdAt: Timestamp;
  [key: string]: unknown;
}

/**
 * Input for creating a new decision
 */
export interface CreateDecisionInput {
  readonly type: DecisionType;
  readonly title: string;
  readonly description?: string;
  readonly claimRefs?: readonly ClaimRef[];
  readonly precedentRefs?: readonly PrecedentRef[];
  readonly policyRefs?: readonly PolicyRef[];
  readonly riskLevel?: RiskLevel;
  readonly proposedBy: EntityId;
  readonly provenanceId: ProvenanceId;
}

/**
 * Decision query options
 */
export interface DecisionQueryOptions {
  readonly type?: DecisionType;
  readonly status?: DecisionStatus;
  readonly proposedBy?: EntityId;
  readonly riskLevel?: RiskLevel;
  readonly timeRange?: {
    readonly start: Timestamp;
    readonly end: Timestamp;
  };
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Decision transition result
 */
export interface TransitionResult {
  readonly success: boolean;
  readonly previousStatus: DecisionStatus;
  readonly newStatus: DecisionStatus;
  readonly error: string | undefined;
}
