/**
 * Contradiction Detection
 *
 * Detects and resolves contradictory claims in the knowledge graph
 */

import type { Result, EntityId, ClaimId } from '@contextgraph/core';
import type { CKG, Claim } from '@contextgraph/ckg';
import type { StorageInterface } from '@contextgraph/storage';

/**
 * Contradiction types
 */
export type ContradictionType =
  | 'direct_negation'     // A is true, A is false
  | 'mutual_exclusion'    // A is X, A is Y where X and Y are mutually exclusive
  | 'temporal_overlap'    // Conflicting validity periods
  | 'cardinality'         // Too many values for a single-valued property
  | 'type_mismatch';      // Value doesn't match expected type

/**
 * Contradiction record
 */
export interface Contradiction {
  /** Unique ID */
  id: string;
  /** Type of contradiction */
  type: ContradictionType;
  /** Entity with the contradiction */
  entityId: EntityId;
  /** Conflicting claims */
  claimIds: ClaimId[];
  /** Description of the contradiction */
  description: string;
  /** Detected timestamp */
  detectedAt: number;
  /** Suggested resolution strategy */
  suggestedResolution?: ResolutionStrategy;
}

/**
 * Resolution strategies
 */
export type ResolutionStrategy =
  | 'latest_wins'
  | 'highest_confidence'
  | 'manual_required'
  | 'keep_both'
  | 'revoke_both';

/**
 * Resolution result
 */
export interface ResolutionResult {
  /** Contradiction ID */
  contradictionId: string;
  /** Strategy used */
  strategy: ResolutionStrategy;
  /** Claims that were kept */
  keptClaims: ClaimId[];
  /** Claims that were revoked */
  revokedClaims: ClaimId[];
  /** Resolution timestamp */
  resolvedAt: number;
}

/**
 * Mutual exclusion rules
 */
export interface MutualExclusionRule {
  /** Predicate that this rule applies to */
  predicate: string;
  /** Values that are mutually exclusive */
  exclusiveValues: Array<string | number | boolean>;
  /** Description */
  description?: string;
}

/**
 * Single-valued property rules
 */
export interface SingleValuedRule {
  /** Predicates that should have only one value */
  predicates: string[];
}

/**
 * Internal claim representation for analysis
 */
interface AnalyzedClaim {
  id: ClaimId;
  predicate: string;
  value: unknown;
  createdAt: number;
  confidence: number;
  validFrom?: number;
  validUntil?: number;
}

/**
 * Contradiction Detector
 */
export class ContradictionDetector {
  private ckg: CKG;
  private exclusionRules: Map<string, MutualExclusionRule> = new Map();
  private singleValuedPredicates: Set<string> = new Set();
  private contradictions: Map<string, Contradiction> = new Map();

  constructor(ckg: CKG, _storage: StorageInterface) {
    this.ckg = ckg;
    void _storage; // Reserved for future persistence
    this.registerDefaultRules();
  }

  private registerDefaultRules(): void {
    // Common single-valued properties
    this.addSingleValuedRule({
      predicates: [
        'dateOfBirth',
        'dateOfDeath',
        'birthplace',
        'gender',
        'maritalStatus',
        'nationality',
        'ssn',
        'taxId',
        'email',
        'primaryPhone',
      ],
    });

    // Common mutual exclusions
    this.addExclusionRule({
      predicate: 'status',
      exclusiveValues: ['active', 'inactive', 'suspended', 'deleted'],
      description: 'Status values are mutually exclusive',
    });

    this.addExclusionRule({
      predicate: 'alive',
      exclusiveValues: [true, false],
      description: 'Entity cannot be both alive and dead',
    });
  }

  /**
   * Add a mutual exclusion rule
   */
  addExclusionRule(rule: MutualExclusionRule): void {
    this.exclusionRules.set(rule.predicate, rule);
  }

  /**
   * Add single-valued property rules
   */
  addSingleValuedRule(rule: SingleValuedRule): void {
    for (const predicate of rule.predicates) {
      this.singleValuedPredicates.add(predicate);
    }
  }

  /**
   * Convert a Claim to AnalyzedClaim
   */
  private toAnalyzedClaim(claim: Claim): AnalyzedClaim {
    return {
      id: claim.data.id,
      predicate: claim.data.predicate,
      value: claim.data.objectValue ?? claim.data.objectId,
      createdAt: claim.data.createdAt,
      confidence: 1.0,
    };
  }

