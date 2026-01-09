/**
 * @contextgraph/recommendations
 *
 * Decision recommendations for ContextGraph OS.
 * Provides similarity-based decision recommendations using historical precedents.
 */

export type {
  DecisionContext,
  SimilarityScore,
  SimilarDecision,
  Recommendation,
  RiskAssessment,
  RiskFactor,
  RecommendationFeedback,
  MatchingCriteria,
  RecommendationStats,
} from './types.js';

export {
  calculateSimilarity,
  rankBySimilarity,
  DEFAULT_CRITERIA,
} from './similarity.js';

export {
  RecommendationEngine,
  createRecommendationEngine,
  type RecommendationEngineConfig,
} from './engine.js';
