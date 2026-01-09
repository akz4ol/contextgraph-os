/**
 * Rule Engine
 *
 * Forward chaining inference engine
 */

import type { Result } from '@contextgraph/core';
import type {
  InferenceRule,
  RuleCondition,
  RuleConclusion,
  VariableBinding,
  RuleMatch,
} from './types.js';

/**
 * Check if a string is a variable (starts with ?)
 */
function isVariable(s: string): boolean {
  return s.startsWith('?');
}

/**
 * Built-in inference rules
 */
export const BUILTIN_RULES: InferenceRule[] = [
  // Transitive closure rule
  {
    id: 'transitive-closure',
    name: 'Transitive Closure',
    description: 'If A relates to B and B relates to C via a transitive relation, then A relates to C',
    conditions: [
      { subject: '?a', predicate: '?rel', object: '?b' },
      { subject: '?b', predicate: '?rel', object: '?c' },
    ],
    conclusions: [{ subject: '?a', predicate: '?rel', object: '?c', confidenceMultiplier: 0.9 }],
    priority: 100,
    enabled: true,
  },
  // Symmetric relation rule
  {
    id: 'symmetric-relation',
    name: 'Symmetric Relation',
    description: 'If A relates to B via a symmetric relation, then B relates to A',
    conditions: [{ subject: '?a', predicate: '?rel', object: '?b' }],
    conclusions: [{ subject: '?b', predicate: '?rel', object: '?a', confidenceMultiplier: 1.0 }],
    priority: 90,
    enabled: true,
  },
  // Inverse relation rule
  {
    id: 'inverse-relation',
    name: 'Inverse Relation',
    description: 'If A relates to B, then B relates to A via the inverse relation',
    conditions: [{ subject: '?a', predicate: '?rel', object: '?b' }],
    conclusions: [{ subject: '?b', predicate: '?inverseRel', object: '?a', confidenceMultiplier: 1.0 }],
    priority: 80,
    enabled: true,
  },
];

/**
 * Rule Registry
 */
export class RuleRegistry {
  private rules: Map<string, InferenceRule> = new Map();

  constructor(loadBuiltins: boolean = true) {
    if (loadBuiltins) {
      for (const rule of BUILTIN_RULES) {
        this.register(rule);
      }
    }
  }

  /**
   * Register an inference rule
   */
  register(rule: InferenceRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a rule
   */
  unregister(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get a rule by ID
   */
  get(ruleId: string): InferenceRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules sorted by priority
   */
  getAll(): InferenceRule[] {
    return Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Enable or disable a rule
   */
  setEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule === undefined) return false;
    rule.enabled = enabled;
    return true;
  }

  /**
   * Get count of registered rules
   */
  get size(): number {
    return this.rules.size;
  }
}

/**
 * Fact representation for pattern matching
 */
export interface Fact {
  subject: string;
  predicate: string;
  object: string | number | boolean;
}

/**
 * Pattern matcher for rule conditions
 */
export class PatternMatcher {
  /**
   * Match a condition against a fact
   */
  matchCondition(condition: RuleCondition, fact: Fact, bindings: VariableBinding): VariableBinding | null {
    const newBindings = { ...bindings };

    // Match subject
    if (!this.matchTerm(condition.subject, String(fact.subject), newBindings)) {
      return null;
    }

    // Match predicate
    if (!this.matchTerm(condition.predicate, String(fact.predicate), newBindings)) {
      return null;
    }

    // Match object
    if (!this.matchTerm(condition.object, String(fact.object), newBindings)) {
      return null;
    }

    return newBindings;
  }

  /**
   * Match a single term (variable or literal)
   */
  private matchTerm(pattern: string, value: string, bindings: VariableBinding): boolean {
    if (isVariable(pattern)) {
      const existing = bindings[pattern];
      if (existing !== undefined) {
        // Variable already bound, check if it matches
        return String(existing) === value;
      }
      // Bind the variable
      bindings[pattern] = value;
      return true;
    }
    // Literal comparison
    return pattern === value;
  }

  /**
   * Apply bindings to a conclusion to generate a new fact
   */
  applyBindings(conclusion: RuleConclusion, bindings: VariableBinding): Fact | null {
    const subject = this.resolveTerm(conclusion.subject, bindings);
    const predicate = this.resolveTerm(conclusion.predicate, bindings);
    const object = this.resolveTerm(conclusion.object, bindings);

    if (subject === null || predicate === null || object === null) {
      return null;
    }

    return { subject, predicate, object };
  }

