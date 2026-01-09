/**
 * Similarity Matching
 *
 * Calculates similarity between decision contexts
 */

import type { DecisionContext, SimilarityScore, MatchingCriteria } from './types.js';

/**
 * Default matching criteria
 */
export const DEFAULT_CRITERIA: MatchingCriteria = {
  actionWeight: 0.4,
  entityTypeWeight: 0.2,
  resourceWeight: 0.2,
  attributeWeight: 0.2,
  minSimilarity: 0.5,
  maxPrecedentAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  maxPrecedents: 10,
};

/**
 * Calculate similarity between two decision contexts
 */
export function calculateSimilarity(
  context1: DecisionContext,
  context2: DecisionContext,
  criteria: MatchingCriteria = DEFAULT_CRITERIA
): SimilarityScore {
  const actionMatch = context1.action === context2.action ? 1.0 : 0.0;

  const entityTypeMatch =
    context1.entityType !== undefined &&
    context2.entityType !== undefined &&
    context1.entityType === context2.entityType
      ? 1.0
      : context1.entityType === undefined && context2.entityType === undefined
        ? 0.5
        : 0.0;

  const resourceMatch =
    context1.resource !== undefined &&
    context2.resource !== undefined &&
    context1.resource === context2.resource
      ? 1.0
      : context1.resource === undefined && context2.resource === undefined
        ? 0.5
        : calculateResourceSimilarity(context1.resource, context2.resource);

  const attributeMatch = calculateAttributeSimilarity(
    context1.attributes,
    context2.attributes
  );

  const score =
    actionMatch * criteria.actionWeight +
    entityTypeMatch * criteria.entityTypeWeight +
    resourceMatch * criteria.resourceWeight +
    attributeMatch * criteria.attributeWeight;

  return {
    score,
    breakdown: {
      actionMatch,
      entityTypeMatch,
      resourceMatch,
      attributeMatch,
    },
  };
}

/**
 * Calculate similarity between two resource strings
 */
function calculateResourceSimilarity(
  resource1: string | undefined,
  resource2: string | undefined
): number {
  if (resource1 === undefined || resource2 === undefined) {
    return 0;
  }

  // Check for exact match
  if (resource1 === resource2) {
    return 1.0;
  }

  // Check for prefix match (e.g., /api/users vs /api/users/123)
  const parts1 = resource1.split('/').filter((p) => p.length > 0);
  const parts2 = resource2.split('/').filter((p) => p.length > 0);

  let matchingParts = 0;
  const minParts = Math.min(parts1.length, parts2.length);

  for (let i = 0; i < minParts; i++) {
    const part1 = parts1[i];
    const part2 = parts2[i];
    if (part1 === undefined || part2 === undefined) break;

    if (part1 === part2) {
      matchingParts++;
    } else if (isIdLike(part1) && isIdLike(part2)) {
      // Both are IDs, consider partial match
      matchingParts += 0.5;
    } else {
      break;
    }
  }

  return matchingParts / Math.max(parts1.length, parts2.length);
}

/**
 * Check if a string looks like an ID
 */
function isIdLike(str: string): boolean {
  // UUID, numeric ID, or typical ID patterns
  return /^[0-9a-f-]{8,}$/i.test(str) || /^\d+$/.test(str) || /^[a-z]+_[a-z0-9]+$/i.test(str);
}

/**
 * Calculate similarity between attribute objects
 */
function calculateAttributeSimilarity(
  attrs1: Record<string, unknown>,
  attrs2: Record<string, unknown>
): number {
  const keys1 = Object.keys(attrs1);
  const keys2 = Object.keys(attrs2);

  if (keys1.length === 0 && keys2.length === 0) {
    return 1.0;
  }

  const allKeys = new Set([...keys1, ...keys2]);
  let matchingScore = 0;

  for (const key of allKeys) {
    const val1 = attrs1[key];
    const val2 = attrs2[key];

    if (val1 === undefined || val2 === undefined) {
      // Key missing in one - partial penalty
      matchingScore += 0.25;
    } else if (val1 === val2) {
      // Exact match
      matchingScore += 1.0;
    } else if (typeof val1 === typeof val2) {
      // Same type but different value
      if (typeof val1 === 'number' && typeof val2 === 'number') {
        // For numbers, use relative difference
        const max = Math.max(Math.abs(val1), Math.abs(val2), 1);
        const diff = Math.abs(val1 - val2) / max;
        matchingScore += Math.max(0, 1 - diff);
      } else if (typeof val1 === 'string' && typeof val2 === 'string') {
        // For strings, use Jaccard similarity of words
        matchingScore += jaccardSimilarity(val1, val2);
      } else {
        matchingScore += 0.5;
      }
    }
  }

  return matchingScore / allKeys.size;
}

/**
 * Calculate Jaccard similarity between two strings
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter((w) => w.length > 0));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter((w) => w.length > 0));

  if (words1.size === 0 && words2.size === 0) {
    return 1.0;
  }

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Rank similar decisions by relevance
 */
export function rankBySimilarity<T extends { similarity: SimilarityScore; ageMs: number }>(
  items: T[],
  criteria: MatchingCriteria = DEFAULT_CRITERIA
): T[] {
  // Filter by minimum similarity and age
  const filtered = items.filter(
    (item) =>
      item.similarity.score >= criteria.minSimilarity &&
      item.ageMs <= criteria.maxPrecedentAge
  );

  // Sort by score (descending), then by age (ascending for recency)
  return filtered
    .sort((a, b) => {
      const scoreDiff = b.similarity.score - a.similarity.score;
      if (Math.abs(scoreDiff) > 0.01) {
        return scoreDiff;
      }
      return a.ageMs - b.ageMs;
    })
    .slice(0, criteria.maxPrecedents);
}
