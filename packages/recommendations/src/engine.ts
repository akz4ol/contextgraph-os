/**
 * Recommendation Engine
 *
 * Provides decision recommendations based on historical precedents
 */

import type { Result } from '@contextgraph/core';
import type { DecisionTraceGraph, Decision } from '@contextgraph/dtg';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  DecisionContext,
  SimilarDecision,
  Recommendation,
  RiskAssessment,
  RiskFactor,
  RecommendationFeedback,
  MatchingCriteria,
  RecommendationStats,
} from './types.js';
import { calculateSimilarity, rankBySimilarity, DEFAULT_CRITERIA } from './similarity.js';

/**
 * Recommendation engine configuration
 */
export interface RecommendationEngineConfig {
  /** Matching criteria */
  criteria?: Partial<MatchingCriteria>;
  /** Minimum precedents required for recommendation */
  minPrecedents?: number;
  /** High risk action patterns */
  highRiskPatterns?: string[];
  /** Actions requiring escalation */
  escalationPatterns?: string[];
}

const DEFAULT_CONFIG: Required<RecommendationEngineConfig> = {
  criteria: {},
  minPrecedents: 3,
  highRiskPatterns: ['delete', 'destroy', 'terminate', 'revoke', 'disable'],
  escalationPatterns: ['admin', 'root', 'sudo', 'override'],
};

/**
 * Recommendation Engine
 */
export class RecommendationEngine {
  private dtg: DecisionTraceGraph;
  private config: Required<RecommendationEngineConfig>;
  private criteria: MatchingCriteria;
  private feedbackStore: Map<string, RecommendationFeedback> = new Map();
  private recommendations: Map<string, Recommendation> = new Map();
  private stats: RecommendationStats;

  constructor(
    dtg: DecisionTraceGraph,
    _storage: StorageInterface,
    config: RecommendationEngineConfig = {}
  ) {
    this.dtg = dtg;
    void _storage; // Reserved for future caching
    this.config = {
      criteria: config.criteria ?? DEFAULT_CONFIG.criteria,
      minPrecedents: config.minPrecedents ?? DEFAULT_CONFIG.minPrecedents,
      highRiskPatterns: config.highRiskPatterns ?? DEFAULT_CONFIG.highRiskPatterns,
      escalationPatterns: config.escalationPatterns ?? DEFAULT_CONFIG.escalationPatterns,
    };
    this.criteria = { ...DEFAULT_CRITERIA, ...this.config.criteria };
    this.stats = this.initStats();
  }

  private initStats(): RecommendationStats {
    return {
      totalRecommendations: 0,
      recommendationsFollowed: 0,
      averageConfidence: 0,
      accuracy: 0,
      decisionDistribution: {
        approve: 0,
        reject: 0,
        defer: 0,
        escalate: 0,
      },
    };
  }

