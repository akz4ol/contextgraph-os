/**
 * Policy Ledger
 *
 * Manages policy storage and retrieval with versioning.
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
import type { StorageInterface } from '@contextgraph/storage';
import type {
  PolicyRecord,
  CreatePolicyInput,
  PolicyQueryOptions,
  PolicyStatus,
  EvaluationContext,
  AggregateEvaluationResult,
} from './types.js';
import { Policy } from './policy.js';
import { PolicyEvaluator } from './evaluator.js';

/**
 * Policy Ledger
 *
 * Stores and manages policies with version history.
 */
export class PolicyLedger {
  private readonly collection = 'policies';
  private readonly evaluator = new PolicyEvaluator();

  constructor(private readonly storage: StorageInterface) {}

  /**
   * Create a new policy
   */
  async create(input: CreatePolicyInput): Promise<Result<Policy, Error>> {
    // Check for existing policy with same name and version
    const existingResult = await this.findByNameAndVersion(input.name, input.version);
    if (existingResult.ok && existingResult.value !== null) {
      return err(new ValidationError(
        `Policy "${input.name}" version "${input.version}" already exists`,
        'version'
      ));
    }

    const policyResult = Policy.create(input);
    if (!policyResult.ok) {
      return policyResult;
    }

    const policy = policyResult.value;
    const insertResult = await this.storage.insert(this.collection, policy.toRecord());
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    return ok(policy);
  }

  /**
   * Get policy by ID
   */
  async findById(id: string): Promise<Result<Policy | null, Error>> {
    const result = await this.storage.findById<PolicyRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(Policy.fromRecord(result.value));
  }

  /**
   * Find policy by name and version
   */
  async findByNameAndVersion(name: string, version: string): Promise<Result<Policy | null, Error>> {
    const result = await this.storage.find<PolicyRecord>(
      this.collection,
      { name, version },
      { limit: 1 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.items.length === 0) {
      return ok(null);
    }

    return ok(Policy.fromRecord(result.value.items[0]!));
  }

  /**
   * Query policies
   */
  async query(options: PolicyQueryOptions): Promise<Result<readonly Policy[], Error>> {
    const criteria: Record<string, unknown> = {};

    if (options.status !== undefined) {
      criteria['status'] = options.status;
    }

    if (options.scope !== undefined) {
      criteria['scope'] = options.scope;
    }

    if (options.jurisdiction !== undefined) {
      criteria['jurisdiction'] = options.jurisdiction;
    }

    const queryOptions: { limit?: number; offset?: number; orderBy?: string; orderDirection?: 'asc' | 'desc' } = {
      orderBy: 'priority',
      orderDirection: 'desc',
    };

    if (options.limit !== undefined) {
      queryOptions.limit = options.limit;
    }
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<PolicyRecord>(this.collection, criteria, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    let policies = result.value.items.map((record) => Policy.fromRecord(record));

    // Filter by effective date if specified
    if (options.effectiveAt !== undefined) {
      policies = policies.filter((p) => p.isEffective(options.effectiveAt));
    }

    return ok(policies);
  }

  /**
   * Find active policies
   */
  async findActive(): Promise<Result<readonly Policy[], Error>> {
    return this.query({ status: 'active' });
  }

  /**
   * Find effective policies (active and within effective date range)
   */
  async findEffective(at?: Timestamp): Promise<Result<readonly Policy[], Error>> {
    const activeResult = await this.findActive();
    if (!activeResult.ok) {
      return activeResult;
    }

    const effectiveTime = at ?? createTimestamp();
    const effective = activeResult.value.filter((p) => p.isEffective(effectiveTime));

    return ok(effective);
  }

  /**
   * Find all versions of a policy by name
   */
  async findVersions(name: string): Promise<Result<readonly Policy[], Error>> {
    const result = await this.storage.find<PolicyRecord>(
      this.collection,
      { name },
      { orderBy: 'version', orderDirection: 'desc' }
    );

    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Policy.fromRecord(record)));
  }

  /**
   * Activate a policy
   */
  async activate(id: string): Promise<Result<Policy, Error>> {
    const policyResult = await this.findById(id);
    if (!policyResult.ok) {
      return err(policyResult.error);
    }

    if (policyResult.value === null) {
      return err(new ValidationError(`Policy not found: ${id}`, 'id'));
    }

    const activateResult = policyResult.value.activate();
    if (!activateResult.ok) {
      return activateResult;
    }

    // Note: Storage doesn't support updates, returning the activated policy
    return ok(activateResult.value);
  }

  /**
   * Deprecate a policy
   */
  async deprecate(id: string): Promise<Result<Policy, Error>> {
    const policyResult = await this.findById(id);
    if (!policyResult.ok) {
      return err(policyResult.error);
    }

    if (policyResult.value === null) {
      return err(new ValidationError(`Policy not found: ${id}`, 'id'));
    }

    const deprecateResult = policyResult.value.deprecate();
    if (!deprecateResult.ok) {
      return deprecateResult;
    }

    return ok(deprecateResult.value);
  }

  /**
   * Evaluate context against all effective policies
   */
  async evaluate(
    context: EvaluationContext,
    options?: { scope?: Scope; jurisdiction?: Jurisdiction }
  ): Promise<Result<AggregateEvaluationResult, Error>> {
    const queryOptions: PolicyQueryOptions = {
      status: 'active',
      effectiveAt: createTimestamp(),
      ...(options?.scope !== undefined ? { scope: options.scope } : {}),
      ...(options?.jurisdiction !== undefined ? { jurisdiction: options.jurisdiction } : {}),
    };

    const policiesResult = await this.query(queryOptions);
    if (!policiesResult.ok) {
      return err(policiesResult.error);
    }

    const result = this.evaluator.evaluatePolicies(policiesResult.value, context);
    return ok(result);
  }

  /**
   * Count policies by status
   */
  async countByStatus(status: PolicyStatus): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, { status });
  }

  /**
   * Get policy statistics
   */
  async getStats(): Promise<Result<{
    total: number;
    draft: number;
    active: number;
    deprecated: number;
    archived: number;
  }, Error>> {
    const statuses: PolicyStatus[] = ['draft', 'active', 'deprecated', 'archived'];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const result = await this.countByStatus(status);
      if (result.ok) {
        counts[status] = result.value;
      }
    }

    const totalResult = await this.storage.count(this.collection, {});
    if (!totalResult.ok) {
      return err(totalResult.error);
    }

    return ok({
      total: totalResult.value,
      draft: counts['draft'] ?? 0,
      active: counts['active'] ?? 0,
      deprecated: counts['deprecated'] ?? 0,
      archived: counts['archived'] ?? 0,
    });
  }
}
