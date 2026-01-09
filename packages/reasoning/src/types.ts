/**
 * Reasoning Types
 */

import type { EntityId, ClaimId } from '@contextgraph/core';

/**
 * Relation types for inference
 */
export type RelationType = 'transitive' | 'symmetric' | 'inverse' | 'reflexive';

/**
 * Relation definition
 */
export interface RelationDefinition {
  /** Relation name (predicate) */
  name: string;
  /** Relation type for inference */
  type: RelationType;
  /** Inverse relation name (for inverse type) */
  inverseName?: string;
  /** Description */
  description?: string;
}

/**
 * Inference rule
 */
export interface InferenceRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Conditions that must match */
  conditions: RuleCondition[];
  /** Conclusions to infer when conditions match */
  conclusions: RuleConclusion[];
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Whether rule is enabled */
  enabled: boolean;
}

/**
 * Rule condition
 */
export interface RuleCondition {
  /** Subject pattern (variable or literal) */
  subject: string;
  /** Predicate to match */
  predicate: string;
  /** Object pattern (variable or literal) */
  object: string;
}

/**
 * Rule conclusion
 */
export interface RuleConclusion {
  /** Subject (variable reference or literal) */
  subject: string;
  /** Predicate for new claim */
  predicate: string;
  /** Object (variable reference or literal) */
  object: string;
  /** Confidence multiplier for inferred claims */
  confidenceMultiplier?: number;
}

/**
 * Inferred fact
 */
export interface InferredFact {
  /** Subject entity ID */
  subjectId: EntityId;
  /** Predicate */
  predicate: string;
  /** Object value (entity ID or literal) */
  object: string | number | boolean;
  /** Source claims that led to this inference */
  sourceClaims: ClaimId[];
  /** Rule that produced this inference */
  ruleId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Inference timestamp */
  inferredAt: number;
}

/**
 * Explanation for a claim or inference
 */
export interface Explanation {
  /** The claim being explained */
  claimId?: ClaimId;
  /** The inferred fact being explained */
  inferredFact?: InferredFact;
  /** Explanation text */
  text: string;
  /** Source claims */
  sources: Array<{
    claimId: ClaimId;
    description: string;
  }>;
  /** Rules applied */
  rules: Array<{
    ruleId: string;
    ruleName: string;
  }>;
  /** Inference chain */
  chain: string[];
}

/**
 * Binding for rule variables
 */
export interface VariableBinding {
  [variable: string]: string | number | boolean;
}

/**
 * Rule match result
 */
export interface RuleMatch {
  rule: InferenceRule;
  bindings: VariableBinding[];
}

/**
 * Reasoning statistics
 */
export interface ReasoningStats {
  /** Total rules loaded */
  rulesLoaded: number;
  /** Total relations defined */
  relationsLoaded: number;
  /** Total inferences made */
  inferencesCount: number;
  /** Time spent reasoning (ms) */
  reasoningTimeMs: number;
  /** Rules that fired */
  rulesFired: Map<string, number>;
}
