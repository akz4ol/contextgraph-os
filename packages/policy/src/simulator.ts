/**
 * Policy Simulator
 *
 * Simulate policy evaluation without side effects.
 * Useful for testing and validating policies before deployment.
 */

import { ok, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type {
  PolicyRule,
  RuleEffect,
  EvaluationContext,
  PolicyEvaluationResult,
  AggregateEvaluationResult,
  CreatePolicyInput,
} from './types.js';
import { Policy } from './policy.js';
import { PolicyEvaluator } from './evaluator.js';

/**
 * Simulation scenario
 */
export interface SimulationScenario {
  readonly name: string;
  readonly description?: string;
  readonly context: EvaluationContext;
  readonly expectedDecision?: RuleEffect;
}

/**
 * Scenario result
 */
export interface ScenarioResult {
  readonly scenario: SimulationScenario;
  readonly evaluation: PolicyEvaluationResult | AggregateEvaluationResult;
  readonly passed: boolean;
  readonly expectedDecision?: RuleEffect | undefined;
  readonly actualDecision: RuleEffect;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  readonly simulationId: string;
  readonly timestamp: Timestamp;
  readonly policyCount: number;
  readonly scenarioCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly results: readonly ScenarioResult[];
  readonly coverage: CoverageReport;
}

/**
 * Rule coverage info
 */
export interface RuleCoverage {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly effect: RuleEffect;
  readonly matchCount: number;
  readonly scenarioMatches: readonly string[];
}

/**
 * Policy coverage info
 */
export interface PolicyCoverage {
  readonly policyId: string;
  readonly policyName: string;
  readonly totalRules: number;
  readonly matchedRules: number;
  readonly coveragePercent: number;
  readonly ruleCoverage: readonly RuleCoverage[];
}

/**
 * Coverage report
 */
export interface CoverageReport {
  readonly totalPolicies: number;
  readonly totalRules: number;
  readonly matchedRules: number;
  readonly overallCoveragePercent: number;
  readonly policyCoverage: readonly PolicyCoverage[];
}

/**
 * Dry run result
 */
export interface DryRunResult {
  readonly context: EvaluationContext;
  readonly decision: RuleEffect;
  readonly explanation: string[];
  readonly matchedRules: readonly { policyId: string; ruleId: string; ruleName: string; effect: RuleEffect }[];
  readonly evaluationDetails: AggregateEvaluationResult;
}

/**
 * Policy diff
 */
export interface PolicyDiff {
  readonly policy1Id: string;
  readonly policy2Id: string;
  readonly rulesOnlyIn1: readonly PolicyRule[];
  readonly rulesOnlyIn2: readonly PolicyRule[];
  readonly modifiedRules: readonly {
    ruleId: string;
    in1: PolicyRule;
    in2: PolicyRule;
    differences: readonly string[];
  }[];
  readonly scenarioDifferences: readonly {
    scenario: SimulationScenario;
    decision1: RuleEffect;
    decision2: RuleEffect;
  }[];
}

/**
 * Policy Simulator
 */
export class PolicySimulator {
  private readonly evaluator: PolicyEvaluator;

  constructor() {
    this.evaluator = new PolicyEvaluator();
  }

  /**
   * Dry run - evaluate context without side effects
   * Note: This evaluates policies regardless of their effective status
   */
  dryRun(policies: readonly Policy[], context: EvaluationContext): DryRunResult {
    // For dry run, we evaluate all policies regardless of status
    const evaluationDetails = this.evaluatePoliciesForSimulation(policies, context);
    const explanation: string[] = [];
    const matchedRules: { policyId: string; ruleId: string; ruleName: string; effect: RuleEffect }[] = [];

    // Build explanation
    explanation.push(`Evaluating ${policies.length} policies`);

    for (const policyResult of evaluationDetails.policyResults) {
      explanation.push(`Policy "${policyResult.policyName}" (${policyResult.policyId}):`);

      for (const ruleResult of policyResult.ruleResults) {
        if (ruleResult.matched) {
          explanation.push(`  ✓ Rule "${ruleResult.ruleName}" matched → ${ruleResult.effect}`);
          matchedRules.push({
            policyId: policyResult.policyId,
            ruleId: ruleResult.ruleId,
            ruleName: ruleResult.ruleName,
            effect: ruleResult.effect,
          });
        } else {
          const failed = ruleResult.failedConditions.join(', ');
          explanation.push(`  ✗ Rule "${ruleResult.ruleName}" failed on: ${failed}`);
        }
      }

      explanation.push(`  Decision: ${policyResult.decision}`);
    }

    explanation.push(`Final decision: ${evaluationDetails.finalDecision}`);

    if (evaluationDetails.decidingPolicy !== undefined) {
      explanation.push(
        `Deciding policy: "${evaluationDetails.decidingPolicy.policyName}" via rule "${evaluationDetails.decidingPolicy.appliedRule?.ruleName ?? 'default'}"`
      );
    }

    return {
      context,
      decision: evaluationDetails.finalDecision,
      explanation,
      matchedRules,
      evaluationDetails,
    };
  }

  /**
   * Simulate a policy against scenarios
   */
  simulatePolicy(
    policy: Policy | CreatePolicyInput,
    scenarios: readonly SimulationScenario[]
  ): Result<SimulationResult, Error> {
    const now = createTimestamp();
    const simulationId = `sim_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // Convert input to Policy if needed
    let policyObj: Policy;
    if (policy instanceof Policy) {
      policyObj = policy;
    } else {
      const createResult = Policy.create(policy);
      if (!createResult.ok) {
        return createResult;
      }
      policyObj = createResult.value;
    }
    const results: ScenarioResult[] = [];
    const ruleCoverageMap = new Map<string, { rule: PolicyRule; matches: string[] }>();

    // Initialize coverage tracking
    for (const rule of policyObj.data.rules) {
      ruleCoverageMap.set(rule.id, { rule, matches: [] });
    }

    // Run scenarios
    for (const scenario of scenarios) {
      const evaluation = this.evaluator.evaluatePolicy(policyObj, scenario.context);
      const actualDecision = evaluation.decision;
      const passed = scenario.expectedDecision === undefined || actualDecision === scenario.expectedDecision;

      // Track coverage
      for (const ruleResult of evaluation.ruleResults) {
        if (ruleResult.matched) {
          const coverage = ruleCoverageMap.get(ruleResult.ruleId);
          if (coverage !== undefined) {
            coverage.matches.push(scenario.name);
          }
        }
      }

      results.push({
        scenario,
        evaluation,
        passed,
        expectedDecision: scenario.expectedDecision,
        actualDecision,
      });
    }

    // Build coverage report
    const ruleCoverage: RuleCoverage[] = Array.from(ruleCoverageMap.values()).map(({ rule, matches }) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      effect: rule.effect,
      matchCount: matches.length,
      scenarioMatches: matches,
    }));

    const matchedRules = ruleCoverage.filter((r) => r.matchCount > 0).length;
    const totalRules = policyObj.data.rules.length;

    const coverage: CoverageReport = {
      totalPolicies: 1,
      totalRules,
      matchedRules,
      overallCoveragePercent: totalRules > 0 ? (matchedRules / totalRules) * 100 : 0,
      policyCoverage: [
        {
          policyId: policyObj.data.id,
          policyName: policyObj.data.name,
          totalRules,
          matchedRules,
          coveragePercent: totalRules > 0 ? (matchedRules / totalRules) * 100 : 0,
          ruleCoverage,
        },
      ],
    };

    return ok({
      simulationId,
      timestamp: now,
      policyCount: 1,
      scenarioCount: scenarios.length,
      passedCount: results.filter((r) => r.passed).length,
      failedCount: results.filter((r) => !r.passed).length,
      results,
      coverage,
    });
  }

  /**
   * Simulate multiple policies against scenarios
   */
  simulatePolicies(
    policies: readonly Policy[],
    scenarios: readonly SimulationScenario[]
  ): Result<SimulationResult, Error> {
    const now = createTimestamp();
    const simulationId = `sim_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const results: ScenarioResult[] = [];
    const ruleCoverageMap = new Map<string, { policyId: string; rule: PolicyRule; matches: string[] }>();

    // Initialize coverage tracking
    for (const policy of policies) {
      for (const rule of policy.data.rules) {
        ruleCoverageMap.set(`${policy.data.id}:${rule.id}`, {
          policyId: policy.data.id,
          rule,
          matches: [],
        });
      }
    }

    // Run scenarios
    for (const scenario of scenarios) {
      // Use simulation-specific evaluation that ignores effective status
      const evaluation = this.evaluatePoliciesForSimulation(policies, scenario.context);
      const actualDecision = evaluation.finalDecision;
      const passed = scenario.expectedDecision === undefined || actualDecision === scenario.expectedDecision;

      // Track coverage
      for (const policyResult of evaluation.policyResults) {
        for (const ruleResult of policyResult.ruleResults) {
          if (ruleResult.matched) {
            const key = `${policyResult.policyId}:${ruleResult.ruleId}`;
            const coverage = ruleCoverageMap.get(key);
            if (coverage !== undefined) {
              coverage.matches.push(scenario.name);
            }
          }
        }
      }

      results.push({
        scenario,
        evaluation,
        passed,
        expectedDecision: scenario.expectedDecision,
        actualDecision,
      });
    }

    // Build coverage report per policy
    const policyMap = new Map<string, { policy: Policy; rules: RuleCoverage[] }>();
    for (const policy of policies) {
      policyMap.set(policy.data.id, { policy, rules: [] });
    }

    for (const { policyId, rule, matches } of ruleCoverageMap.values()) {
      const policyData = policyMap.get(policyId);
      if (policyData !== undefined) {
        policyData.rules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          effect: rule.effect,
          matchCount: matches.length,
          scenarioMatches: matches,
        });
      }
    }

    const policyCoverage: PolicyCoverage[] = [];
    let totalRules = 0;
    let totalMatchedRules = 0;

    for (const { policy, rules } of policyMap.values()) {
      const matched = rules.filter((r) => r.matchCount > 0).length;
      const total = rules.length;
      totalRules += total;
      totalMatchedRules += matched;

      policyCoverage.push({
        policyId: policy.data.id,
        policyName: policy.data.name,
        totalRules: total,
        matchedRules: matched,
        coveragePercent: total > 0 ? (matched / total) * 100 : 0,
        ruleCoverage: rules,
      });
    }

    const coverage: CoverageReport = {
      totalPolicies: policies.length,
      totalRules,
      matchedRules: totalMatchedRules,
      overallCoveragePercent: totalRules > 0 ? (totalMatchedRules / totalRules) * 100 : 0,
      policyCoverage,
    };

    return ok({
      simulationId,
      timestamp: now,
      policyCount: policies.length,
      scenarioCount: scenarios.length,
      passedCount: results.filter((r) => r.passed).length,
      failedCount: results.filter((r) => !r.passed).length,
      results,
      coverage,
    });
  }

  /**
   * Compare two policies
   */
  comparePolicies(
    policy1: Policy,
    policy2: Policy,
    scenarios?: readonly SimulationScenario[]
  ): PolicyDiff {
    const rules1Map = new Map(policy1.data.rules.map((r) => [r.id, r]));
    const rules2Map = new Map(policy2.data.rules.map((r) => [r.id, r]));

    const rulesOnlyIn1: PolicyRule[] = [];
    const rulesOnlyIn2: PolicyRule[] = [];
    const modifiedRules: { ruleId: string; in1: PolicyRule; in2: PolicyRule; differences: string[] }[] = [];

    // Find rules only in policy1
    for (const [id, rule] of rules1Map) {
      if (!rules2Map.has(id)) {
        rulesOnlyIn1.push(rule);
      }
    }

    // Find rules only in policy2
    for (const [id, rule] of rules2Map) {
      if (!rules1Map.has(id)) {
        rulesOnlyIn2.push(rule);
      }
    }

    // Find modified rules
    for (const [id, rule1] of rules1Map) {
      const rule2 = rules2Map.get(id);
      if (rule2 !== undefined) {
        const differences = this.findRuleDifferences(rule1, rule2);
        if (differences.length > 0) {
          modifiedRules.push({ ruleId: id, in1: rule1, in2: rule2, differences });
        }
      }
    }

    // Compare scenario results if provided
    const scenarioDifferences: { scenario: SimulationScenario; decision1: RuleEffect; decision2: RuleEffect }[] = [];

    if (scenarios !== undefined) {
      for (const scenario of scenarios) {
        const result1 = this.evaluator.evaluatePolicy(policy1, scenario.context);
        const result2 = this.evaluator.evaluatePolicy(policy2, scenario.context);

        if (result1.decision !== result2.decision) {
          scenarioDifferences.push({
            scenario,
            decision1: result1.decision,
            decision2: result2.decision,
          });
        }
      }
    }

    return {
      policy1Id: policy1.data.id,
      policy2Id: policy2.data.id,
      rulesOnlyIn1,
      rulesOnlyIn2,
      modifiedRules,
      scenarioDifferences,
    };
  }

  /**
   * Evaluate policies for simulation (ignores effective status)
   */
  private evaluatePoliciesForSimulation(
    policies: readonly Policy[],
    context: EvaluationContext
  ): AggregateEvaluationResult {
    const policyResults: PolicyEvaluationResult[] = [];
    let decidingPolicy: PolicyEvaluationResult | undefined;
    let finalDecision: RuleEffect = 'deny'; // Default to deny if no rules match in any policy

    // Sort policies by priority (higher priority first)
    const sortedPolicies = [...policies].sort((a, b) => b.data.priority - a.data.priority);

    for (const policy of sortedPolicies) {
      // Note: We intentionally skip the isEffective() check for simulation
      const result = this.evaluator.evaluatePolicy(policy, context);
      policyResults.push(result);

      // Only consider policies where a rule actually matched
      if (result.appliedRule === undefined) {
        continue; // No rule matched in this policy, skip to next
      }

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
   * Find differences between two rules
   */
  private findRuleDifferences(rule1: PolicyRule, rule2: PolicyRule): string[] {
    const differences: string[] = [];

    if (rule1.name !== rule2.name) {
      differences.push(`name: "${rule1.name}" → "${rule2.name}"`);
    }

    if (rule1.effect !== rule2.effect) {
      differences.push(`effect: ${rule1.effect} → ${rule2.effect}`);
    }

    if (rule1.priority !== rule2.priority) {
      differences.push(`priority: ${rule1.priority} → ${rule2.priority}`);
    }

    if (rule1.description !== rule2.description) {
      differences.push(`description changed`);
    }

    // Compare conditions
    const conds1 = JSON.stringify(rule1.conditions);
    const conds2 = JSON.stringify(rule2.conditions);
    if (conds1 !== conds2) {
      differences.push(`conditions changed`);
    }

    return differences;
  }

  /**
   * Generate test scenarios from a policy
   */
  generateScenarios(policy: Policy): SimulationScenario[] {
    const scenarios: SimulationScenario[] = [];

    // Generate a scenario for each rule
    for (const rule of policy.data.rules) {
      const context = this.generateContextForRule(rule);
      scenarios.push({
        name: `Test ${rule.name}`,
        description: `Auto-generated scenario to match rule "${rule.name}"`,
        context,
        expectedDecision: rule.effect,
      });
    }

    // Add a default deny scenario
    scenarios.push({
      name: 'Default deny case',
      description: 'Scenario that should not match any rules',
      context: {
        subject: { id: 'unknown', role: 'unknown' },
        action: 'unknown_action',
        resource: { type: 'unknown' },
        environment: {},
      },
      expectedDecision: 'deny',
    });

    return scenarios;
  }

  /**
   * Generate a context that matches a rule
   */
  private generateContextForRule(rule: PolicyRule): EvaluationContext {
    const subject: Record<string, unknown> = { id: 'test_subject' };
    let action = 'test_action';
    const resource: Record<string, unknown> = { type: 'test_resource' };
    const environment: Record<string, unknown> = {};

    for (const condition of rule.conditions) {
      const parts = condition.field.split('.');
      const root = parts[0];
      const path = parts.slice(1);

      let value: unknown;

      // Generate a value that matches the condition
      switch (condition.operator) {
        case 'equals':
        case 'in':
          value = Array.isArray(condition.value)
            ? condition.value[0]
            : condition.value;
          break;
        case 'not_equals':
        case 'not_in':
          // Can't easily generate a non-matching value, use placeholder
          value = 'placeholder';
          break;
        case 'greater_than':
          value = typeof condition.value === 'number' ? condition.value + 1 : 100;
          break;
        case 'less_than':
          value = typeof condition.value === 'number' ? condition.value - 1 : 0;
          break;
        case 'contains':
          value = condition.value;
          break;
        case 'exists':
          value = true;
          break;
        case 'matches':
          // Generate a simple match
          value = 'test';
          break;
        default:
          value = condition.value;
      }

      switch (root) {
        case 'subject':
          this.setNestedValue(subject, path, value);
          break;
        case 'action':
          action = String(value);
          break;
        case 'resource':
          this.setNestedValue(resource, path, value);
          break;
        case 'environment':
          this.setNestedValue(environment, path, value);
          break;
      }
    }

    return { subject, action, resource, environment };
  }

  /**
   * Set a nested value in an object
   */
  private setNestedValue(obj: Record<string, unknown>, path: readonly string[], value: unknown): void {
    if (path.length === 0) {
      return;
    }

    let current: Record<string, unknown> = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]!;
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[path[path.length - 1]!] = value;
  }
}
