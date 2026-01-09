# @contextgraph/recommendations - Decision Recommendations Package

Similarity-based decision recommendations for ContextGraph. Analyzes historical decisions to provide intelligent recommendations with risk assessment and confidence scoring.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
  - [Decision Context](#decision-context)
  - [Similarity Matching](#similarity-matching)
  - [Risk Assessment](#risk-assessment)
- [API Reference](#api-reference)
  - [RecommendationEngine](#recommendationengine)
  - [calculateSimilarity](#calculatesimilarity)
  - [rankBySimilarity](#rankbysimilarity)
- [Configuration](#configuration)
  - [Matching Criteria](#matching-criteria)
  - [Risk Patterns](#risk-patterns)
- [Recommendation Types](#recommendation-types)
- [Feedback Loop](#feedback-loop)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

The recommendations package provides:

| Component | Purpose |
|-----------|---------|
| **RecommendationEngine** | Find similar decisions and generate recommendations |
| **Similarity Calculator** | Compare decision contexts with configurable weights |
| **Risk Assessor** | Evaluate risk based on patterns and precedent outcomes |
| **Feedback System** | Track accuracy and improve over time |

## Installation

```bash
pnpm add @contextgraph/recommendations
```

## Core Concepts

### Decision Context

A decision context captures the key attributes of a decision request:

```typescript
interface DecisionContext {
  /** Action being requested (e.g., 'create', 'delete', 'approve') */
  action: string;

  /** Type of entity involved (optional) */
  entityType?: string;

  /** Resource path or identifier (optional) */
  resource?: string;

  /** Additional attributes for matching */
  attributes: Record<string, unknown>;

  /** When the decision was made (optional) */
  timestamp?: number;
}
```

### Similarity Matching

Similarity is calculated across four dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Action** | 40% | Exact match of action type |
| **Entity Type** | 20% | Match of entity type |
| **Resource** | 20% | Path similarity (prefix matching) |
| **Attributes** | 20% | Jaccard similarity of attributes |

### Risk Assessment

Risk is evaluated based on:

1. **Action Patterns** - Destructive actions (delete, destroy, revoke)
2. **Privilege Patterns** - Elevated access (admin, root, sudo)
3. **Precedent Outcomes** - Historical failure/rejection rates
4. **Precedent Count** - Lack of historical data

## API Reference

### RecommendationEngine

The main class for generating recommendations.

```typescript
class RecommendationEngine {
  constructor(
    dtg: DecisionTraceGraph,
    storage: StorageInterface,
    config?: RecommendationEngineConfig
  );

  // Find similar past decisions
  async findSimilarDecisions(context: DecisionContext): Promise<Result<SimilarDecision[]>>;

  // Get a recommendation
  async recommend(context: DecisionContext): Promise<Result<Recommendation>>;

  // Explain a recommendation
  explainRecommendation(recommendationId: string): Result<string>;

  // Submit feedback on a recommendation
  submitFeedback(feedback: RecommendationFeedback): Result<void>;

  // Get statistics
  getStats(): RecommendationStats;

  // Update matching criteria
  setCriteria(criteria: Partial<MatchingCriteria>): void;
}
```

#### RecommendationEngineConfig

```typescript
interface RecommendationEngineConfig {
  /** Matching criteria overrides */
  criteria?: Partial<MatchingCriteria>;

  /** Minimum precedents for confident recommendation (default: 3) */
  minPrecedents?: number;

  /** High-risk action patterns (default: ['delete', 'destroy', 'terminate', 'revoke', 'disable']) */
  highRiskPatterns?: string[];

  /** Escalation-required patterns (default: ['admin', 'root', 'sudo', 'override']) */
  escalationPatterns?: string[];
}
```

#### Recommendation

```typescript
interface Recommendation {
  /** Unique recommendation ID */
  id: string;

  /** Recommended action */
  recommendedAction: 'approve' | 'reject' | 'defer' | 'escalate';

  /** Confidence score (0-1) */
  confidence: number;

  /** Human-readable reasoning */
  reasoning: string;

  /** Similar historical decisions */
  precedents: SimilarDecision[];

  /** Risk assessment */
  risk: RiskAssessment;

  /** When generated */
  generatedAt: number;
}
```

#### SimilarDecision

```typescript
interface SimilarDecision {
  /** Decision ID from DTG */
  decisionId: DecisionId;

  /** Similarity score details */
  similarity: SimilarityScore;

  /** Outcome of the decision */
  outcome: 'approved' | 'rejected' | 'executed' | 'failed';

  /** Age of decision in milliseconds */
  ageMs: number;
}
```

#### RiskAssessment

```typescript
interface RiskAssessment {
  /** Overall risk level */
  level: 'low' | 'medium' | 'high' | 'critical';

  /** Risk score (0-1) */
  score: number;

  /** Individual risk factors */
  factors: RiskFactor[];
}

interface RiskFactor {
  name: string;
  description: string;
  weight: number;
  mitigations?: string[];
}
```

**Example:**

```typescript
import { createRecommendationEngine } from '@contextgraph/recommendations';
import { DecisionTraceGraph } from '@contextgraph/dtg';

const dtg = new DecisionTraceGraph(storage);
const engine = createRecommendationEngine(dtg, storage);

// Get recommendation for a decision
const result = await engine.recommend({
  action: 'delete',
  entityType: 'user',
  resource: '/api/users/123',
  attributes: {
    role: 'admin',
    department: 'engineering',
  },
});

if (result.ok) {
  const rec = result.value;
  console.log(`Recommendation: ${rec.recommendedAction}`);
  console.log(`Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
  console.log(`Reasoning: ${rec.reasoning}`);
  console.log(`Risk Level: ${rec.risk.level}`);
}
```

### calculateSimilarity

Calculate similarity between two decision contexts.

```typescript
function calculateSimilarity(
  context1: DecisionContext,
  context2: DecisionContext,
  criteria?: MatchingCriteria
): SimilarityScore
```

#### SimilarityScore

```typescript
interface SimilarityScore {
  /** Overall similarity (0-1) */
  score: number;

  /** Breakdown by dimension */
  breakdown: {
    actionMatch: number;
    entityTypeMatch: number;
    resourceMatch: number;
    attributeMatch: number;
  };
}
```

**Example:**

```typescript
import { calculateSimilarity, DEFAULT_CRITERIA } from '@contextgraph/recommendations';

const context1: DecisionContext = {
  action: 'create',
  entityType: 'user',
  resource: '/api/users',
  attributes: { role: 'admin' },
};

const context2: DecisionContext = {
  action: 'create',
  entityType: 'user',
  resource: '/api/users/profile',
  attributes: { role: 'admin', level: 5 },
};

const similarity = calculateSimilarity(context1, context2);

console.log(`Overall: ${similarity.score}`);
console.log(`Action: ${similarity.breakdown.actionMatch}`);       // 1.0 (exact match)
console.log(`Entity: ${similarity.breakdown.entityTypeMatch}`);   // 1.0 (exact match)
console.log(`Resource: ${similarity.breakdown.resourceMatch}`);   // ~0.66 (prefix match)
console.log(`Attributes: ${similarity.breakdown.attributeMatch}`); // ~0.5 (partial overlap)
```

### rankBySimilarity

Rank and filter similar decisions.

```typescript
function rankBySimilarity<T extends { similarity: SimilarityScore; ageMs: number }>(
  items: T[],
  criteria?: MatchingCriteria
): T[]
```

**Example:**

```typescript
import { rankBySimilarity, DEFAULT_CRITERIA } from '@contextgraph/recommendations';

const decisions = [
  { decisionId: 'a', similarity: { score: 0.7, ... }, ageMs: 1000, outcome: 'approved' },
  { decisionId: 'b', similarity: { score: 0.9, ... }, ageMs: 2000, outcome: 'approved' },
  { decisionId: 'c', similarity: { score: 0.8, ... }, ageMs: 500, outcome: 'rejected' },
];

const ranked = rankBySimilarity(decisions, {
  ...DEFAULT_CRITERIA,
  minSimilarity: 0.5,
  maxPrecedentAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxPrecedents: 5,
});

// Returns sorted by score (highest first), filtered by criteria
```

## Configuration

### Matching Criteria

```typescript
interface MatchingCriteria {
  /** Weight for action matching (default: 0.4) */
  actionWeight: number;

  /** Weight for entity type matching (default: 0.2) */
  entityTypeWeight: number;

  /** Weight for resource matching (default: 0.2) */
  resourceWeight: number;

  /** Weight for attribute matching (default: 0.2) */
  attributeWeight: number;

  /** Minimum similarity to consider (default: 0.5) */
  minSimilarity: number;

  /** Maximum age of precedents in ms (default: 90 days) */
  maxPrecedentAge: number;

  /** Maximum number of precedents to return (default: 10) */
  maxPrecedents: number;
}
```

**Default Values:**

```typescript
const DEFAULT_CRITERIA: MatchingCriteria = {
  actionWeight: 0.4,
  entityTypeWeight: 0.2,
  resourceWeight: 0.2,
  attributeWeight: 0.2,
  minSimilarity: 0.5,
  maxPrecedentAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  maxPrecedents: 10,
};
```

### Risk Patterns

Configure which patterns trigger risk flags:

```typescript
const engine = createRecommendationEngine(dtg, storage, {
  // Actions that increase risk score
  highRiskPatterns: [
    'delete',
    'destroy',
    'terminate',
    'revoke',
    'disable',
    'purge',
    'wipe',
  ],

  // Patterns requiring escalation
  escalationPatterns: [
    'admin',
    'root',
    'sudo',
    'override',
    'bypass',
    'force',
  ],

  // Minimum precedents for confident recommendation
  minPrecedents: 5,
});
```

## Recommendation Types

The engine returns one of four recommendation types:

### Approve

Returned when:
- ≥70% of similar decisions were approved/executed
- Average similarity ≥60%
- Risk level is low or medium

```typescript
{
  recommendedAction: 'approve',
  confidence: 0.85,
  reasoning: '85% of similar decisions were approved. Average similarity: 72%.',
}
```

### Reject

Returned when:
- ≥60% of similar decisions were rejected/failed
- Clear pattern of failures

```typescript
{
  recommendedAction: 'reject',
  confidence: 0.78,
  reasoning: '65% of similar decisions were rejected. Risk factors: High-Risk Action.',
}
```

### Defer

Returned when:
- Insufficient precedents (below minPrecedents threshold)
- Mixed results without clear pattern
- Low confidence in recommendation

```typescript
{
  recommendedAction: 'defer',
  confidence: 0.6,
  reasoning: 'Insufficient historical precedents (2/5). More context needed.',
}
```

### Escalate

Returned when:
- Critical risk level detected
- High risk level with mixed precedent outcomes
- Escalation patterns detected in action or resource

```typescript
{
  recommendedAction: 'escalate',
  confidence: 0.9,
  reasoning: 'Critical risk level detected. Manual review by supervisor recommended.',
}
```

## Feedback Loop

Track recommendation accuracy and improve over time:

### Submitting Feedback

```typescript
import type { RecommendationFeedback } from '@contextgraph/recommendations';

const feedback: RecommendationFeedback = {
  recommendationId: 'rec_abc123',
  followed: true,
  actualDecision: 'approved',
  outcome: 'success',
  comments: 'Worked as expected',
  submittedAt: Date.now(),
};

engine.submitFeedback(feedback);
```

### Tracking Statistics

```typescript
interface RecommendationStats {
  /** Total recommendations generated */
  totalRecommendations: number;

  /** How many recommendations were followed */
  recommendationsFollowed: number;

  /** Average confidence score */
  averageConfidence: number;

  /** Accuracy (correct predictions / total with feedback) */
  accuracy: number;

  /** Distribution of recommendation types */
  decisionDistribution: {
    approve: number;
    reject: number;
    defer: number;
    escalate: number;
  };
}

const stats = engine.getStats();
console.log(`Accuracy: ${(stats.accuracy * 100).toFixed(1)}%`);
console.log(`Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
```

## Examples

### API Request Approval

```typescript
import { createRecommendationEngine } from '@contextgraph/recommendations';

async function shouldApproveAPIRequest(request: {
  method: string;
  path: string;
  user: { role: string; department: string };
}) {
  const engine = createRecommendationEngine(dtg, storage);

  const recommendation = await engine.recommend({
    action: request.method.toLowerCase(),
    resource: request.path,
    attributes: {
      userRole: request.user.role,
      department: request.user.department,
    },
  });

  if (!recommendation.ok) {
    return { allowed: false, reason: 'Failed to generate recommendation' };
  }

  const rec = recommendation.value;

  switch (rec.recommendedAction) {
    case 'approve':
      return { allowed: true, confidence: rec.confidence };

    case 'reject':
      return { allowed: false, reason: rec.reasoning };

    case 'escalate':
      return { allowed: false, requiresApproval: true, reason: rec.reasoning };

    case 'defer':
    default:
      return { allowed: false, requiresReview: true, reason: rec.reasoning };
  }
}
```

### Workflow Step Recommendation

```typescript
async function recommendWorkflowAction(
  workflowId: string,
  step: string,
  parameters: Record<string, unknown>
) {
  const engine = createRecommendationEngine(dtg, storage, {
    minPrecedents: 5,
    criteria: {
      actionWeight: 0.3,
      attributeWeight: 0.4, // Higher weight on parameters
    },
  });

  const result = await engine.recommend({
    action: step,
    entityType: 'workflow',
    resource: `/workflows/${workflowId}`,
    attributes: parameters,
  });

  if (!result.ok) {
    return null;
  }

  // Generate explanation
  const explanation = engine.explainRecommendation(result.value.id);

  return {
    recommendation: result.value,
    explanation: explanation.ok ? explanation.value : null,
  };
}
```

### Risk-Aware Batch Processing

```typescript
async function processBatch(items: Array<{ action: string; target: string }>) {
  const engine = createRecommendationEngine(dtg, storage);
  const results = [];

  for (const item of items) {
    const rec = await engine.recommend({
      action: item.action,
      resource: item.target,
      attributes: {},
    });

    if (!rec.ok) {
      results.push({ item, status: 'error', error: rec.error });
      continue;
    }

    // Auto-approve low-risk items
    if (
      rec.value.recommendedAction === 'approve' &&
      rec.value.risk.level === 'low' &&
      rec.value.confidence >= 0.8
    ) {
      results.push({ item, status: 'auto-approved' });
      continue;
    }

    // Queue high-risk items for manual review
    if (rec.value.risk.level === 'high' || rec.value.risk.level === 'critical') {
      results.push({ item, status: 'manual-review', recommendation: rec.value });
      continue;
    }

    // Default handling
    results.push({ item, status: 'pending', recommendation: rec.value });
  }

  return results;
}
```

### Custom Similarity Weights

```typescript
// For permission-related decisions, weight action heavily
const permissionEngine = createRecommendationEngine(dtg, storage, {
  criteria: {
    actionWeight: 0.5,    // Most important
    entityTypeWeight: 0.3, // Type of resource matters
    resourceWeight: 0.1,   // Specific path less important
    attributeWeight: 0.1,  // Attributes less important
  },
});

// For data operations, weight resource path heavily
const dataEngine = createRecommendationEngine(dtg, storage, {
  criteria: {
    actionWeight: 0.2,
    entityTypeWeight: 0.1,
    resourceWeight: 0.5,   // Path is critical
    attributeWeight: 0.2,
  },
});
```

### Feedback Integration

```typescript
class RecommendationService {
  private engine: RecommendationEngine;

  constructor(dtg: DecisionTraceGraph, storage: StorageInterface) {
    this.engine = createRecommendationEngine(dtg, storage);
  }

  async getRecommendation(context: DecisionContext) {
    return this.engine.recommend(context);
  }

  async recordDecisionOutcome(
    recommendationId: string,
    actualDecision: 'approved' | 'rejected',
    wasSuccessful: boolean
  ) {
    const recommendation = this.engine.explainRecommendation(recommendationId);

    if (!recommendation.ok) {
      return;
    }

    // Determine if recommendation was followed
    const wasFollowed =
      (actualDecision === 'approved' && recommendation.value.includes('approve')) ||
      (actualDecision === 'rejected' && recommendation.value.includes('reject'));

    this.engine.submitFeedback({
      recommendationId,
      followed: wasFollowed,
      actualDecision,
      outcome: wasSuccessful ? 'success' : 'failure',
      submittedAt: Date.now(),
    });
  }

  getAccuracyReport() {
    const stats = this.engine.getStats();

    return {
      accuracy: `${(stats.accuracy * 100).toFixed(1)}%`,
      totalRecommendations: stats.totalRecommendations,
      followRate: `${((stats.recommendationsFollowed / stats.totalRecommendations) * 100).toFixed(1)}%`,
      distribution: stats.decisionDistribution,
    };
  }
}
```

## Best Practices

### 1. Populate Decision History

Recommendations require historical data. Ensure you're recording decisions:

```typescript
// Record decisions for recommendation training
await dtg.recordDecision({
  type: 'workflow_step',
  title: 'API Request: DELETE /users/123',
  proposedBy: agentId,
  riskLevel: 'medium',
});

// Track outcome
await dtg.executeDecision(decisionId, { success: true });
```

### 2. Tune Weights for Your Domain

Different domains need different weight configurations:

```typescript
// Financial domain - conservative, action-focused
{ actionWeight: 0.5, entityTypeWeight: 0.2, resourceWeight: 0.2, attributeWeight: 0.1 }

// Content management - resource-focused
{ actionWeight: 0.2, entityTypeWeight: 0.2, resourceWeight: 0.4, attributeWeight: 0.2 }

// User management - attribute-focused
{ actionWeight: 0.3, entityTypeWeight: 0.2, resourceWeight: 0.1, attributeWeight: 0.4 }
```

### 3. Use Appropriate Confidence Thresholds

```typescript
// High-stakes decisions
if (rec.confidence < 0.85) {
  // Require manual review
}

// Low-stakes decisions
if (rec.confidence >= 0.7 && rec.risk.level === 'low') {
  // Auto-approve
}
```

### 4. Monitor and Improve

```typescript
// Regular accuracy checks
setInterval(() => {
  const stats = engine.getStats();

  if (stats.accuracy < 0.7) {
    console.warn('Recommendation accuracy dropping');
    // Consider retraining or adjusting criteria
  }
}, 24 * 60 * 60 * 1000); // Daily
```

### 5. Handle Edge Cases

```typescript
async function getRecommendationSafely(context: DecisionContext) {
  const result = await engine.recommend(context);

  if (!result.ok) {
    // Fallback to conservative default
    return {
      recommendedAction: 'defer' as const,
      confidence: 0,
      reasoning: 'Unable to generate recommendation',
      risk: { level: 'medium' as const, score: 0.5, factors: [] },
    };
  }

  // Never auto-approve with no precedents
  if (result.value.precedents.length === 0) {
    return {
      ...result.value,
      recommendedAction: 'defer' as const,
      reasoning: 'No historical precedents available',
    };
  }

  return result.value;
}
```

### 6. Attribute Standardization

Ensure consistent attribute naming for better matching:

```typescript
// Good - consistent naming
{ action: 'create', attributes: { userRole: 'admin', department: 'engineering' } }
{ action: 'create', attributes: { userRole: 'user', department: 'marketing' } }

// Bad - inconsistent naming
{ action: 'create', attributes: { role: 'admin', dept: 'engineering' } }
{ action: 'create', attributes: { userRole: 'user', department: 'marketing' } }
```
