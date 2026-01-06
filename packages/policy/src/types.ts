/**
 * Policy Types
 *
 * Types for defining and managing policies and rights.
 */

import { type Timestamp, type Scope, type Jurisdiction } from '@contextgraph/core';

/**
 * Policy status
 */
export type PolicyStatus = 'draft' | 'active' | 'deprecated' | 'archived';

/**
 * Rule effect
 */
export type RuleEffect = 'allow' | 'deny' | 'require_approval';

/**
 * Condition operator
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'matches'
  | 'exists';

/**
 * Condition for rule evaluation
 */
export interface RuleCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: unknown;
}

/**
 * Policy rule
 */
export interface PolicyRule {
  readonly id: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly effect: RuleEffect;
  readonly conditions: readonly RuleCondition[];
  readonly priority: number;
}

/**
 * Policy data structure
 */
export interface PolicyData {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string | undefined;
  readonly status: PolicyStatus;
  readonly rules: readonly PolicyRule[];
  readonly scope: Scope | undefined;
  readonly jurisdiction: Jurisdiction | undefined;
  readonly priority: number;
  readonly effectiveFrom: Timestamp;
  readonly effectiveTo: Timestamp | undefined;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Policy storage record
 */
export interface PolicyRecord {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string | null;
  readonly status: string;
  readonly rules: string;
  readonly scope: string | null;
  readonly jurisdiction: string | null;
  readonly priority: number;
  readonly effectiveFrom: Timestamp;
  readonly effectiveTo: Timestamp | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  [key: string]: unknown;
}

/**
 * Input for creating a policy
 */
export interface CreatePolicyInput {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly rules: readonly PolicyRule[];
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
  readonly priority?: number;
  readonly effectiveFrom?: Timestamp;
  readonly effectiveTo?: Timestamp;
}

/**
 * Policy query options
 */
export interface PolicyQueryOptions {
  readonly status?: PolicyStatus;
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
  readonly effectiveAt?: Timestamp;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Policy evaluation context
 */
export interface EvaluationContext {
  readonly subject: Readonly<Record<string, unknown>>;
  readonly action: string;
  readonly resource: Readonly<Record<string, unknown>>;
  readonly environment: Readonly<Record<string, unknown>>;
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly effect: RuleEffect;
  readonly matched: boolean;
  readonly matchedConditions: readonly string[];
  readonly failedConditions: readonly string[];
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  readonly policyId: string;
  readonly policyName: string;
  readonly policyVersion: string;
  readonly decision: RuleEffect;
  readonly ruleResults: readonly RuleEvaluationResult[];
  readonly appliedRule: RuleEvaluationResult | undefined;
}

/**
 * Aggregate evaluation result across multiple policies
 */
export interface AggregateEvaluationResult {
  readonly finalDecision: RuleEffect;
  readonly policyResults: readonly PolicyEvaluationResult[];
  readonly decidingPolicy: PolicyEvaluationResult | undefined;
  readonly evaluatedAt: Timestamp;
}
