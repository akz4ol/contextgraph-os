/**
 * @contextgraph/dtg
 *
 * Decision Trace Graph for ContextGraph OS.
 * Tracks decisions as structured data with complete audit trails.
 */

export {
  type DecisionStatus,
  type DecisionType,
  type RiskLevel,
  type ClaimRef,
  type PolicyRef,
  type PrecedentRef,
  type DecisionData,
  type DecisionRecord,
  type CreateDecisionInput,
  type DecisionQueryOptions,
  type TransitionResult,
} from './types.js';

export {
  Decision,
  isValidTransition,
  getValidTransitions,
} from './decision.js';

export {
  DecisionRepository,
} from './repository.js';

export {
  DecisionTraceGraph,
  type DecisionStats,
  type DecisionChain,
} from './graph.js';
