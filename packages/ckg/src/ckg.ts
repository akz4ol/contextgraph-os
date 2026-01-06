/**
 * CKG - Contextual Knowledge Graph
 *
 * Main entry point for the knowledge graph.
 * Provides unified access to entities, claims, and context filtering.
 */

import {
  type EntityId,
  type ClaimId,
  type ProvenanceId,
  type Timestamp,
  type ContextDimensions,
  type Result,
  ok,
  err,
} from '@contextgraph/core';
import { type LoadedOntology, OntologyLoader } from '@contextgraph/ontology';
import { type StorageInterface } from '@contextgraph/storage';
import { Entity, EntityRepository } from './entity.js';
import { Claim, ClaimRepository } from './claim.js';
import { ContextFilter, type ContextFilterOptions, type FilteredClaimSet } from './context-filter.js';

/**
 * CKG configuration options
 */
export interface CKGOptions {
  /** Storage backend */
  storage: StorageInterface;
  /** Ontology loader */
  ontologyLoader?: OntologyLoader;
  /** Require provenance for all claims */
  requireProvenance?: boolean;
}

/**
 * Query result for entity with related claims
 */
export interface EntityWithClaims {
  readonly entity: Entity;
  readonly outgoingClaims: readonly Claim[];
  readonly incomingClaims: readonly Claim[];
}

/**
 * CKG - Contextual Knowledge Graph
 *
 * The main graph interface combining entities, claims, and context.
 */
export class CKG {
  private readonly entities: EntityRepository;
  private readonly claims: ClaimRepository;
  private readonly contextFilter: ContextFilter;
  private ontology: LoadedOntology | undefined;

  constructor(private readonly options: CKGOptions) {
    const ontology = options.ontologyLoader?.getCurrent();
    this.ontology = ontology?.ok === true ? ontology.value : undefined;

    this.entities = new EntityRepository(options.storage, this.ontology);
    this.claims = new ClaimRepository(options.storage, this.ontology, options.requireProvenance ?? true);
    this.contextFilter = new ContextFilter();
  }

  // ============================================================================
  // Entity Operations
  // ============================================================================

  /**
   * Create a new entity
   */
  async createEntity(input: {
    id?: EntityId;
    type: string;
    name?: string;
    aliases?: readonly string[];
    properties?: Readonly<Record<string, unknown>>;
  }): Promise<Result<Entity, Error>> {
    return this.entities.create(input);
  }

  /**
   * Get entity by ID
   */
  async getEntity(id: EntityId): Promise<Result<Entity | null, Error>> {
    return this.entities.findById(id);
  }

  /**
   * Resolve entity by ID or alias
   */
  async resolveEntity(identifier: string): Promise<Result<Entity | null, Error>> {
    return this.entities.resolve(identifier);
  }

  /**
   * Find entities by type
   */
  async findEntitiesByType(type: string, options?: { limit?: number; offset?: number }): Promise<Result<readonly Entity[], Error>> {
    return this.entities.findByType(type, options);
  }

  // ============================================================================
  // Claim Operations
  // ============================================================================

  /**
   * Create a new claim
   */
  async createClaim(input: {
    subjectId: EntityId;
    subjectType: string;
    predicate: string;
    objectId?: EntityId;
    objectType?: string;
    objectValue?: unknown;
    context: ContextDimensions;
    provenanceId: ProvenanceId;
  }): Promise<Result<Claim, Error>> {
    return this.claims.create(input);
  }

  /**
   * Get claim by ID
   */
  async getClaim(id: ClaimId): Promise<Result<Claim | null, Error>> {
    return this.claims.findById(id);
  }

  /**
   * Get claims for a subject entity
   */
  async getClaimsForSubject(subjectId: EntityId): Promise<Result<readonly Claim[], Error>> {
    return this.claims.findBySubject(subjectId);
  }

  /**
   * Get claims where entity is the object
   */
  async getClaimsForObject(objectId: EntityId): Promise<Result<readonly Claim[], Error>> {
    return this.claims.findByObject(objectId);
  }

  /**
   * Get claims by predicate
   */
  async getClaimsByPredicate(predicate: string): Promise<Result<readonly Claim[], Error>> {
    return this.claims.findByPredicate(predicate);
  }

  /**
   * Get claims by provenance
   */
  async getClaimsByProvenance(provenanceId: ProvenanceId): Promise<Result<readonly Claim[], Error>> {
    return this.claims.findByProvenance(provenanceId);
  }

  // ============================================================================
  // Context-Aware Queries
  // ============================================================================

