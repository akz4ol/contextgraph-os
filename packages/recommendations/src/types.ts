/**
 * Recommendation Types
 */

import type { EntityId, DecisionId } from '@contextgraph/core';

/**
 * Decision context for similarity matching
 */
export interface DecisionContext {
  /** Entity ID if applicable */
  entityId?: EntityId;
  /** Entity type */
  entityType?: string;
  /** Action type */
  action: string;
  /** Resource being acted on */
  resource?: string;
  /** Additional context attributes */
  attributes: Record<string, unknown>;
  /** Timestamp of the decision */
  timestamp?: number;
}

/**
 * Similarity score between decisions
 */
export interface SimilarityScore {
  /** Score from 0 to 1 */
  score: number;
  /** Breakdown of score components */
  breakdown: {
    actionMatch: number;
    entityTypeMatch: number;
    resourceMatch: number;
    attributeMatch: number;
  };
}

/**
 * Similar decision result
 */
export interface SimilarDecision {
  /** The similar decision ID */
  decisionId: DecisionId;
  /** Similarity score */
  similarity: SimilarityScore;
  /** Decision outcome */
  outcome: 'approved' | 'rejected' | 'executed' | 'failed';
  /** Time since decision */
  ageMs: number;
}

/**
 * Decision recommendation
 */
export interface Recommendation {
  /** Recommendation ID */
  id: string;
  /** Recommended action */
  recommendedAction: 'approve' | 'reject' | 'defer' | 'escalate';
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the recommendation */
  reasoning: string;
  /** Similar past decisions that informed this */
  precedents: SimilarDecision[];
  /** Risk assessment */
  risk: RiskAssessment;
  /** Generated at timestamp */
  generatedAt: number;
}

/**
 * Risk assessment for a decision
 */
export interface RiskAssessment {
  /** Overall risk level */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Risk score (0-1) */
  score: number;
  /** Risk factors identified */
  factors: RiskFactor[];
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  /** Factor name */
  name: string;
  /** Factor description */
  description: string;
  /** Contribution to overall risk (0-1) */
  weight: number;
  /** Mitigations if any */
  mitigations?: string[];
}

/**
 * Recommendation feedback for learning
 */
export interface RecommendationFeedback {
  /** Recommendation ID */
  recommendationId: string;
  /** Actual decision made */
  actualDecision: 'approved' | 'rejected';
  /** Whether recommendation was followed */
  followed: boolean;
  /** User feedback if any */
  feedback?: string;
  /** Timestamp */
  submittedAt: number;
}

/**
 * Matching criteria configuration
 */
export interface MatchingCriteria {
  /** Weight for action type match (0-1) */
  actionWeight: number;
  /** Weight for entity type match (0-1) */
  entityTypeWeight: number;
  /** Weight for resource match (0-1) */
  resourceWeight: number;
  /** Weight for attribute match (0-1) */
  attributeWeight: number;
  /** Minimum similarity threshold */
  minSimilarity: number;
  /** Maximum age for precedents (ms) */
  maxPrecedentAge: number;
  /** Maximum precedents to consider */
  maxPrecedents: number;
}

/**
 * Recommendation engine statistics
 */
export interface RecommendationStats {
  /** Total recommendations made */
  totalRecommendations: number;
  /** Recommendations followed */
  recommendationsFollowed: number;
  /** Average confidence */
  averageConfidence: number;
  /** Accuracy (when followed) */
  accuracy: number;
  /** Decision distribution */
  decisionDistribution: {
    approve: number;
    reject: number;
    defer: number;
    escalate: number;
  };
}
