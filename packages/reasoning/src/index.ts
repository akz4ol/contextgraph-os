/**
 * @contextgraph/reasoning
 *
 * Semantic reasoning and inference for ContextGraph OS.
 * Provides transitive, symmetric, and inverse relation inference,
 * plus contradiction detection and resolution.
 */

export type {
  RelationType,
  RelationDefinition,
  InferenceRule,
  RuleCondition,
  RuleConclusion,
  InferredFact,
  Explanation,
  VariableBinding,
  RuleMatch,
  ReasoningStats,
} from './types.js';

export {
  RelationRegistry,
  createRelationRegistry,
} from './relations.js';

export {
  RuleRegistry,
  RuleEngine,
  PatternMatcher,
  createRuleEngine,
  BUILTIN_RULES,
  type Fact,
} from './rules.js';

export {
  Reasoner,
  createReasoner,
  type ReasonerConfig,
} from './reasoner.js';

export type {
  ContradictionType,
  Contradiction,
  ResolutionStrategy,
  ResolutionResult,
  MutualExclusionRule,
  SingleValuedRule,
} from './contradictions.js';

export {
  ContradictionDetector,
  createContradictionDetector,
} from './contradictions.js';
