/**
 * Semantic Reasoner
 *
 * High-level reasoning API integrating with ContextGraph CKG
 */

import type { Result, EntityId, ClaimId } from '@contextgraph/core';
import type { CKG, Claim } from '@contextgraph/ckg';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  InferredFact,
  Explanation,
  ReasoningStats,
  RelationDefinition,
  InferenceRule,
} from './types.js';
import { RelationRegistry, createRelationRegistry } from './relations.js';
import { RuleEngine, type Fact } from './rules.js';

/**
 * Reasoner configuration
 */
export interface ReasonerConfig {
  /** Maximum inference iterations */
  maxIterations?: number;
  /** Maximum inferred facts */
  maxFacts?: number;
  /** Minimum confidence threshold for inferences */
  minConfidence?: number;
  /** Whether to store inferred facts */
  materialize?: boolean;
}

const DEFAULT_CONFIG: Required<ReasonerConfig> = {
  maxIterations: 100,
  maxFacts: 10000,
  minConfidence: 0.5,
  materialize: false,
};

/**
 * Semantic Reasoner
 */
export class Reasoner {
  private ckg: CKG;
  private relations: RelationRegistry;
  private engine: RuleEngine;
  private config: Required<ReasonerConfig>;
  private stats: ReasoningStats;
  private inferredFacts: Map<string, InferredFact> = new Map();

  constructor(
    ckg: CKG,
    _storage: StorageInterface,
    config: Partial<ReasonerConfig> = {}
  ) {
    this.ckg = ckg;
    void _storage; // Reserved for future materialization
    this.relations = createRelationRegistry();
    this.engine = new RuleEngine();
    this.config = {
      maxIterations: config.maxIterations ?? DEFAULT_CONFIG.maxIterations,
      maxFacts: config.maxFacts ?? DEFAULT_CONFIG.maxFacts,
      minConfidence: config.minConfidence ?? DEFAULT_CONFIG.minConfidence,
      materialize: config.materialize ?? DEFAULT_CONFIG.materialize,
    };
    this.stats = this.initStats();
  }

  private initStats(): ReasoningStats {
    return {
      rulesLoaded: this.engine.getRules().size,
      relationsLoaded: this.relations.size,
      inferencesCount: 0,
      reasoningTimeMs: 0,
      rulesFired: new Map(),
    };
  }

  /**
   * Register a custom relation
   */
  registerRelation(definition: RelationDefinition): void {
    this.relations.register(definition);
    this.stats.relationsLoaded = this.relations.size;
  }

  /**
   * Register a custom inference rule
   */
  registerRule(rule: InferenceRule): void {
    this.engine.getRules().register(rule);
    this.stats.rulesLoaded = this.engine.getRules().size;
  }

