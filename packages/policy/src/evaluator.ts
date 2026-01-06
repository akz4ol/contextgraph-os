/**
 * Policy Evaluator
 *
 * Evaluates policies against contexts to make access decisions.
 */

import { createTimestamp } from '@contextgraph/core';
import type {
  PolicyRule,
  RuleCondition,
  ConditionOperator,
  RuleEffect,
  EvaluationContext,
  RuleEvaluationResult,
  PolicyEvaluationResult,
  AggregateEvaluationResult,
} from './types.js';
import { Policy } from './policy.js';

/**
 * Policy Evaluator
 *
 * Evaluates rules and policies against a given context.
 */
export class PolicyEvaluator {
  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean {
    const value = this.resolveField(condition.field, context);
    return this.compareValues(value, condition.operator, condition.value);
  }

  /**
   * Evaluate a single rule
   */
  evaluateRule(rule: PolicyRule, context: EvaluationContext): RuleEvaluationResult {
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];

    for (const condition of rule.conditions) {
      const matches = this.evaluateCondition(condition, context);
      if (matches) {
        matchedConditions.push(condition.field);
      } else {
        failedConditions.push(condition.field);
      }
    }

    const matched = failedConditions.length === 0 && matchedConditions.length > 0;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      effect: rule.effect,
      matched,
      matchedConditions,
      failedConditions,
    };
  }

  /**
   * Evaluate a policy
   */
  evaluatePolicy(policy: Policy, context: EvaluationContext): PolicyEvaluationResult {
    const ruleResults: RuleEvaluationResult[] = [];
    let appliedRule: RuleEvaluationResult | undefined;

    // Evaluate rules in priority order
    const sortedRules = policy.getRulesByPriority();

    for (const rule of sortedRules) {
      const result = this.evaluateRule(rule, context);
      ruleResults.push(result);

      // First matching rule determines the decision
      if (result.matched && appliedRule === undefined) {
        appliedRule = result;
      }
    }

    // Default decision if no rules match
    const decision: RuleEffect = appliedRule?.effect ?? 'deny';

    return {
      policyId: policy.data.id,
      policyName: policy.data.name,
      policyVersion: policy.data.version,
      decision,
      ruleResults,
      appliedRule,
    };
  }

  /**
   * Evaluate multiple policies and aggregate results
   */
  evaluatePolicies(policies: readonly Policy[], context: EvaluationContext): AggregateEvaluationResult {
    const policyResults: PolicyEvaluationResult[] = [];
    let decidingPolicy: PolicyEvaluationResult | undefined;
    let finalDecision: RuleEffect = 'allow'; // Default to allow if no policies

    // Sort policies by priority (higher priority first)
    const sortedPolicies = [...policies].sort((a, b) => b.data.priority - a.data.priority);

    for (const policy of sortedPolicies) {
      // Skip non-effective policies
      if (!policy.isEffective()) {
        continue;
      }

      const result = this.evaluatePolicy(policy, context);
      policyResults.push(result);

      // Deny takes precedence
      if (result.decision === 'deny') {
        decidingPolicy = result;
        finalDecision = 'deny';
        break; // Deny is final
      }

      // Require approval takes precedence over allow
      if (result.decision === 'require_approval') {
        if (decidingPolicy === undefined || decidingPolicy.decision === 'allow') {
          decidingPolicy = result;
          finalDecision = 'require_approval';
        }
      }

      // Allow only if no other decision
      if (result.decision === 'allow' && decidingPolicy === undefined) {
        decidingPolicy = result;
        finalDecision = 'allow';
      }
    }

    return {
      finalDecision,
      policyResults,
      decidingPolicy,
      evaluatedAt: createTimestamp(),
    };
  }

  /**
   * Resolve a field path from the context
   */
  private resolveField(field: string, context: EvaluationContext): unknown {
    const parts = field.split('.');
    const root = parts[0];

    let current: unknown;

    switch (root) {
      case 'subject':
        current = context.subject;
        break;
      case 'action':
        return context.action;
      case 'resource':
        current = context.resource;
        break;
      case 'environment':
        current = context.environment;
        break;
      default:
        return undefined;
    }

    // Navigate the path
    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[parts[i]!];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Compare values using the specified operator
   */
  private compareValues(actual: unknown, operator: ConditionOperator, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;

      case 'not_equals':
        return actual !== expected;

      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.includes(expected);
        }
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return false;

      case 'not_contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return !actual.includes(expected);
        }
        if (Array.isArray(actual)) {
          return !actual.includes(expected);
        }
        return true;

      case 'greater_than':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

      case 'less_than':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

      case 'in':
        if (Array.isArray(expected)) {
          return expected.includes(actual);
        }
        return false;

      case 'not_in':
        if (Array.isArray(expected)) {
          return !expected.includes(actual);
        }
        return true;

      case 'matches':
        if (typeof actual === 'string' && typeof expected === 'string') {
          try {
            const regex = new RegExp(expected);
            return regex.test(actual);
          } catch {
            return false;
          }
        }
        return false;

      case 'exists':
        return actual !== undefined && actual !== null;

      default:
        return false;
    }
  }
}
