/**
 * @contextgraph/retrieval
 *
 * Retrieval and context assembly for ContextGraph OS.
 * Provides temporal, scope-aware context retrieval.
 */

export {
  type TemporalFilter,
  type ScopeFilter,
  type ConfidenceFilter,
  type ContextFilter,
  type RelevanceScore,
  type RetrievedEntity,
  type RetrievedClaim,
  type AssembledContext,
  type ContextStats,
  type ContextQuery,
  type ContextAssemblyOptions,
  type RetrievalResult,
} from './types.js';

export {
  ContextFilterEngine,
} from './filter.js';

export {
  ContextAssembler,
} from './assembler.js';
