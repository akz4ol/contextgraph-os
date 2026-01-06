/**
 * Claim Model
 *
 * Claims are immutable statements in the knowledge graph.
 * Each claim has subject, predicate, object, context, and provenance.
 */

import {
  type ClaimId,
  type EntityId,
  type ProvenanceId,
  type Timestamp,
  type Result,
  type ContextDimensions,
  createClaimId,
  createTimestamp,
  ok,
  err,
  ValidationError,
  ProvenanceRequiredError,
} from '@contextgraph/core';
import { OntologyValidator, type LoadedOntology } from '@contextgraph/ontology';
import { type StorageInterface } from '@contextgraph/storage';

/**
 * Claim data structure
 */
export interface ClaimData {
  readonly id: ClaimId;
  /** Subject entity ID */
  readonly subjectId: EntityId;
  /** Predicate (relation name from ontology) */
  readonly predicate: string;
  /** Object entity ID (for entity-to-entity relations) */
  readonly objectId: EntityId | undefined;
  /** Object literal value (for entity-to-value relations) */
  readonly objectValue: unknown;
  /** Contextual qualifiers */
  readonly context: ContextDimensions;
  /** Provenance reference (required) */
  readonly provenanceId: ProvenanceId;
  /** When the claim was recorded */
  readonly createdAt: Timestamp;
}

/**
 * Claim record for storage
 */
interface ClaimRecord {
  readonly id: string;
  readonly subjectId: string;
  readonly predicate: string;
  readonly objectId: string | null;
  readonly objectValue: string | null;
  readonly context: string;
  readonly provenanceId: string;
  readonly createdAt: Timestamp;
  [key: string]: unknown;
}

/**
 * Claim class (immutable)
 */
export class Claim {
  private constructor(public readonly data: ClaimData) {}

  /**
   * Create a new claim with validation
   */
  static create(
    input: {
      id?: ClaimId;
      subjectId: EntityId;
      subjectType: string; // Needed for ontology validation
      predicate: string;
      objectId?: EntityId;
      objectType?: string; // Needed for ontology validation
      objectValue?: unknown;
      context: ContextDimensions;
      provenanceId: ProvenanceId;
    },
    ontology?: LoadedOntology
  ): Result<Claim, Error> {
    // Require either objectId or objectValue
    if (input.objectId === undefined && input.objectValue === undefined) {
      return err(new ValidationError('Claim must have either objectId or objectValue'));
    }

    const id = input.id ?? createClaimId();
    const createdAt = createTimestamp();

    // Validate against ontology if provided
    if (ontology !== undefined) {
      const validator = new OntologyValidator(ontology);
      const validationInput = {
        id,
        subjectType: input.subjectType,
        predicate: input.predicate,
        context: input.context as unknown as Record<string, unknown>,
        ...(input.objectType !== undefined ? { objectType: input.objectType } : {}),
        ...(input.objectValue !== undefined ? { objectValue: input.objectValue } : {}),
      };

      const result = validator.validateClaim(validationInput);

      if (!result.valid) {
        const firstError = result.errors[0];
        return err(
          new ValidationError(
            firstError?.message ?? 'Claim validation failed',
            firstError?.path,
            firstError?.code
          )
        );
      }
    }

    const claimData: ClaimData = {
      id,
      subjectId: input.subjectId,
      predicate: input.predicate,
      objectId: input.objectId,
      objectValue: input.objectValue,
      context: input.context,
      provenanceId: input.provenanceId,
      createdAt,
    };

    return ok(new Claim(claimData));
  }

