/**
 * Policy Model
 *
 * Policies define rules that govern agent behavior.
 */

import {
  type Timestamp,
  type Scope,
  type Jurisdiction,
  type Result,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type {
  PolicyData,
  PolicyRecord,
  CreatePolicyInput,
  PolicyStatus,
  PolicyRule,
} from './types.js';

/**
 * Generate policy ID
 */
function createPolicyId(): string {
  return `pol_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Policy class
 */
export class Policy {
  private constructor(public readonly data: PolicyData) {}

  /**
   * Create a new policy
   */
  static create(input: CreatePolicyInput): Result<Policy, ValidationError> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Policy name is required', 'name'));
    }

    // Validate version
    if (!input.version || input.version.trim().length === 0) {
      return err(new ValidationError('Policy version is required', 'version'));
    }

    // Validate rules
    if (input.rules.length === 0) {
      return err(new ValidationError('At least one rule is required', 'rules'));
    }

    for (const rule of input.rules) {
      if (!rule.id || !rule.name) {
        return err(new ValidationError('Rules must have id and name', 'rules'));
      }
    }

    const id = createPolicyId();
    const now = createTimestamp();

    const data: PolicyData = {
      id,
      name: input.name.trim(),
      version: input.version.trim(),
      description: input.description?.trim(),
      status: 'draft',
      rules: input.rules,
      scope: input.scope,
      jurisdiction: input.jurisdiction,
      priority: input.priority ?? 0,
      effectiveFrom: input.effectiveFrom ?? now,
      effectiveTo: input.effectiveTo,
      createdAt: now,
      updatedAt: now,
    };

    return ok(new Policy(data));
  }

  /**
   * Reconstruct policy from stored record
   */
  static fromRecord(record: PolicyRecord): Policy {
    const rules = typeof record.rules === 'string'
      ? JSON.parse(record.rules) as PolicyRule[]
      : record.rules as unknown as PolicyRule[];

    return new Policy({
      id: record.id,
      name: record.name,
      version: record.version,
      description: record.description ?? undefined,
      status: record.status as PolicyStatus,
      rules,
      scope: record.scope !== null ? (record.scope as Scope) : undefined,
      jurisdiction: record.jurisdiction !== null ? (record.jurisdiction as Jurisdiction) : undefined,
      priority: record.priority,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): PolicyRecord {
    return {
      id: this.data.id,
      name: this.data.name,
      version: this.data.version,
      description: this.data.description ?? null,
      status: this.data.status,
      rules: JSON.stringify(this.data.rules),
      scope: this.data.scope ?? null,
      jurisdiction: this.data.jurisdiction ?? null,
      priority: this.data.priority,
      effectiveFrom: this.data.effectiveFrom,
      effectiveTo: this.data.effectiveTo ?? null,
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
    };
  }

  /**
   * Activate the policy
   */
  activate(): Result<Policy, ValidationError> {
    if (this.data.status !== 'draft') {
      return err(new ValidationError(`Cannot activate policy with status: ${this.data.status}`, 'status'));
    }

    return ok(new Policy({
      ...this.data,
      status: 'active',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Deprecate the policy
   */
  deprecate(): Result<Policy, ValidationError> {
    if (this.data.status !== 'active') {
      return err(new ValidationError(`Cannot deprecate policy with status: ${this.data.status}`, 'status'));
    }

    return ok(new Policy({
      ...this.data,
      status: 'deprecated',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Archive the policy
   */
  archive(): Result<Policy, ValidationError> {
    if (this.data.status === 'archived') {
      return err(new ValidationError('Policy is already archived', 'status'));
    }

    return ok(new Policy({
      ...this.data,
      status: 'archived',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Check if policy is currently effective
   */
  isEffective(at?: Timestamp): boolean {
    const checkTime = at ?? createTimestamp();

    if (this.data.status !== 'active') {
      return false;
    }

    if (checkTime < this.data.effectiveFrom) {
      return false;
    }

    if (this.data.effectiveTo !== undefined && checkTime > this.data.effectiveTo) {
      return false;
    }

    return true;
  }

  /**
   * Get rules sorted by priority
   */
  getRulesByPriority(): readonly PolicyRule[] {
    return [...this.data.rules].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Find rule by ID
   */
  findRule(ruleId: string): PolicyRule | undefined {
    return this.data.rules.find((r) => r.id === ruleId);
  }
}