  /**
   * Resolve a term using bindings
   */
  private resolveTerm(term: string, bindings: VariableBinding): string | null {
    if (isVariable(term)) {
      const value = bindings[term];
      return value !== undefined ? String(value) : null;
    }
    return term;
  }
}

/**
 * Forward chaining rule engine
 */
export class RuleEngine {
  private rules: RuleRegistry;
  private matcher: PatternMatcher;

  constructor(rules: RuleRegistry = new RuleRegistry()) {
    this.rules = rules;
    this.matcher = new PatternMatcher();
  }

  /**
   * Find all rules that match the given facts
   */
  findMatches(facts: Fact[]): RuleMatch[] {
    const matches: RuleMatch[] = [];
    const rules = this.rules.getAll();

    for (const rule of rules) {
      const ruleBindings = this.matchRule(rule, facts);
      if (ruleBindings.length > 0) {
        matches.push({ rule, bindings: ruleBindings });
      }
    }

    return matches;
  }

  /**
   * Match a single rule against facts
   */
  private matchRule(rule: InferenceRule, facts: Fact[]): VariableBinding[] {
    if (rule.conditions.length === 0) return [];

    const firstCondition = rule.conditions[0];
    if (firstCondition === undefined) return [];

    // Start with all possible matches for the first condition
    let bindings: VariableBinding[] = [];

    for (const fact of facts) {
      const match = this.matcher.matchCondition(firstCondition, fact, {});
      if (match !== null) {
        bindings.push(match);
      }
    }

    // For each subsequent condition, filter and extend bindings
    for (let i = 1; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      if (condition === undefined) continue;

      const newBindings: VariableBinding[] = [];

      for (const binding of bindings) {
        for (const fact of facts) {
          const match = this.matcher.matchCondition(condition, fact, binding);
          if (match !== null) {
            newBindings.push(match);
          }
        }
      }

      bindings = newBindings;
      if (bindings.length === 0) break;
    }

    return bindings;
  }

  /**
   * Apply a rule to generate new facts
   */
  applyRule(rule: InferenceRule, bindings: VariableBinding[]): Fact[] {
    const newFacts: Fact[] = [];

    for (const binding of bindings) {
      for (const conclusion of rule.conclusions) {
        const fact = this.matcher.applyBindings(conclusion, binding);
        if (fact !== null) {
          newFacts.push(fact);
        }
      }
    }

    return newFacts;
  }

  /**
   * Run forward chaining until no new facts are generated
   */
  forwardChain(
    initialFacts: Fact[],
    options: { maxIterations?: number; maxFacts?: number } = {}
  ): Result<{ facts: Fact[]; iterations: number; newFactsCount: number }> {
    const maxIterations = options.maxIterations ?? 100;
    const maxFacts = options.maxFacts ?? 10000;

    const allFacts = new Set<string>();
    const factList: Fact[] = [];

    // Add initial facts
    for (const fact of initialFacts) {
      const key = `${fact.subject}|${fact.predicate}|${fact.object}`;
      if (!allFacts.has(key)) {
        allFacts.add(key);
        factList.push(fact);
      }
    }

    let iteration = 0;
    let newFactsCount = 0;

    while (iteration < maxIterations) {
      iteration++;
      let addedAny = false;

      const matches = this.findMatches(factList);

      for (const match of matches) {
        const newFacts = this.applyRule(match.rule, match.bindings);

        for (const fact of newFacts) {
          const key = `${fact.subject}|${fact.predicate}|${fact.object}`;
          if (!allFacts.has(key)) {
            if (factList.length >= maxFacts) {
              return {
                ok: false,
                error: new Error(`Maximum facts limit (${maxFacts}) reached`),
              };
            }
            allFacts.add(key);
            factList.push(fact);
            addedAny = true;
            newFactsCount++;
          }
        }
      }

      if (!addedAny) break;
    }

    return {
      ok: true,
      value: { facts: factList, iterations: iteration, newFactsCount },
    };
  }

  /**
   * Get the underlying rule registry
   */
  getRules(): RuleRegistry {
    return this.rules;
  }
}

/**
 * Create a rule engine with default rules
 */
export function createRuleEngine(): RuleEngine {
  return new RuleEngine();
}
