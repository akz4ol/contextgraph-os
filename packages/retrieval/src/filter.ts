/**
 * Context Filter
 *
 * Applies filters to retrieved context items.
 */

import type { Timestamp, Scope, Jurisdiction } from '@contextgraph/core';
import type { Entity, Claim } from '@contextgraph/ckg';
import type { ProvenanceEntry } from '@contextgraph/provenance';
import type { ContextFilter, TemporalFilter, ScopeFilter, ConfidenceFilter } from './types.js';

/**
 * Context Filter Engine
 *
 * Applies various filters to context items.
 */
export class ContextFilterEngine {
  /**
   * Apply all filters to entities
   */
  filterEntities(entities: readonly Entity[], filter: ContextFilter): readonly Entity[] {
    let result: readonly Entity[] = entities;

    // Filter by entity types
    if (filter.entityTypes !== undefined && filter.entityTypes.length > 0) {
      result = result.filter((e) => filter.entityTypes!.includes(e.data.type));
    }

    // Apply limit
    if (filter.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Apply all filters to claims
   */
  filterClaims(claims: readonly Claim[], filter: ContextFilter): readonly Claim[] {
    let result: readonly Claim[] = claims;

    // Filter by temporal constraints
    result = this.applyTemporalFilter(result, filter);

    // Filter by scope
    result = this.applyScopeFilter(result, filter);

    // Filter by confidence
    result = this.applyConfidenceFilter(result, filter);

    // Filter by predicates
    if (filter.predicates !== undefined && filter.predicates.length > 0) {
      result = result.filter((c) => filter.predicates!.includes(c.data.predicate));
    }

    // Apply limit
    if (filter.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Apply temporal filter to claims
   */
  applyTemporalFilter(claims: readonly Claim[], filter: TemporalFilter): readonly Claim[] {
    if (filter.asOf === undefined && filter.from === undefined && filter.to === undefined) {
      return claims;
    }

    return claims.filter((claim) => {
      const temporal = claim.data.context.temporal;

      // Point-in-time query
      if (filter.asOf !== undefined) {
        // Claim must be valid at the specified time
        if (temporal.start > filter.asOf) {
          return false;
        }
        if (temporal.end !== null && temporal.end < filter.asOf) {
          return false;
        }
      }

      // Range query
      if (filter.from !== undefined) {
        if (temporal.end !== null && temporal.end < filter.from) {
          return false;
        }
      }

      if (filter.to !== undefined) {
        if (temporal.start > filter.to) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply scope and jurisdiction filter to claims
   */
  applyScopeFilter(claims: readonly Claim[], filter: ScopeFilter): readonly Claim[] {
    if (filter.scope === undefined && filter.jurisdiction === undefined) {
      return claims;
    }

    return claims.filter((claim) => {
      const context = claim.data.context;

      if (filter.scope !== undefined && context.scope !== undefined) {
        if (context.scope !== filter.scope) {
          return false;
        }
      }

      if (filter.jurisdiction !== undefined && context.jurisdiction !== undefined) {
        if (context.jurisdiction !== filter.jurisdiction) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply confidence filter to claims
   */
  applyConfidenceFilter(claims: readonly Claim[], filter: ConfidenceFilter): readonly Claim[] {
    if (filter.minConfidence === undefined) {
      return claims;
    }

    return claims.filter((claim) => {
      const confidence = claim.data.context.confidence;
      if (confidence === undefined) {
        return true; // No confidence specified, include it
      }
      return confidence >= filter.minConfidence!;
    });
  }

  /**
   * Apply temporal filter to provenance entries
   */
  filterProvenance(entries: readonly ProvenanceEntry[], filter: TemporalFilter): readonly ProvenanceEntry[] {
    if (filter.asOf === undefined && filter.from === undefined && filter.to === undefined) {
      return entries;
    }

    return entries.filter((entry) => {
      if (filter.asOf !== undefined) {
        if (entry.data.timestamp > filter.asOf) {
          return false;
        }
      }

      if (filter.from !== undefined) {
        if (entry.data.timestamp < filter.from) {
          return false;
        }
      }

      if (filter.to !== undefined) {
        if (entry.data.timestamp > filter.to) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Check if a claim is valid at a specific time
   */
  isClaimValidAt(claim: Claim, timestamp: Timestamp): boolean {
    const temporal = claim.data.context.temporal;
    if (temporal.start > timestamp) {
      return false;
    }
    if (temporal.end !== null && temporal.end < timestamp) {
      return false;
    }
    return true;
  }

  /**
   * Check if a claim matches scope requirements
   */
  claimMatchesScope(claim: Claim, scope?: Scope, jurisdiction?: Jurisdiction): boolean {
    const context = claim.data.context;

    if (scope !== undefined && context.scope !== undefined && context.scope !== scope) {
      return false;
    }

    if (jurisdiction !== undefined && context.jurisdiction !== undefined && context.jurisdiction !== jurisdiction) {
      return false;
    }

    return true;
  }

  /**
   * Merge multiple filters
   */
  mergeFilters(...filters: readonly ContextFilter[]): ContextFilter {
    let result: ContextFilter = {};

    for (const filter of filters) {
      // Use the most restrictive temporal constraints
      if (filter.asOf !== undefined) {
        result = { ...result, asOf: filter.asOf };
      }
      if (filter.from !== undefined) {
        if (result.from === undefined || filter.from > result.from) {
          result = { ...result, from: filter.from };
        }
      }
      if (filter.to !== undefined) {
        if (result.to === undefined || filter.to < result.to) {
          result = { ...result, to: filter.to };
        }
      }

      // Use the most restrictive scope/jurisdiction
      if (filter.scope !== undefined) {
        result = { ...result, scope: filter.scope };
      }
      if (filter.jurisdiction !== undefined) {
        result = { ...result, jurisdiction: filter.jurisdiction };
      }

      // Use the most restrictive confidence
      if (filter.minConfidence !== undefined) {
        if (result.minConfidence === undefined || filter.minConfidence > result.minConfidence) {
          result = { ...result, minConfidence: filter.minConfidence };
        }
      }

      // Merge entity types (intersection)
      if (filter.entityTypes !== undefined) {
        if (result.entityTypes === undefined) {
          result = { ...result, entityTypes: [...filter.entityTypes] };
        } else {
          result = {
            ...result,
            entityTypes: result.entityTypes.filter((t) => filter.entityTypes!.includes(t)),
          };
        }
      }

      // Merge predicates (intersection)
      if (filter.predicates !== undefined) {
        if (result.predicates === undefined) {
          result = { ...result, predicates: [...filter.predicates] };
        } else {
          result = {
            ...result,
            predicates: result.predicates.filter((t) => filter.predicates!.includes(t)),
          };
        }
      }

      // Use the smallest limit
      if (filter.limit !== undefined) {
        if (result.limit === undefined || filter.limit < result.limit) {
          result = { ...result, limit: filter.limit };
        }
      }
    }

    return result;
  }
}
