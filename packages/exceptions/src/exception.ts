/**
 * Exception Model
 *
 * Exceptions are requests to override policy constraints.
 * They require approval workflows based on risk level.
 */

import {
  type DecisionId,
  type ProvenanceId,
  type EntityId,
  type Result,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import {
  type ExceptionData,
  type ExceptionRecord,
  type CreateExceptionInput,
  type ExceptionStatus,
  type ExceptionRiskLevel,
  type PolicyReference,
  type ApproverRecord,
  APPROVAL_REQUIREMENTS,
} from './types.js';

/**
 * Valid risk levels
 */
const VALID_RISK_LEVELS: readonly ExceptionRiskLevel[] = ['low', 'medium', 'high', 'critical'];

/**
 * Generate exception ID
 */
function createExceptionId(): string {
  return `exc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Exception class
 *
 * Represents a policy exception request with approval workflow.
 */
export class Exception {
  private constructor(public readonly data: ExceptionData) {}

  /**
   * Create a new exception request
   */
  static create(input: CreateExceptionInput): Result<Exception, ValidationError> {
    // Validate policy refs
    if (input.policyRefs.length === 0) {
      return err(new ValidationError('At least one policy reference is required', 'policyRefs'));
    }

    for (const ref of input.policyRefs) {
      if (!ref.policyId || !ref.policyVersion) {
        return err(new ValidationError('Invalid policy reference', 'policyRefs'));
      }
    }

    // Validate justification
    if (!input.justification || input.justification.trim().length < 10) {
      return err(new ValidationError('Justification must be at least 10 characters', 'justification'));
    }

    // Validate risk level
    const riskLevel = input.riskLevel ?? 'medium';
    if (!VALID_RISK_LEVELS.includes(riskLevel)) {
      return err(new ValidationError(`Invalid risk level: ${riskLevel}`, 'riskLevel'));
    }

    const id = createExceptionId();
    const now = createTimestamp();

    const data: ExceptionData = {
      id,
      decisionId: input.decisionId,
      policyRefs: input.policyRefs,
      justification: input.justification.trim(),
      riskLevel,
      status: 'pending',
      requestedBy: input.requestedBy,
      requestedAt: now,
      approvers: [],
      approvedAt: undefined,
      expiresAt: input.expiresAt,
      provenanceId: input.provenanceId,
      createdAt: now,
    };

    return ok(new Exception(data));
  }

  /**
   * Reconstruct exception from stored record
   */
  static fromRecord(record: ExceptionRecord): Exception {
    const policyRefs = typeof record.policyRefs === 'string'
      ? JSON.parse(record.policyRefs) as PolicyReference[]
      : record.policyRefs as unknown as PolicyReference[];

    const approvers = record.approvers !== null
      ? (typeof record.approvers === 'string'
          ? JSON.parse(record.approvers) as ApproverRecord[]
          : record.approvers as unknown as ApproverRecord[])
      : [];

    return new Exception({
      id: record.id,
      decisionId: record.decisionId as DecisionId,
      policyRefs,
      justification: record.justification,
      riskLevel: record.riskLevel as ExceptionRiskLevel,
      status: record.status as ExceptionStatus,
      requestedBy: record.requestedBy as EntityId,
      requestedAt: record.requestedAt,
      approvers,
      approvedAt: record.approvedAt ?? undefined,
      expiresAt: record.expiresAt ?? undefined,
      provenanceId: record.provenanceId as ProvenanceId,
      createdAt: record.createdAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): ExceptionRecord {
    return {
      id: this.data.id,
      decisionId: this.data.decisionId,
      policyRefs: JSON.stringify(this.data.policyRefs),
      justification: this.data.justification,
      riskLevel: this.data.riskLevel,
      status: this.data.status,
      requestedBy: this.data.requestedBy,
      requestedAt: this.data.requestedAt,
      approvers: this.data.approvers.length > 0 ? JSON.stringify(this.data.approvers) : null,
      approvedAt: this.data.approvedAt ?? null,
      expiresAt: this.data.expiresAt ?? null,
      provenanceId: this.data.provenanceId,
      createdAt: this.data.createdAt,
    };
  }

  /**
   * Get approval requirements for this exception
   */
  getApprovalRequirements() {
    return APPROVAL_REQUIREMENTS[this.data.riskLevel];
  }

  /**
   * Check if exception has enough approvals
   */
  hasEnoughApprovals(): boolean {
    const requirements = this.getApprovalRequirements();
    return this.data.approvers.length >= requirements.minApprovers;
  }

  /**
   * Check if exception is expired
   */
  isExpired(): boolean {
    if (this.data.expiresAt === undefined) {
      return false;
    }
    return createTimestamp() > this.data.expiresAt;
  }

  /**
   * Check if exception is active (approved and not expired)
   */
  isActive(): boolean {
    return this.data.status === 'approved' && !this.isExpired();
  }

  /**
   * Add an approval
   */
  addApproval(approverId: EntityId, comment?: string): Result<Exception, ValidationError> {
    if (this.data.status !== 'pending') {
      return err(new ValidationError(`Cannot approve exception with status: ${this.data.status}`, 'status'));
    }

    // Check if already approved by this person
    if (this.data.approvers.some((a) => a.approverId === approverId)) {
      return err(new ValidationError('Approver has already approved this exception', 'approverId'));
    }

    const now = createTimestamp();
    const newApprover: ApproverRecord = {
      approverId,
      approvedAt: now,
      comment,
    };

    const newApprovers = [...this.data.approvers, newApprover];
    const requirements = this.getApprovalRequirements();
    const isFullyApproved = newApprovers.length >= requirements.minApprovers;

    const newData: ExceptionData = {
      ...this.data,
      approvers: newApprovers,
      status: isFullyApproved ? 'approved' : 'pending',
      approvedAt: isFullyApproved ? now : undefined,
    };

    return ok(new Exception(newData));
  }

  /**
   * Reject the exception
   */
  reject(): Result<Exception, ValidationError> {
    if (this.data.status !== 'pending') {
      return err(new ValidationError(`Cannot reject exception with status: ${this.data.status}`, 'status'));
    }

    const newData: ExceptionData = {
      ...this.data,
      status: 'rejected',
    };

    return ok(new Exception(newData));
  }

  /**
   * Revoke an approved exception
   */
  revoke(): Result<Exception, ValidationError> {
    if (this.data.status !== 'approved') {
      return err(new ValidationError(`Cannot revoke exception with status: ${this.data.status}`, 'status'));
    }

    const newData: ExceptionData = {
      ...this.data,
      status: 'revoked',
    };

    return ok(new Exception(newData));
  }

  /**
   * Mark as expired
   */
  markExpired(): Result<Exception, ValidationError> {
    if (this.data.status !== 'approved') {
      return err(new ValidationError(`Cannot expire exception with status: ${this.data.status}`, 'status'));
    }

    const newData: ExceptionData = {
      ...this.data,
      status: 'expired',
    };

    return ok(new Exception(newData));
  }
}