  /**
   * Detect all contradictions for an entity
   */
  async detectContradictions(entityId: EntityId): Promise<Result<Contradiction[]>> {
    try {
      const claimsResult = await this.ckg.getClaimsForSubject(entityId);
      if (!claimsResult.ok) {
        return claimsResult;
      }

      const analyzedClaims = claimsResult.value.map((c: Claim) => this.toAnalyzedClaim(c));
      const contradictions: Contradiction[] = [];

      // Check for direct negations
      contradictions.push(...this.detectDirectNegations(entityId, analyzedClaims));

      // Check for mutual exclusions
      contradictions.push(...this.detectMutualExclusions(entityId, analyzedClaims));

      // Check for cardinality violations
      contradictions.push(...this.detectCardinalityViolations(entityId, analyzedClaims));

      // Check for temporal overlaps
      contradictions.push(...this.detectTemporalOverlaps(entityId, analyzedClaims));

      // Store detected contradictions
      for (const c of contradictions) {
        this.contradictions.set(c.id, c);
      }

      return { ok: true, value: contradictions };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Detect all contradictions in the graph (for a specific entity type)
   */
  async detectAllForType(entityType: string): Promise<Result<Contradiction[]>> {
    try {
      const entitiesResult = await this.ckg.findEntitiesByType(entityType, { limit: 1000 });
      if (!entitiesResult.ok) {
        return entitiesResult;
      }

      const allContradictions: Contradiction[] = [];

      for (const entity of entitiesResult.value) {
        const result = await this.detectContradictions(entity.data.id);
        if (result.ok) {
          allContradictions.push(...result.value);
        }
      }

      return { ok: true, value: allContradictions };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Check consistency before adding a claim
   */
  async checkConsistency(
    entityId: EntityId,
    predicate: string,
    value: unknown
  ): Promise<Result<{ consistent: boolean; conflicts: Contradiction[] }>> {
    try {
      const claimsResult = await this.ckg.getClaimsForSubject(entityId);
      if (!claimsResult.ok) {
        return { ok: false, error: claimsResult.error };
      }

      const analyzedClaims = claimsResult.value.map((c: Claim) => this.toAnalyzedClaim(c));
      const conflicts: Contradiction[] = [];

      // Check single-valued constraint
      if (this.singleValuedPredicates.has(predicate)) {
        const existing = analyzedClaims.filter((c: AnalyzedClaim) => c.predicate === predicate);
        if (existing.length > 0) {
          const differentValue = existing.some((c: AnalyzedClaim) => c.value !== value);
          if (differentValue) {
            conflicts.push({
              id: `check_${Date.now()}`,
              type: 'cardinality',
              entityId,
              claimIds: existing.map((c: AnalyzedClaim) => c.id),
              description: `Property "${predicate}" already has a different value`,
              detectedAt: Date.now(),
              suggestedResolution: 'latest_wins',
            });
          }
        }
      }

      // Check mutual exclusion
      const rule = this.exclusionRules.get(predicate);
      if (rule !== undefined && rule.exclusiveValues.includes(value as string | number | boolean)) {
        const conflicting = analyzedClaims.filter(
          (c: AnalyzedClaim) =>
            c.predicate === predicate &&
            c.value !== value &&
            rule.exclusiveValues.includes(c.value as string | number | boolean)
        );
        if (conflicting.length > 0) {
          conflicts.push({
            id: `check_${Date.now()}`,
            type: 'mutual_exclusion',
            entityId,
            claimIds: conflicting.map((c: AnalyzedClaim) => c.id),
            description: `Values are mutually exclusive for "${predicate}"`,
            detectedAt: Date.now(),
            suggestedResolution: 'latest_wins',
          });
        }
      }

      return {
        ok: true,
        value: { consistent: conflicts.length === 0, conflicts },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Resolve a contradiction (marks as resolved, actual revocation should be done separately)
   */
  resolveContradiction(
    contradictionId: string,
    strategy: ResolutionStrategy,
    claims: Array<{ id: ClaimId; createdAt: number; confidence: number }>
  ): Result<ResolutionResult> {
    const contradiction = this.contradictions.get(contradictionId);
    if (contradiction === undefined) {
      return { ok: false, error: new Error(`Contradiction ${contradictionId} not found`) };
    }

    let keptClaims: ClaimId[] = [];
    let revokedClaims: ClaimId[] = [];

    switch (strategy) {
      case 'latest_wins': {
        const sorted = [...claims].sort((a, b) => b.createdAt - a.createdAt);
        if (sorted[0] !== undefined) {
          keptClaims = [sorted[0].id];
          revokedClaims = sorted.slice(1).map((c) => c.id);
        }
        break;
      }
      case 'highest_confidence': {
        const sorted = [...claims].sort((a, b) => b.confidence - a.confidence);
        if (sorted[0] !== undefined) {
          keptClaims = [sorted[0].id];
          revokedClaims = sorted.slice(1).map((c) => c.id);
        }
        break;
      }
      case 'keep_both': {
        keptClaims = claims.map((c) => c.id);
        break;
      }
      case 'revoke_both': {
        revokedClaims = claims.map((c) => c.id);
        break;
      }
      case 'manual_required':
      default:
        return {
          ok: false,
          error: new Error('Manual resolution required'),
        };
    }

    // Remove from tracked contradictions
    this.contradictions.delete(contradictionId);

    return {
      ok: true,
      value: {
        contradictionId,
        strategy,
        keptClaims,
        revokedClaims,
        resolvedAt: Date.now(),
      },
    };
  }

  /**
   * Get all detected contradictions
   */
  getContradictions(): Contradiction[] {
    return Array.from(this.contradictions.values());
  }

  // Private detection methods

  private detectDirectNegations(entityId: EntityId, claims: AnalyzedClaim[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const byPredicate = this.groupByPredicate(claims);

    for (const [predicate, predicateClaims] of byPredicate) {
      // Look for true/false pairs
      const trueValues = predicateClaims.filter((c) => c.value === true);
      const falseValues = predicateClaims.filter((c) => c.value === false);

      if (trueValues.length > 0 && falseValues.length > 0) {
        contradictions.push({
          id: `dn_${entityId}_${predicate}_${Date.now()}`,
          type: 'direct_negation',
          entityId,
          claimIds: [...trueValues, ...falseValues].map((c) => c.id),
          description: `Claim "${predicate}" has both true and false values`,
          detectedAt: Date.now(),
          suggestedResolution: 'latest_wins',
        });
      }
    }

    return contradictions;
  }

  private detectMutualExclusions(entityId: EntityId, claims: AnalyzedClaim[]): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const [predicate, rule] of this.exclusionRules) {
      const relevant = claims.filter(
        (c) =>
          c.predicate === predicate &&
          rule.exclusiveValues.includes(c.value as string | number | boolean)
      );

      // Check if multiple exclusive values are present
      const uniqueValues = new Set(relevant.map((c) => String(c.value)));
      if (uniqueValues.size > 1) {
        contradictions.push({
          id: `me_${entityId}_${predicate}_${Date.now()}`,
          type: 'mutual_exclusion',
          entityId,
          claimIds: relevant.map((c) => c.id),
          description: `Mutually exclusive values for "${predicate}": ${Array.from(uniqueValues).join(', ')}`,
          detectedAt: Date.now(),
          suggestedResolution: 'latest_wins',
        });
      }
    }

    return contradictions;
  }

  private detectCardinalityViolations(entityId: EntityId, claims: AnalyzedClaim[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const byPredicate = this.groupByPredicate(claims);

    for (const [predicate, predicateClaims] of byPredicate) {
      if (this.singleValuedPredicates.has(predicate) && predicateClaims.length > 1) {
        // Check if values are different
        const uniqueValues = new Set(predicateClaims.map((c) => String(c.value)));
        if (uniqueValues.size > 1) {
          contradictions.push({
            id: `cv_${entityId}_${predicate}_${Date.now()}`,
            type: 'cardinality',
            entityId,
            claimIds: predicateClaims.map((c) => c.id),
            description: `Single-valued property "${predicate}" has multiple different values`,
            detectedAt: Date.now(),
            suggestedResolution: 'latest_wins',
          });
        }
      }
    }

    return contradictions;
  }

  private detectTemporalOverlaps(entityId: EntityId, claims: AnalyzedClaim[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const byPredicate = this.groupByPredicate(claims);

    for (const [predicate, predicateClaims] of byPredicate) {
      // Only check single-valued predicates with temporal context
      if (!this.singleValuedPredicates.has(predicate)) continue;

      const withTemporal = predicateClaims.filter(
        (c) => c.validFrom !== undefined && c.value !== undefined
      );

      for (let i = 0; i < withTemporal.length; i++) {
        for (let j = i + 1; j < withTemporal.length; j++) {
          const a = withTemporal[i];
          const b = withTemporal[j];

          if (a === undefined || b === undefined) continue;
          if (a.value === b.value) continue;

          // Check for overlap
          const aEnd = a.validUntil ?? Infinity;
          const bEnd = b.validUntil ?? Infinity;

          if (a.validFrom !== undefined && b.validFrom !== undefined) {
            const overlap = a.validFrom < bEnd && b.validFrom < aEnd;
            if (overlap) {
              contradictions.push({
                id: `to_${entityId}_${predicate}_${Date.now()}`,
                type: 'temporal_overlap',
                entityId,
                claimIds: [a.id, b.id],
                description: `Conflicting values for "${predicate}" with overlapping validity periods`,
                detectedAt: Date.now(),
                suggestedResolution: 'manual_required',
              });
            }
          }
        }
      }
    }

    return contradictions;
  }

  private groupByPredicate(claims: AnalyzedClaim[]): Map<string, AnalyzedClaim[]> {
    const byPredicate = new Map<string, AnalyzedClaim[]>();
    for (const claim of claims) {
      const existing = byPredicate.get(claim.predicate) ?? [];
      existing.push(claim);
      byPredicate.set(claim.predicate, existing);
    }
    return byPredicate;
  }
}

/**
 * Create a contradiction detector
 */
export function createContradictionDetector(
  ckg: CKG,
  storage: StorageInterface
): ContradictionDetector {
  return new ContradictionDetector(ckg, storage);
}
