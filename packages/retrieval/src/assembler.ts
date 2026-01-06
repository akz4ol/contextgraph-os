/**
 * Context Assembler
 *
 * Assembles context from various sources for agent queries.
 */

import {
  type Result,
  type EntityId,
  type ProvenanceId,
  createTimestamp,
  ok,
  err,
} from '@contextgraph/core';
import { CKG, type Entity, type Claim } from '@contextgraph/ckg';
import { ProvenanceLedger, type ProvenanceEntry } from '@contextgraph/provenance';
import type {
  ContextQuery,
  ContextFilter,
  ContextAssemblyOptions,
  AssembledContext,
  RetrievedEntity,
  RetrievedClaim,
  RelevanceScore,
} from './types.js';
import { ContextFilterEngine } from './filter.js';

/**
 * Generate context ID
 */
function createContextId(): string {
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Context Assembler
 *
 * Assembles context from CKG and provenance ledger.
 */
export class ContextAssembler {
  private readonly filterEngine = new ContextFilterEngine();

  constructor(
    private readonly ckg: CKG,
    private readonly provenance: ProvenanceLedger
  ) {}

  /**
   * Assemble context for a query
   */
  async assemble(
    query: ContextQuery,
    options: ContextAssemblyOptions = {}
  ): Promise<Result<AssembledContext, Error>> {
    const startTime = Date.now();
    const filter = query.filter ?? {};

    try {
      // Retrieve entities
      const entities = await this.retrieveEntities(query, filter, options);

      // Retrieve claims
      const claims = await this.retrieveClaims(query, filter, entities, options);

      // Retrieve provenance if requested
      const provenanceChain = options.includeProvenance !== false
        ? await this.retrieveProvenance(claims, filter)
        : [];

      const assembledAt = createTimestamp();
      const retrievalTimeMs = Date.now() - startTime;

      const context: AssembledContext = {
        id: createContextId(),
        query,
        entities,
        claims,
        provenanceChain,
        filter,
        assembledAt,
        stats: {
          totalEntities: entities.length,
          totalClaims: claims.length,
          totalProvenance: provenanceChain.length,
          filterApplied: Object.keys(filter).length > 0,
          retrievalTimeMs,
        },
      };

      return ok(context);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Retrieve entities matching the query
   */
  private async retrieveEntities(
    query: ContextQuery,
    filter: ContextFilter,
    options: ContextAssemblyOptions
  ): Promise<readonly RetrievedEntity[]> {
    const entities: Entity[] = [];

    // Retrieve by explicit IDs
    if (query.entityIds !== undefined) {
      for (const id of query.entityIds) {
        const result = await this.ckg.getEntity(id);
        if (result.ok && result.value !== null) {
          entities.push(result.value);
        }
      }
    }

    // Retrieve entities related to a specific entity
    if (query.relatedTo !== undefined && options.includeRelatedEntities !== false) {
      const entityWithClaims = await this.ckg.getEntityWithClaims(query.relatedTo);
      if (entityWithClaims.ok && entityWithClaims.value !== null) {
        // Get unique entity IDs from related claims
        const relatedIds = new Set<string>();
        for (const claim of [...entityWithClaims.value.outgoingClaims, ...entityWithClaims.value.incomingClaims]) {
          if (claim.data.objectId !== undefined && claim.data.objectId !== query.relatedTo) {
            relatedIds.add(claim.data.objectId);
          }
          if (claim.data.subjectId !== query.relatedTo) {
            relatedIds.add(claim.data.subjectId);
          }
        }

        // Retrieve related entities
        for (const id of relatedIds) {
          const result = await this.ckg.getEntity(id as EntityId);
          if (result.ok && result.value !== null) {
            entities.push(result.value);
          }
        }
      }
    }

    // Apply filters
    const filteredEntities = this.filterEngine.filterEntities(entities, filter);

    // Calculate relevance and wrap
    return filteredEntities.map((entity) => this.wrapEntity(entity, query));
  }

  /**
   * Retrieve claims matching the query
   */
  private async retrieveClaims(
    query: ContextQuery,
    filter: ContextFilter,
    entities: readonly RetrievedEntity[],
    options: ContextAssemblyOptions
  ): Promise<readonly RetrievedClaim[]> {
    const claims: Claim[] = [];
    const maxClaims = options.maxClaims ?? 100;

    // Retrieve by explicit IDs
    if (query.claimIds !== undefined) {
      for (const id of query.claimIds) {
        const result = await this.ckg.getClaim(id);
        if (result.ok && result.value !== null) {
          claims.push(result.value);
        }
      }
    }

    // Retrieve claims for entities
    for (const { entity } of entities) {
      const result = await this.ckg.getClaimsForSubject(entity.data.id);
      if (result.ok) {
        claims.push(...result.value);
      }

      if (claims.length >= maxClaims) {
        break;
      }
    }

    // Apply filters
    let filteredClaims = this.filterEngine.filterClaims(claims, filter);

    // Limit claims
    if (filteredClaims.length > maxClaims) {
      filteredClaims = filteredClaims.slice(0, maxClaims);
    }

    // Remove duplicates by ID
    const uniqueClaims = this.deduplicateClaims(filteredClaims);

    // Calculate relevance and wrap
    return uniqueClaims.map((claim) => this.wrapClaim(claim, query));
  }

  /**
   * Retrieve provenance entries for claims
   */
  private async retrieveProvenance(
    claims: readonly RetrievedClaim[],
    filter: ContextFilter
  ): Promise<readonly ProvenanceEntry[]> {
    const provenanceIds = new Set<string>();
    const provenance: ProvenanceEntry[] = [];

    // Collect provenance IDs from claims
    for (const { claim } of claims) {
      provenanceIds.add(claim.data.provenanceId);
    }

    // Retrieve provenance entries
    for (const id of provenanceIds) {
      const result = await this.provenance.getById(id as ProvenanceId);
      if (result.ok && result.value !== null) {
        provenance.push(result.value);
      }
    }

    // Apply temporal filter
    return this.filterEngine.filterProvenance(provenance, filter);
  }

  /**
   * Remove duplicate claims
   */
  private deduplicateClaims(claims: readonly Claim[]): readonly Claim[] {
    const seen = new Set<string>();
    return claims.filter((claim) => {
      if (seen.has(claim.data.id)) {
        return false;
      }
      seen.add(claim.data.id);
      return true;
    });
  }

  /**
   * Wrap entity with relevance score
   */
  private wrapEntity(entity: Entity, query: ContextQuery): RetrievedEntity {
    return {
      entity,
      relevance: this.calculateEntityRelevance(entity, query),
      claims: [],
    };
  }

  /**
   * Wrap claim with relevance score
   */
  private wrapClaim(claim: Claim, query: ContextQuery): RetrievedClaim {
    return {
      claim,
      relevance: this.calculateClaimRelevance(claim, query),
    };
  }

  /**
   * Calculate relevance score for an entity
   */
  private calculateEntityRelevance(entity: Entity, query: ContextQuery): RelevanceScore {
    const factors: Record<string, number> = {};
    let score = 0.5; // Base score

    // Boost for explicitly requested entities
    if (query.entityIds !== undefined && query.entityIds.includes(entity.data.id)) {
      factors['explicit_request'] = 1.0;
      score += 0.5;
    }

    // Boost for being directly related to query target
    if (query.relatedTo !== undefined) {
      factors['related_to_target'] = 0.3;
      score += 0.3;
    }

    return {
      score: Math.min(1.0, score),
      factors,
    };
  }

  /**
   * Calculate relevance score for a claim
   */
  private calculateClaimRelevance(claim: Claim, query: ContextQuery): RelevanceScore {
    const factors: Record<string, number> = {};
    let score = 0.5; // Base score

    // Boost for explicitly requested claims
    if (query.claimIds !== undefined && query.claimIds.includes(claim.data.id)) {
      factors['explicit_request'] = 1.0;
      score += 0.5;
    }

    // Factor in confidence
    const confidence = claim.data.context.confidence ?? 1.0;
    factors['confidence'] = confidence;
    score += confidence * 0.2;

    // Boost for high confidence claims
    if (confidence >= 0.9) {
      factors['high_confidence'] = 0.2;
      score += 0.2;
    }

    return {
      score: Math.min(1.0, score),
      factors,
    };
  }

  /**
   * Get point-in-time snapshot
   */
  async getSnapshot(asOf: number): Promise<Result<AssembledContext, Error>> {
    const filter: ContextFilter = { asOf: asOf as unknown as import('@contextgraph/core').Timestamp };
    const query: ContextQuery = { filter };

    // Get all claims valid at timestamp
    const claimsResult = await this.ckg.getClaimsAsOf(asOf as unknown as import('@contextgraph/core').Timestamp);
    if (!claimsResult.ok) {
      return err(claimsResult.error);
    }

    const validClaims = claimsResult.value.claims;

    // Get entities for these claims
    const entityIds = new Set<string>();
    for (const claim of validClaims) {
      entityIds.add(claim.data.subjectId);
      if (claim.data.objectId !== undefined) {
        entityIds.add(claim.data.objectId);
      }
    }

    const entities: Entity[] = [];
    for (const id of entityIds) {
      const result = await this.ckg.getEntity(id as EntityId);
      if (result.ok && result.value !== null) {
        entities.push(result.value);
      }
    }

    return ok({
      id: createContextId(),
      query,
      entities: entities.map((e) => this.wrapEntity(e, query)),
      claims: validClaims.map((c) => this.wrapClaim(c, query)),
      provenanceChain: [],
      filter,
      assembledAt: createTimestamp(),
      stats: {
        totalEntities: entities.length,
        totalClaims: validClaims.length,
        totalProvenance: 0,
        filterApplied: true,
        retrievalTimeMs: 0,
      },
    });
  }
}
