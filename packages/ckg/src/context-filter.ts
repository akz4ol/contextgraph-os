/**
 * Context Filtering Engine
 *
 * Filters claims by contextual dimensions: time, scope, jurisdiction.
 * Provides deterministic filtering for consistent results.
 */

import {
  type Timestamp,
  type Jurisdiction,
  type Scope,
} from '@contextgraph/core';
import { type Claim } from './claim.js';

/**
 * Filter options for context-based queries
 */
export interface ContextFilterOptions {
  /** Point in time for temporal filtering */
  asOf?: Timestamp;
  /** Time range for temporal filtering */
  timeRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  /** Jurisdiction filter */
  jurisdiction?: Jurisdiction;
  /** Scope filter */
  scope?: Scope;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Include claims that overlap with the time range */
  includeOverlapping?: boolean;
}

/**
 * Result of filtering claims
 */
export interface FilteredClaimSet {
  /** Claims that match the filter */
  readonly claims: readonly Claim[];
  /** Claims that were excluded */
  readonly excluded: readonly Claim[];
  /** Filter options that were applied */
  readonly appliedFilters: ContextFilterOptions;
  /** Timestamp when filtering was performed */
  readonly filteredAt: Timestamp;
}

/**
 * Context Filter
 *
 * Applies contextual filters to claim sets.
 */
export class ContextFilter {
  /**
   * Filter claims by context dimensions
   */
  filter(claims: readonly Claim[], options: ContextFilterOptions): FilteredClaimSet {
    const filteredAt = Date.now() as Timestamp;
    const matching: Claim[] = [];
    const excluded: Claim[] = [];

    for (const claim of claims) {
      if (this.matchesCriteria(claim, options)) {
        matching.push(claim);
      } else {
        excluded.push(claim);
      }
    }

    return {
      claims: matching,
      excluded,
      appliedFilters: options,
      filteredAt,
    };
  }

  /**
   * Filter claims valid at a specific point in time
   */
  filterAsOf(claims: readonly Claim[], timestamp: Timestamp): FilteredClaimSet {
    return this.filter(claims, { asOf: timestamp });
  }

  /**
   * Filter claims by jurisdiction
   */
  filterByJurisdiction(claims: readonly Claim[], jurisdiction: Jurisdiction): FilteredClaimSet {
    return this.filter(claims, { jurisdiction });
  }

  /**
   * Filter claims by scope
   */
  filterByScope(claims: readonly Claim[], scope: Scope): FilteredClaimSet {
    return this.filter(claims, { scope });
  }

  /**
   * Find conflicting claims (same subject+predicate, different objects)
   */
  findConflicts(claims: readonly Claim[]): ReadonlyMap<string, readonly Claim[]> {
    const grouped = new Map<string, Claim[]>();

    for (const claim of claims) {
      const key = `${claim.data.subjectId}:${claim.data.predicate}`;
      const existing = grouped.get(key) ?? [];
      existing.push(claim);
      grouped.set(key, existing);
    }

    // Return only groups with multiple claims (potential conflicts)
    const conflicts = new Map<string, readonly Claim[]>();
    for (const [key, group] of grouped) {
      if (group.length > 1 && this.hasConflictingObjects(group)) {
        conflicts.set(key, group);
      }
    }

    return conflicts;
  }

  /**
   * Check if a claim matches filter criteria
   */
  private matchesCriteria(claim: Claim, options: ContextFilterOptions): boolean {
    const context = claim.data.context;

    // Temporal filtering
    if (options.asOf !== undefined) {
      if (!claim.isValidAt(options.asOf)) {
        return false;
      }
    }

    if (options.timeRange !== undefined) {
      const { start, end } = options.timeRange;
      const claimStart = context.temporal.start;
      const claimEnd = context.temporal.end;

      if (options.includeOverlapping === true) {
        // Include if any overlap exists
        if (claimEnd !== null && claimEnd < start) return false;
        if (claimStart > end) return false;
      } else {
        // Require claim to be fully within range
        if (claimStart < start) return false;
        if (claimEnd !== null && claimEnd > end) return false;
        if (claimEnd === null) return false; // Unbounded claims excluded from strict range
      }
    }

    // Jurisdiction filtering
    if (options.jurisdiction !== undefined) {
      if (context.jurisdiction !== options.jurisdiction) {
        return false;
      }
    }

    // Scope filtering
    if (options.scope !== undefined) {
      if (context.scope !== options.scope) {
        return false;
      }
    }

    // Confidence filtering
    if (options.minConfidence !== undefined) {
      const confidence = context.confidence ?? 1; // Default to 1 if not specified
      if (confidence < options.minConfidence) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a group of claims has conflicting objects
   */
  private hasConflictingObjects(claims: readonly Claim[]): boolean {
    const objects = new Set<string>();

    for (const claim of claims) {
      const objectKey = claim.data.objectId ?? JSON.stringify(claim.data.objectValue);
      if (objects.has(objectKey)) {
        continue; // Same object, not a conflict
      }
      if (objects.size > 0) {
        return true; // Different object found
      }
      objects.add(objectKey);
    }

    return false;
  }
}

/**
 * Merge multiple filtered claim sets
 */
export function mergeFilteredSets(...sets: readonly FilteredClaimSet[]): FilteredClaimSet {
  const allClaims: Claim[] = [];
  const allExcluded: Claim[] = [];
  const seenIds = new Set<string>();

  for (const set of sets) {
    for (const claim of set.claims) {
      if (!seenIds.has(claim.data.id)) {
        allClaims.push(claim);
        seenIds.add(claim.data.id);
      }
    }
    for (const claim of set.excluded) {
      if (!seenIds.has(claim.data.id)) {
        allExcluded.push(claim);
        seenIds.add(claim.data.id);
      }
    }
  }

  return {
    claims: allClaims,
    excluded: allExcluded,
    appliedFilters: {}, // Merged sets don't have a single filter
    filteredAt: Date.now() as Timestamp,
  };
}