  /**
   * Reconstruct claim from stored record
   */
  static fromRecord(record: ClaimRecord): Claim {
    const context = typeof record.context === 'string'
      ? JSON.parse(record.context) as ContextDimensions
      : record.context as unknown as ContextDimensions;
    const objectValue = record.objectValue !== null
      ? (typeof record.objectValue === 'string' ? JSON.parse(record.objectValue) : record.objectValue)
      : undefined;

    return new Claim({
      id: record.id as ClaimId,
      subjectId: record.subjectId as EntityId,
      predicate: record.predicate,
      objectId: record.objectId !== null ? (record.objectId as EntityId) : undefined,
      objectValue,
      context,
      provenanceId: record.provenanceId as ProvenanceId,
      createdAt: record.createdAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): ClaimRecord {
    return {
      id: this.data.id,
      subjectId: this.data.subjectId,
      predicate: this.data.predicate,
      objectId: this.data.objectId ?? null,
      objectValue: this.data.objectValue !== undefined ? JSON.stringify(this.data.objectValue) : null,
      context: JSON.stringify(this.data.context),
      provenanceId: this.data.provenanceId,
      createdAt: this.data.createdAt,
    };
  }

  /**
   * Check if claim is valid at a given timestamp
   */
  isValidAt(timestamp: Timestamp): boolean {
    const { temporal } = this.data.context;
    if (timestamp < temporal.start) return false;
    if (temporal.end !== null && timestamp > temporal.end) return false;
    return true;
  }
}

/**
 * Claim Repository
 *
 * Manages claim persistence with immutability guarantee.
 */
export class ClaimRepository {
  private readonly collection = 'claims';

  constructor(
    private readonly storage: StorageInterface,
    private readonly ontology?: LoadedOntology,
    private readonly requireProvenance = true
  ) {}

  /**
   * Create and store a new claim
   */
  async create(input: {
    subjectId: EntityId;
    subjectType: string;
    predicate: string;
    objectId?: EntityId;
    objectType?: string;
    objectValue?: unknown;
    context: ContextDimensions;
    provenanceId: ProvenanceId;
  }): Promise<Result<Claim, Error>> {
    // Enforce provenance requirement
    if (this.requireProvenance && !input.provenanceId) {
      return err(new ProvenanceRequiredError());
    }

    const claimResult = Claim.create(input, this.ontology);
    if (!claimResult.ok) {
      return claimResult;
    }

    const claim = claimResult.value;
    const insertResult = await this.storage.insert(this.collection, claim.toRecord());
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    return ok(claim);
  }

  /**
   * Find claim by ID
   */
  async findById(id: ClaimId): Promise<Result<Claim | null, Error>> {
    const result = await this.storage.findById<ClaimRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(Claim.fromRecord(result.value));
  }

  /**
   * Find claims by subject
   */
  async findBySubject(subjectId: EntityId, options?: { limit?: number; offset?: number }): Promise<Result<readonly Claim[], Error>> {
    const result = await this.storage.find<ClaimRecord>(this.collection, { subjectId }, options);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Claim.fromRecord(record)));
  }

  /**
   * Find claims by object
   */
  async findByObject(objectId: EntityId, options?: { limit?: number; offset?: number }): Promise<Result<readonly Claim[], Error>> {
    const result = await this.storage.find<ClaimRecord>(this.collection, { objectId }, options);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Claim.fromRecord(record)));
  }

  /**
   * Find claims by predicate
   */
  async findByPredicate(predicate: string, options?: { limit?: number; offset?: number }): Promise<Result<readonly Claim[], Error>> {
    const result = await this.storage.find<ClaimRecord>(this.collection, { predicate }, options);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Claim.fromRecord(record)));
  }

  /**
   * Find claims by provenance
   */
  async findByProvenance(provenanceId: ProvenanceId): Promise<Result<readonly Claim[], Error>> {
    const result = await this.storage.find<ClaimRecord>(this.collection, { provenanceId });
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Claim.fromRecord(record)));
  }

  /**
   * Count claims for a subject
   */
  async countBySubject(subjectId: EntityId): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, { subjectId });
  }

  /**
   * Get all claims (with pagination)
   */
  async findAll(options?: { limit?: number; offset?: number }): Promise<Result<readonly Claim[], Error>> {
    const result = await this.storage.find<ClaimRecord>(this.collection, {}, options);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Claim.fromRecord(record)));
  }
}
