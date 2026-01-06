/**
 * Exception Types
 *
 * Types for managing policy exceptions and overrides.
 * Exceptions allow controlled deviation from policies with proper justification.
 */

import { type DecisionId, type ProvenanceId, type EntityId, type Timestamp } from '@contextgraph/core';

/**
 * Exception status enumeration
 */
export type ExceptionStatus =
  | 'pending'      // Awaiting approval
  | 'approved'     // Exception granted
  | 'rejected'     // Exception denied
  | 'expired'      // Exception time limit reached
  | 'revoked';     // Exception manually revoked

/**
 * Risk level for exceptions
 */
export type ExceptionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Policy reference for exception
 */
export interface PolicyReference {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly violatedRules: readonly string[];
}

/**
 * Approval requirement based on risk level
 */
export interface ApprovalRequirement {
  readonly minApprovers: number;
  readonly requiredRoles: readonly string[];
  readonly escalationTimeoutMs: number;
}

/**
 * Approver record
 */
export interface ApproverRecord {
  readonly approverId: EntityId;
  readonly approvedAt: Timestamp;
  readonly comment: string | undefined;
}

/**
 * Exception data structure
 */
export interface ExceptionData {
  readonly id: string;
  /** Decision this exception is for */
  readonly decisionId: DecisionId;
  /** Policies being overridden */
  readonly policyRefs: readonly PolicyReference[];
  /** Justification for the exception */
  readonly justification: string;
  /** Risk assessment */
  readonly riskLevel: ExceptionRiskLevel;
  /** Current status */
  readonly status: ExceptionStatus;
  /** Who requested the exception */
  readonly requestedBy: EntityId;
  /** When the exception was requested */
  readonly requestedAt: Timestamp;
  /** Approvers who have approved */
  readonly approvers: readonly ApproverRecord[];
  /** When the exception was fully approved */
  readonly approvedAt: Timestamp | undefined;
  /** When the exception expires (null = no expiry) */
  readonly expiresAt: Timestamp | undefined;
  /** Provenance reference */
  readonly provenanceId: ProvenanceId;
  /** When the record was created */
  readonly createdAt: Timestamp;
}

/**
 * Exception storage record format
 */
export interface ExceptionRecord {
  readonly id: string;
  readonly decisionId: string;
  readonly policyRefs: string;
  readonly justification: string;
  readonly riskLevel: string;
  readonly status: string;
  readonly requestedBy: string;
  readonly requestedAt: Timestamp;
  readonly approvers: string | null;
  readonly approvedAt: Timestamp | null;
  readonly expiresAt: Timestamp | null;
  readonly provenanceId: string;
  readonly createdAt: Timestamp;
  [key: string]: unknown;
}

/**
 * Input for creating a new exception request
 */
export interface CreateExceptionInput {
  readonly decisionId: DecisionId;
  readonly policyRefs: readonly PolicyReference[];
  readonly justification: string;
  readonly riskLevel?: ExceptionRiskLevel;
  readonly requestedBy: EntityId;
  readonly expiresAt?: Timestamp;
  readonly provenanceId: ProvenanceId;
}

/**
 * Exception query options
 */
export interface ExceptionQueryOptions {
  readonly status?: ExceptionStatus;
  readonly riskLevel?: ExceptionRiskLevel;
  readonly requestedBy?: EntityId;
  readonly decisionId?: DecisionId;
  readonly includeExpired?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Approval requirements by risk level
 */
export const APPROVAL_REQUIREMENTS: Readonly<Record<ExceptionRiskLevel, ApprovalRequirement>> = {
  low: {
    minApprovers: 1,
    requiredRoles: ['approver'],
    escalationTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  medium: {
    minApprovers: 1,
    requiredRoles: ['senior_approver', 'manager'],
    escalationTimeoutMs: 12 * 60 * 60 * 1000, // 12 hours
  },
  high: {
    minApprovers: 2,
    requiredRoles: ['senior_approver', 'manager', 'director'],
    escalationTimeoutMs: 4 * 60 * 60 * 1000, // 4 hours
  },
  critical: {
    minApprovers: 3,
    requiredRoles: ['director', 'executive'],
    escalationTimeoutMs: 1 * 60 * 60 * 1000, // 1 hour
  },
};
