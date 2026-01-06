/**
 * Retrieval Types
 *
 * Types for context retrieval and assembly.
 */

import type { Timestamp, Scope, Jurisdiction, EntityId, ClaimId, ProvenanceId, Confidence } from '@contextgraph/core';
import type { Entity, Claim } from '@contextgraph/ckg';
import type { ProvenanceEntry } from '@contextgraph/provenance';

/**
 * Context filter for temporal queries
 */
export interface TemporalFilter {
  readonly asOf?: Timestamp;
  readonly from?: Timestamp;
  readonly to?: Timestamp;
}

/**
 * Context filter for scope and jurisdiction
 */
export interface ScopeFilter {
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
}

/**
 * Context filter for confidence levels
 */
export interface ConfidenceFilter {
  readonly minConfidence?: Confidence;
}

/**
 * Combined context filter
 */
export interface ContextFilter extends TemporalFilter, ScopeFilter, ConfidenceFilter {
  readonly entityTypes?: readonly string[];
  readonly predicates?: readonly string[];
  readonly limit?: number;
}

/**
 * Relevance score for retrieved items
 */
export interface RelevanceScore {
  readonly score: number;
  readonly factors: Readonly<Record<string, number>>;
}

/**
 * Retrieved entity with relevance
 */
export interface RetrievedEntity {
  readonly entity: Entity;
  readonly relevance: RelevanceScore;
  readonly claims: readonly RetrievedClaim[];
}

/**
 * Retrieved claim with provenance
 */
export interface RetrievedClaim {
  readonly claim: Claim;
  readonly relevance: RelevanceScore;
  readonly provenance?: ProvenanceEntry;
}

/**
 * Assembled context for a query
 */
export interface AssembledContext {
  readonly id: string;
  readonly query: ContextQuery;
  readonly entities: readonly RetrievedEntity[];
  readonly claims: readonly RetrievedClaim[];
  readonly provenanceChain: readonly ProvenanceEntry[];
  readonly filter: ContextFilter;
  readonly assembledAt: Timestamp;
  readonly stats: ContextStats;
}

/**
 * Context statistics
 */
export interface ContextStats {
  readonly totalEntities: number;
  readonly totalClaims: number;
  readonly totalProvenance: number;
  readonly filterApplied: boolean;
  readonly retrievalTimeMs: number;
}

/**
 * Context query
 */
export interface ContextQuery {
  readonly entityIds?: readonly EntityId[];
  readonly claimIds?: readonly ClaimId[];
  readonly provenanceIds?: readonly ProvenanceId[];
  readonly relatedTo?: EntityId;
  readonly filter?: ContextFilter;
}

/**
 * Context assembly options
 */
export interface ContextAssemblyOptions {
  readonly includeProvenance?: boolean;
  readonly includeRelatedEntities?: boolean;
  readonly maxDepth?: number;
  readonly maxClaims?: number;
}

/**
 * Retrieval result
 */
export interface RetrievalResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextOffset?: number;
}
