/**
 * Recommendations Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSimilarity,
  rankBySimilarity,
  DEFAULT_CRITERIA,
  type DecisionContext,
  type SimilarDecision,
  type SimilarityScore,
} from '../index.js';

describe('Similarity', () => {
  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical contexts', () => {
      const context: DecisionContext = {
        action: 'create',
        entityType: 'User',
        resource: '/api/users',
        attributes: { role: 'admin' },
      };

      const result = calculateSimilarity(context, context);
      expect(result.score).toBe(1.0);
    });

    it('should return high score for same action', () => {
      const context1: DecisionContext = {
        action: 'create',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'create',
        attributes: {},
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.actionMatch).toBe(1.0);
    });

    it('should return 0 for action mismatch', () => {
      const context1: DecisionContext = {
        action: 'create',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'delete',
        attributes: {},
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.actionMatch).toBe(0);
    });

    it('should handle entity type matching', () => {
      const context1: DecisionContext = {
        action: 'create',
        entityType: 'User',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'create',
        entityType: 'User',
        attributes: {},
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.entityTypeMatch).toBe(1.0);
    });

    it('should handle missing entity types', () => {
      const context1: DecisionContext = {
        action: 'create',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'create',
        attributes: {},
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.entityTypeMatch).toBe(0.5);
    });

    it('should calculate resource similarity', () => {
      const context1: DecisionContext = {
        action: 'read',
        resource: '/api/users/123',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'read',
        resource: '/api/users/456',
        attributes: {},
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.resourceMatch).toBeGreaterThan(0.5);
    });

    it('should calculate attribute similarity', () => {
      const context1: DecisionContext = {
        action: 'update',
        attributes: { role: 'admin', level: 5 },
      };
      const context2: DecisionContext = {
        action: 'update',
        attributes: { role: 'admin', level: 4 },
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.attributeMatch).toBeGreaterThan(0.5);
    });

    it('should handle empty attributes', () => {
      const context1: DecisionContext = {
        action: 'create',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'create',
        attributes: {},
      };

      const result = calculateSimilarity(context1, context2);
      expect(result.breakdown.attributeMatch).toBe(1.0);
    });

    it('should use custom criteria weights', () => {
      const context1: DecisionContext = {
        action: 'create',
        entityType: 'User',
        attributes: {},
      };
      const context2: DecisionContext = {
        action: 'create',
        entityType: 'Project',
        attributes: {},
      };

      const result1 = calculateSimilarity(context1, context2, DEFAULT_CRITERIA);
      const result2 = calculateSimilarity(context1, context2, {
        ...DEFAULT_CRITERIA,
        entityTypeWeight: 0.8,
        actionWeight: 0.1,
      });

      expect(result1.score).toBeGreaterThan(result2.score);
    });
  });

  describe('rankBySimilarity', () => {
    const createSimilarDecision = (
      id: string,
      score: number,
      ageMs: number
    ): SimilarDecision => ({
      decisionId: id as any,
      similarity: {
        score,
        breakdown: { actionMatch: score, entityTypeMatch: score, resourceMatch: score, attributeMatch: score },
      },
      outcome: 'approved',
      ageMs,
    });

    it('should rank by similarity score', () => {
      const items = [
        createSimilarDecision('a', 0.5, 1000),
        createSimilarDecision('b', 0.9, 1000),
        createSimilarDecision('c', 0.7, 1000),
      ];

      const ranked = rankBySimilarity(items);

      expect(ranked[0].decisionId).toBe('b');
      expect(ranked[1].decisionId).toBe('c');
      expect(ranked[2].decisionId).toBe('a');
    });

    it('should prefer recent decisions when scores are equal', () => {
      const items = [
        createSimilarDecision('old', 0.8, 100000),
        createSimilarDecision('new', 0.8, 1000),
      ];

      const ranked = rankBySimilarity(items);

      expect(ranked[0].decisionId).toBe('new');
    });

    it('should filter by minimum similarity', () => {
      const items = [
        createSimilarDecision('a', 0.3, 1000),
        createSimilarDecision('b', 0.9, 1000),
      ];

      const ranked = rankBySimilarity(items, { ...DEFAULT_CRITERIA, minSimilarity: 0.5 });

      expect(ranked).toHaveLength(1);
      expect(ranked[0].decisionId).toBe('b');
    });

    it('should filter by max age', () => {
      const items = [
        createSimilarDecision('old', 0.9, 100 * 24 * 60 * 60 * 1000), // 100 days
        createSimilarDecision('new', 0.8, 1000),
      ];

      const ranked = rankBySimilarity(items, {
        ...DEFAULT_CRITERIA,
        maxPrecedentAge: 90 * 24 * 60 * 60 * 1000,
      });

      expect(ranked).toHaveLength(1);
      expect(ranked[0].decisionId).toBe('new');
    });

    it('should limit results', () => {
      const items = [
        createSimilarDecision('a', 0.9, 1000),
        createSimilarDecision('b', 0.8, 1000),
        createSimilarDecision('c', 0.7, 1000),
        createSimilarDecision('d', 0.6, 1000),
      ];

      const ranked = rankBySimilarity(items, { ...DEFAULT_CRITERIA, maxPrecedents: 2 });

      expect(ranked).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const ranked = rankBySimilarity([]);
      expect(ranked).toHaveLength(0);
    });
  });
});

describe('DEFAULT_CRITERIA', () => {
  it('should have valid weights summing to 1', () => {
    const sum =
      DEFAULT_CRITERIA.actionWeight +
      DEFAULT_CRITERIA.entityTypeWeight +
      DEFAULT_CRITERIA.resourceWeight +
      DEFAULT_CRITERIA.attributeWeight;

    expect(sum).toBe(1.0);
  });

  it('should have reasonable defaults', () => {
    expect(DEFAULT_CRITERIA.minSimilarity).toBeGreaterThan(0);
    expect(DEFAULT_CRITERIA.minSimilarity).toBeLessThan(1);
    expect(DEFAULT_CRITERIA.maxPrecedentAge).toBeGreaterThan(0);
    expect(DEFAULT_CRITERIA.maxPrecedents).toBeGreaterThan(0);
  });
});

describe('Edge Cases', () => {
  it('should handle context with all undefined optionals', () => {
    const context: DecisionContext = {
      action: 'test',
      attributes: {},
    };

    const result = calculateSimilarity(context, context);
    expect(result.score).toBeDefined();
  });

  it('should handle numeric attribute differences', () => {
    const context1: DecisionContext = {
      action: 'test',
      attributes: { count: 100 },
    };
    const context2: DecisionContext = {
      action: 'test',
      attributes: { count: 110 },
    };

    const result = calculateSimilarity(context1, context2);
    expect(result.breakdown.attributeMatch).toBeGreaterThan(0.8);
  });

  it('should handle string attribute differences', () => {
    const context1: DecisionContext = {
      action: 'test',
      attributes: { description: 'Create new user account' },
    };
    const context2: DecisionContext = {
      action: 'test',
      attributes: { description: 'Create new admin account' },
    };

    const result = calculateSimilarity(context1, context2);
    expect(result.breakdown.attributeMatch).toBeGreaterThan(0.5);
  });

  it('should handle resource path similarity', () => {
    const context1: DecisionContext = {
      action: 'read',
      resource: '/api/v1/users/123/profile',
      attributes: {},
    };
    const context2: DecisionContext = {
      action: 'read',
      resource: '/api/v1/users/456/profile',
      attributes: {},
    };

    const result = calculateSimilarity(context1, context2);
    expect(result.breakdown.resourceMatch).toBeGreaterThan(0.8);
  });

  it('should handle completely different resources', () => {
    const context1: DecisionContext = {
      action: 'read',
      resource: '/users/list',
      attributes: {},
    };
    const context2: DecisionContext = {
      action: 'read',
      resource: '/products/catalog',
      attributes: {},
    };

    const result = calculateSimilarity(context1, context2);
    expect(result.breakdown.resourceMatch).toBeLessThan(0.5);
  });
});