  /**
   * Get entity with all related claims
   */
  async getEntityWithClaims(
    id: EntityId,
    filterOptions?: ContextFilterOptions
  ): Promise<Result<EntityWithClaims | null, Error>> {
    const entityResult = await this.entities.findById(id);
    if (!entityResult.ok) {
      return err(entityResult.error);
    }

    if (entityResult.value === null) {
      return ok(null);
    }

    const [outgoingResult, incomingResult] = await Promise.all([
      this.claims.findBySubject(id),
      this.claims.findByObject(id),
    ]);

    if (!outgoingResult.ok) return err(outgoingResult.error);
    if (!incomingResult.ok) return err(incomingResult.error);

    let outgoingClaims = outgoingResult.value;
    let incomingClaims = incomingResult.value;

    // Apply context filter if provided
    if (filterOptions !== undefined) {
      const filteredOutgoing = this.contextFilter.filter(outgoingClaims, filterOptions);
      const filteredIncoming = this.contextFilter.filter(incomingClaims, filterOptions);
      outgoingClaims = filteredOutgoing.claims;
      incomingClaims = filteredIncoming.claims;
    }

    return ok({
      entity: entityResult.value,
      outgoingClaims,
      incomingClaims,
    });
  }

  /**
   * Query claims with context filtering
   */
  async queryClaims(filterOptions: ContextFilterOptions): Promise<Result<FilteredClaimSet, Error>> {
    const allClaimsResult = await this.claims.findAll();
    if (!allClaimsResult.ok) {
      return err(allClaimsResult.error);
    }

    return ok(this.contextFilter.filter(allClaimsResult.value, filterOptions));
  }

  /**
   * Get claims valid at a specific point in time
   */
  async getClaimsAsOf(timestamp: Timestamp): Promise<Result<FilteredClaimSet, Error>> {
    return this.queryClaims({ asOf: timestamp });
  }

  /**
   * Find conflicting claims in the graph
   */
  async findConflicts(filterOptions?: ContextFilterOptions): Promise<Result<ReadonlyMap<string, readonly Claim[]>, Error>> {
    const claimsResult = filterOptions !== undefined
      ? await this.queryClaims(filterOptions)
      : await this.claims.findAll();

    if (!claimsResult.ok) {
      return err(claimsResult.error);
    }

    const claims = 'claims' in claimsResult.value ? claimsResult.value.claims : claimsResult.value;
    return ok(this.contextFilter.findConflicts(claims));
  }

  // ============================================================================
  // Graph Traversal
  // ============================================================================

  /**
   * Traverse the graph from a starting entity
   */
  async traverse(
    startId: EntityId,
    options: {
      direction: 'outgoing' | 'incoming' | 'both';
      predicates?: readonly string[];
      maxDepth?: number;
      filterOptions?: ContextFilterOptions;
    }
  ): Promise<Result<readonly Claim[], Error>> {
    const maxDepth = options.maxDepth ?? 1;
    const visited = new Set<string>();
    const result: Claim[] = [];

    const queue: { entityId: EntityId; depth: number }[] = [{ entityId: startId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;
      if (visited.has(current.entityId)) continue;
      visited.add(current.entityId);

      const claimsResult = await this.getRelatedClaims(current.entityId, options.direction);
      if (!claimsResult.ok) {
        return err(claimsResult.error);
      }

      let claims = claimsResult.value;

      // Filter by predicates
      if (options.predicates !== undefined) {
        claims = claims.filter((c) => options.predicates!.includes(c.data.predicate));
      }

      // Apply context filter
      if (options.filterOptions !== undefined) {
        claims = this.contextFilter.filter(claims, options.filterOptions).claims;
      }

      result.push(...claims);

      // Queue next level
      for (const claim of claims) {
        const nextId = options.direction === 'incoming'
          ? claim.data.subjectId
          : claim.data.objectId;
        if (nextId !== undefined && !visited.has(nextId)) {
          queue.push({ entityId: nextId, depth: current.depth + 1 });
        }
      }
    }

    return ok(result);
  }

  /**
   * Get claims related to an entity in the specified direction
   */
  private async getRelatedClaims(
    entityId: EntityId,
    direction: 'outgoing' | 'incoming' | 'both'
  ): Promise<Result<readonly Claim[], Error>> {
    if (direction === 'outgoing') {
      return this.claims.findBySubject(entityId);
    }

    if (direction === 'incoming') {
      return this.claims.findByObject(entityId);
    }

    // Both directions
    const [outgoing, incoming] = await Promise.all([
      this.claims.findBySubject(entityId),
      this.claims.findByObject(entityId),
    ]);

    if (!outgoing.ok) return err(outgoing.error);
    if (!incoming.ok) return err(incoming.error);

    const combined = [...outgoing.value, ...incoming.value];
    // Dedupe by ID
    const seen = new Set<string>();
    const deduped = combined.filter((c) => {
      if (seen.has(c.data.id)) return false;
      seen.add(c.data.id);
      return true;
    });

    return ok(deduped);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get graph statistics
   */
  async getStats(): Promise<Result<{
    entityCount: number;
    claimCount: number;
    entityTypes: Record<string, number>;
    predicates: Record<string, number>;
  }, Error>> {
    const storageStats = await this.options.storage.stats();
    if (!storageStats.ok) {
      return err(storageStats.error);
    }

    const entityCount = storageStats.value.collections['entities'] ?? 0;
    const claimCount = storageStats.value.collections['claims'] ?? 0;

    // Get entity type breakdown (simplified - would need aggregation for full stats)
    const entityTypes: Record<string, number> = {};
    const predicates: Record<string, number> = {};

    return ok({
      entityCount,
      claimCount,
      entityTypes,
      predicates,
    });
  }
}