  /**
   * Infer relations for an entity
   */
  async infer(
    entityId: EntityId,
    predicates?: string[]
  ): Promise<Result<InferredFact[]>> {
    const startTime = Date.now();

    try {
      // Get claims for the entity
      const claimsResult = await this.ckg.getClaimsForSubject(entityId);
      if (!claimsResult.ok) {
        return claimsResult;
      }

      const claims = claimsResult.value;
      const facts = this.claimsToFacts(claims);

      // Get related entities and their claims for transitive reasoning
      const relatedFacts = await this.getRelatedFacts(claims);
      facts.push(...relatedFacts);

      // Filter facts by predicates if specified
      const filteredFacts = predicates !== undefined
        ? facts.filter((f) => predicates.includes(f.predicate))
        : facts;

      // Run forward chaining
      const result = this.engine.forwardChain(filteredFacts, {
        maxIterations: this.config.maxIterations,
        maxFacts: this.config.maxFacts,
      });

      if (!result.ok) {
        return result;
      }

      // Convert new facts to inferred facts
      const originalKeys = new Set(filteredFacts.map((f) => this.factKey(f)));
      const inferredFacts: InferredFact[] = [];

      for (const fact of result.value.facts) {
        const key = this.factKey(fact);
        if (!originalKeys.has(key)) {
          const inferred = this.createInferredFact(fact, claims, 'transitive-closure');
          if (inferred.confidence >= this.config.minConfidence) {
            inferredFacts.push(inferred);
            this.inferredFacts.set(key, inferred);
          }
        }
      }

      // Apply symmetric and inverse inferences
      const symmetricFacts = this.inferSymmetric(claims);
      const inverseFacts = this.inferInverse(claims);

      inferredFacts.push(...symmetricFacts, ...inverseFacts);

      this.stats.inferencesCount += inferredFacts.length;
      this.stats.reasoningTimeMs += Date.now() - startTime;

      return { ok: true, value: inferredFacts };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Explain why a claim exists
   */
  async explain(claimId: ClaimId): Promise<Result<Explanation>> {
    try {
      // Find the claim
      const claimResult = await this.ckg.getClaim(claimId);
      if (!claimResult.ok) {
        return claimResult;
      }

      const claim = claimResult.value;
      if (claim === null) {
        return { ok: false, error: new Error(`Claim ${claimId} not found`) };
      }

      const value = claim.data.objectValue ?? claim.data.objectId ?? '';

      // Build explanation
      const explanation: Explanation = {
        claimId,
        text: `Claim "${claim.data.predicate}" exists because it was directly asserted.`,
        sources: [
          {
            claimId,
            description: `${claim.data.predicate}: ${String(value)}`,
          },
        ],
        rules: [],
        chain: [`Asserted: ${claim.data.subjectId} ${claim.data.predicate} ${String(value)}`],
      };

      // Check if there's a provenance record
      explanation.text += ` The claim has provenance record ${claim.data.provenanceId}.`;
      explanation.chain.push(`Provenance: ${claim.data.provenanceId}`);

      return { ok: true, value: explanation };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Explain an inferred fact
   */
  explainInference(inferredFact: InferredFact): Explanation {
    const rule = this.engine.getRules().get(inferredFact.ruleId);

    return {
      inferredFact,
      text: `Inferred via ${rule?.name ?? inferredFact.ruleId} rule.`,
      sources: inferredFact.sourceClaims.map((id) => ({
        claimId: id,
        description: `Source claim: ${id}`,
      })),
      rules: [
        {
          ruleId: inferredFact.ruleId,
          ruleName: rule?.name ?? inferredFact.ruleId,
        },
      ],
      chain: [
        `Sources: ${inferredFact.sourceClaims.join(', ')}`,
        `Rule: ${rule?.name ?? inferredFact.ruleId}`,
        `Inferred: ${inferredFact.subjectId} ${inferredFact.predicate} ${String(inferredFact.object)}`,
      ],
    };
  }

  /**
   * Get all inferred facts
   */
  getInferredFacts(): InferredFact[] {
    return Array.from(this.inferredFacts.values());
  }

  /**
   * Clear inferred facts cache
   */
  clearInferences(): void {
    this.inferredFacts.clear();
  }

  /**
   * Get reasoning statistics
   */
  getStats(): ReasoningStats {
    return { ...this.stats };
  }

  /**
   * Get relation registry
   */
  getRelations(): RelationRegistry {
    return this.relations;
  }

  /**
   * Get rule engine
   */
  getRuleEngine(): RuleEngine {
    return this.engine;
  }

  // Private helpers

  private claimsToFacts(claims: readonly Claim[]): Fact[] {
    return claims.map((c) => {
      const value = c.data.objectValue ?? c.data.objectId;
      return {
        subject: c.data.subjectId,
        predicate: c.data.predicate,
        object: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? value
          : String(value),
      };
    });
  }

  private async getRelatedFacts(claims: readonly Claim[]): Promise<Fact[]> {
    const relatedFacts: Fact[] = [];
    const visited = new Set<string>();

    for (const claim of claims) {
      const objectId = claim.data.objectId;
      if (objectId !== undefined) {
        if (visited.has(objectId)) continue;
        visited.add(objectId);

        const relatedResult = await this.ckg.getClaimsForSubject(objectId as EntityId);
        if (relatedResult.ok) {
          relatedFacts.push(...this.claimsToFacts(relatedResult.value));
        }
      }
    }

    return relatedFacts;
  }

  private factKey(fact: Fact): string {
    return `${fact.subject}|${fact.predicate}|${fact.object}`;
  }

  private createInferredFact(
    fact: Fact,
    sourceClaims: readonly Claim[],
    ruleId: string
  ): InferredFact {
    return {
      subjectId: fact.subject as EntityId,
      predicate: fact.predicate,
      object: fact.object,
      sourceClaims: sourceClaims.map((c) => c.data.id),
      ruleId,
      confidence: this.calculateConfidence(sourceClaims, ruleId),
      inferredAt: Date.now(),
    };
  }

  private calculateConfidence(_sourceClaims: readonly Claim[], ruleId: string): number {
    const rule = this.engine.getRules().get(ruleId);
    const multiplier = rule?.conclusions[0]?.confidenceMultiplier ?? 0.9;

    // Use default confidence of 1.0
    const avgConfidence = 1.0;

    return avgConfidence * multiplier;
  }

  private inferSymmetric(claims: readonly Claim[]): InferredFact[] {
    const inferred: InferredFact[] = [];

    for (const claim of claims) {
      if (this.relations.isSymmetric(claim.data.predicate)) {
        const objectId = claim.data.objectId;
        if (objectId === undefined) continue;

        const symmetricKey = `${objectId}|${claim.data.predicate}|${claim.data.subjectId}`;
        if (!this.inferredFacts.has(symmetricKey)) {
          const fact: InferredFact = {
            subjectId: objectId as EntityId,
            predicate: claim.data.predicate,
            object: claim.data.subjectId,
            sourceClaims: [claim.data.id],
            ruleId: 'symmetric-relation',
            confidence: 1.0,
            inferredAt: Date.now(),
          };
          inferred.push(fact);
          this.inferredFacts.set(symmetricKey, fact);
        }
      }
    }

    return inferred;
  }

  private inferInverse(claims: readonly Claim[]): InferredFact[] {
    const inferred: InferredFact[] = [];

    for (const claim of claims) {
      const inverseName = this.relations.getInverse(claim.data.predicate);
      const objectId = claim.data.objectId;

      if (inverseName !== undefined && inverseName !== claim.data.predicate && objectId !== undefined) {
        const inverseKey = `${objectId}|${inverseName}|${claim.data.subjectId}`;
        if (!this.inferredFacts.has(inverseKey)) {
          const fact: InferredFact = {
            subjectId: objectId as EntityId,
            predicate: inverseName,
            object: claim.data.subjectId,
            sourceClaims: [claim.data.id],
            ruleId: 'inverse-relation',
            confidence: 1.0,
            inferredAt: Date.now(),
          };
          inferred.push(fact);
          this.inferredFacts.set(inverseKey, fact);
        }
      }
    }

    return inferred;
  }
}

/**
 * Create a reasoner instance
 */
export function createReasoner(
  ckg: CKG,
  storage: StorageInterface,
  config?: Partial<ReasonerConfig>
): Reasoner {
  return new Reasoner(ckg, storage, config);
}