  /**
   * Find similar past decisions
   */
  async findSimilarDecisions(context: DecisionContext): Promise<Result<SimilarDecision[]>> {
    try {
      // Get historical decisions using queryDecisions
      const decisionsResult = await this.dtg.queryDecisions({
        limit: 1000,
      });

      if (!decisionsResult.ok) {
        return decisionsResult;
      }

      // Filter to completed decisions
      const completedDecisions = decisionsResult.value.filter(
        (d) =>
          d.data.status === 'approved' ||
          d.data.status === 'rejected' ||
          d.data.status === 'executed' ||
          d.data.status === 'failed'
      );

      const now = Date.now();
      const similar: SimilarDecision[] = [];

      for (const decision of completedDecisions) {
        // Convert decision to context
        const decisionContext = this.decisionToContext(decision);

        // Calculate similarity
        const similarity = calculateSimilarity(context, decisionContext, this.criteria);

        if (similarity.score >= this.criteria.minSimilarity) {
          const outcome = this.getDecisionOutcome(decision);
          const ageMs = now - decision.data.proposedAt;

          similar.push({
            decisionId: decision.data.id,
            similarity,
            outcome,
            ageMs,
          });
        }
      }

      // Rank and limit results
      const ranked = rankBySimilarity(similar, this.criteria);

      return { ok: true, value: ranked };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get a recommendation for a decision context
   */
  async recommend(context: DecisionContext): Promise<Result<Recommendation>> {
    try {
      // Find similar decisions
      const similarResult = await this.findSimilarDecisions(context);
      if (!similarResult.ok) {
        return similarResult;
      }

      const precedents = similarResult.value;

      // Assess risk
      const risk = this.assessRisk(context, precedents);

      // Determine recommendation
      const { action, confidence, reasoning } = this.determineRecommendation(
        context,
        precedents,
        risk
      );

      const recommendation: Recommendation = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        recommendedAction: action,
        confidence,
        reasoning,
        precedents,
        risk,
        generatedAt: Date.now(),
      };

      // Store and update stats
      this.recommendations.set(recommendation.id, recommendation);
      this.updateStats(recommendation);

      return { ok: true, value: recommendation };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Explain a recommendation
   */
  explainRecommendation(recommendationId: string): Result<string> {
    const rec = this.recommendations.get(recommendationId);
    if (rec === undefined) {
      return { ok: false, error: new Error(`Recommendation ${recommendationId} not found`) };
    }

    const lines: string[] = [];
    lines.push(`Recommendation: ${rec.recommendedAction.toUpperCase()}`);
    lines.push(`Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('Reasoning:');
    lines.push(rec.reasoning);
    lines.push('');
    lines.push(`Risk Level: ${rec.risk.level.toUpperCase()} (${(rec.risk.score * 100).toFixed(1)}%)`);

    if (rec.risk.factors.length > 0) {
      lines.push('');
      lines.push('Risk Factors:');
      for (const factor of rec.risk.factors) {
        lines.push(`  - ${factor.name}: ${factor.description}`);
        if (factor.mitigations !== undefined && factor.mitigations.length > 0) {
          lines.push(`    Mitigations: ${factor.mitigations.join(', ')}`);
        }
      }
    }

    if (rec.precedents.length > 0) {
      lines.push('');
      lines.push('Similar Past Decisions:');
      for (const p of rec.precedents.slice(0, 5)) {
        lines.push(
          `  - ${p.decisionId}: ${p.outcome} (${(p.similarity.score * 100).toFixed(1)}% similar)`
        );
      }
    }

    return { ok: true, value: lines.join('\n') };
  }

  /**
   * Submit feedback on a recommendation
   */
  submitFeedback(feedback: RecommendationFeedback): Result<void> {
    const rec = this.recommendations.get(feedback.recommendationId);
    if (rec === undefined) {
      return { ok: false, error: new Error(`Recommendation ${feedback.recommendationId} not found`) };
    }

    this.feedbackStore.set(feedback.recommendationId, feedback);

    // Update accuracy stats
    if (feedback.followed) {
      this.stats.recommendationsFollowed++;
    }

    // Recalculate accuracy
    const totalWithFeedback = this.feedbackStore.size;
    const correct = Array.from(this.feedbackStore.values()).filter((f) => {
      const r = this.recommendations.get(f.recommendationId);
      if (r === undefined) return false;
      const recommended = r.recommendedAction === 'approve' ? 'approved' : 'rejected';
      return f.actualDecision === recommended;
    }).length;

    this.stats.accuracy = totalWithFeedback > 0 ? correct / totalWithFeedback : 0;

    return { ok: true, value: undefined };
  }

  /**
   * Get recommendation statistics
   */
  getStats(): RecommendationStats {
    return { ...this.stats };
  }

  /**
   * Update matching criteria
   */
  setCriteria(criteria: Partial<MatchingCriteria>): void {
    this.criteria = { ...this.criteria, ...criteria };
  }

  // Private helpers

  private decisionToContext(decision: Decision): DecisionContext {
    return {
      action: decision.data.type,
      entityType: decision.data.type,
      resource: decision.data.title,
      attributes: {
        proposedBy: decision.data.proposedBy,
        status: decision.data.status,
        riskLevel: decision.data.riskLevel,
      },
      timestamp: decision.data.proposedAt,
    };
  }

  private getDecisionOutcome(decision: Decision): SimilarDecision['outcome'] {
    switch (decision.data.status) {
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      case 'executed':
        return 'executed';
      case 'failed':
        return 'failed';
      default:
        return 'approved';
    }
  }

  private assessRisk(
    context: DecisionContext,
    precedents: SimilarDecision[]
  ): RiskAssessment {
    const factors: RiskFactor[] = [];
    let riskScore = 0;

    // Check for high-risk action patterns
    const actionLower = context.action.toLowerCase();
    for (const pattern of this.config.highRiskPatterns) {
      if (actionLower.includes(pattern)) {
        factors.push({
          name: 'High-Risk Action',
          description: `Action contains "${pattern}" which is typically destructive`,
          weight: 0.3,
          mitigations: ['Require additional approval', 'Create backup before proceeding'],
        });
        riskScore += 0.3;
        break;
      }
    }

    // Check for escalation patterns
    for (const pattern of this.config.escalationPatterns) {
      if (actionLower.includes(pattern) || (context.resource?.toLowerCase().includes(pattern) ?? false)) {
        factors.push({
          name: 'Elevated Privileges',
          description: `Action involves elevated privileges (${pattern})`,
          weight: 0.25,
          mitigations: ['Escalate to supervisor', 'Apply principle of least privilege'],
        });
        riskScore += 0.25;
        break;
      }
    }

    // Check precedent outcomes
    const failedPrecedents = precedents.filter((p) => p.outcome === 'failed' || p.outcome === 'rejected');
    if (failedPrecedents.length > 0 && precedents.length > 0) {
      const failureRate = failedPrecedents.length / precedents.length;
      if (failureRate > 0.3) {
        factors.push({
          name: 'High Failure Rate',
          description: `${(failureRate * 100).toFixed(0)}% of similar decisions failed or were rejected`,
          weight: failureRate * 0.4,
        });
        riskScore += failureRate * 0.4;
      }
    }

    // Check for lack of precedents
    if (precedents.length < this.config.minPrecedents) {
      factors.push({
        name: 'Limited Precedents',
        description: `Only ${precedents.length} similar decisions found (minimum: ${this.config.minPrecedents})`,
        weight: 0.2,
        mitigations: ['Request manual review', 'Start with lower-impact actions'],
      });
      riskScore += 0.2;
    }

    // Determine risk level
    let level: RiskAssessment['level'];
    if (riskScore >= 0.7) {
      level = 'critical';
    } else if (riskScore >= 0.5) {
      level = 'high';
    } else if (riskScore >= 0.25) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return {
      level,
      score: Math.min(riskScore, 1),
      factors,
    };
  }

  private determineRecommendation(
    _context: DecisionContext,
    precedents: SimilarDecision[],
    risk: RiskAssessment
  ): { action: Recommendation['recommendedAction']; confidence: number; reasoning: string } {
    // Check for escalation
    if (risk.level === 'critical') {
      return {
        action: 'escalate',
        confidence: 0.9,
        reasoning: 'Critical risk level detected. Manual review by supervisor recommended.',
      };
    }

    // Check for insufficient precedents
    if (precedents.length < this.config.minPrecedents) {
      return {
        action: 'defer',
        confidence: 0.6,
        reasoning: `Insufficient historical precedents (${precedents.length}/${this.config.minPrecedents}). More context needed.`,
      };
    }

    // Analyze precedent outcomes
    const approvedCount = precedents.filter(
      (p) => p.outcome === 'approved' || p.outcome === 'executed'
    ).length;
    const rejectedCount = precedents.filter(
      (p) => p.outcome === 'rejected' || p.outcome === 'failed'
    ).length;

    const approvalRate = approvedCount / precedents.length;
    const avgSimilarity =
      precedents.reduce((sum, p) => sum + p.similarity.score, 0) / precedents.length;

    // High approval rate with good similarity
    if (approvalRate >= 0.7 && avgSimilarity >= 0.6) {
      const confidence = Math.min(approvalRate * avgSimilarity * (1 - risk.score * 0.5), 0.95);
      return {
        action: 'approve',
        confidence,
        reasoning: `${(approvalRate * 100).toFixed(0)}% of similar decisions were approved. Average similarity: ${(avgSimilarity * 100).toFixed(0)}%.`,
      };
    }

    // High rejection rate
    if (rejectedCount / precedents.length >= 0.6) {
      const rejectionRate = rejectedCount / precedents.length;
      const confidence = Math.min(rejectionRate * avgSimilarity, 0.9);
      return {
        action: 'reject',
        confidence,
        reasoning: `${(rejectionRate * 100).toFixed(0)}% of similar decisions were rejected. Risk factors: ${risk.factors.map((f) => f.name).join(', ')}.`,
      };
    }

    // Mixed results or high risk
    if (risk.level === 'high' || approvalRate < 0.7) {
      return {
        action: 'escalate',
        confidence: 0.7,
        reasoning: `Mixed precedent outcomes (${(approvalRate * 100).toFixed(0)}% approved) with ${risk.level} risk. Escalation recommended.`,
      };
    }

    // Default to defer
    return {
      action: 'defer',
      confidence: 0.5,
      reasoning: 'Unable to make confident recommendation. Additional review recommended.',
    };
  }

  private updateStats(recommendation: Recommendation): void {
    this.stats.totalRecommendations++;
    this.stats.decisionDistribution[recommendation.recommendedAction]++;

    // Update average confidence
    const total = this.stats.totalRecommendations;
    this.stats.averageConfidence =
      (this.stats.averageConfidence * (total - 1) + recommendation.confidence) / total;
  }
}

/**
 * Create a recommendation engine
 */
export function createRecommendationEngine(
  dtg: DecisionTraceGraph,
  storage: StorageInterface,
  config?: RecommendationEngineConfig
): RecommendationEngine {
  return new RecommendationEngine(dtg, storage, config);
}
