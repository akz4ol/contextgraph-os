/**
 * Entity Model
 *
 * Entities are the nodes in the knowledge graph.
 * They support aliasing for entity resolution.
 */

import {
  type EntityId,
  type Timestamp,
  type Result,
  createEntityId,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import { OntologyValidator, type LoadedOntology } from '@contextgraph/ontology';
import { type StorageInterface } from '@contextgraph/storage';

/**
 * Entity data structure
 */
export interface EntityData {
  readonly id: EntityId;
  readonly type: string;
  readonly name: string | undefined;
  readonly aliases: readonly string[] | undefined;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
}

/**
 * Entity record for storage
 */
interface EntityRecord {
  readonly id: string;
  readonly type: string;
  readonly name: string | null;
  readonly aliases: string | null;
  readonly metadata: string | null;
  readonly createdAt: Timestamp;
  [key: string]: unknown;
}

/**
 * Entity class with validation
 */
export class Entity {
  private constructor(public readonly data: EntityData) {}

  /**
   * Create a new entity with validation
   */
  static create(
    input: {
      id?: EntityId;
      type: string;
      name?: string;
      aliases?: readonly string[];
      properties?: Readonly<Record<string, unknown>>;
    },
    ontology?: LoadedOntology
  ): Result<Entity, ValidationError> {
    const id = input.id ?? createEntityId();
    const createdAt = createTimestamp();

    const entityData: EntityData = {
      id,
      type: input.type,
      name: input.name,
      aliases: input.aliases,
      properties: input.properties ?? {},
      createdAt,
    };

    // Validate against ontology if provided
    if (ontology !== undefined) {
      const validator = new OntologyValidator(ontology);
      const result = validator.validateEntity({
        id,
        type: input.type,
        properties: input.properties ?? {},
      });

      if (!result.valid) {
        const firstError = result.errors[0];
        return err(
          new ValidationError(
            firstError?.message ?? 'Entity validation failed',
            firstError?.path,
            firstError?.code
          )
        );
      }
    }

    return ok(new Entity(entityData));
  }

  /**
   * Reconstruct entity from stored data
   */
  static fromRecord(record: EntityRecord): Entity {
    const aliases = record.aliases !== null
      ? (typeof record.aliases === 'string' ? JSON.parse(record.aliases) as string[] : record.aliases as unknown as string[])
      : undefined;
    const properties = record.metadata !== null
      ? (typeof record.metadata === 'string' ? JSON.parse(record.metadata) as Record<string, unknown> : record.metadata as Record<string, unknown>)
      : {};

    return new Entity({
      id: record.id as EntityId,
      type: record.type,
      name: record.name ?? undefined,
      aliases,
      properties,
      createdAt: record.createdAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): EntityRecord {
    return {
      id: this.data.id,
      type: this.data.type,
      name: this.data.name ?? null,
      aliases: this.data.aliases !== undefined ? JSON.stringify(this.data.aliases) : null,
      metadata: Object.keys(this.data.properties).length > 0 ? JSON.stringify(this.data.properties) : null,
      createdAt: this.data.createdAt,
    };
  }

  /**
   * Check if entity has a given alias
   */
  hasAlias(alias: string): boolean {
    return this.data.aliases?.includes(alias) ?? false;
  }
}

/**
 * Entity Repository
 *
 * Manages entity persistence with validation.
 */
export class EntityRepository {
  private readonly collection = 'entities';

  constructor(
    private readonly storage: StorageInterface,
    private readonly ontology?: LoadedOntology
  ) {}

  /**
   * Create and store a new entity
   */
  async create(input: {
    id?: EntityId;
    type: string;
    name?: string;
    aliases?: readonly string[];
    properties?: Readonly<Record<string, unknown>>;
  }): Promise<Result<Entity, Error>> {
    const entityResult = Entity.create(input, this.ontology);
    if (!entityResult.ok) {
      return entityResult;
    }

    const entity = entityResult.value;
    const insertResult = await this.storage.insert(this.collection, entity.toRecord());
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    return ok(entity);
  }

  /**
   * Find entity by ID
   */
  async findById(id: EntityId): Promise<Result<Entity | null, Error>> {
    const result = await this.storage.findById<EntityRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(Entity.fromRecord(result.value));
  }

  /**
   * Find entities by type
   */
  async findByType(type: string, options?: { limit?: number; offset?: number }): Promise<Result<readonly Entity[], Error>> {
    const result = await this.storage.find<EntityRecord>(this.collection, { type }, options);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Entity.fromRecord(record)));
  }

  /**
   * Find entity by alias
   */
  async findByAlias(alias: string): Promise<Result<Entity | null, Error>> {
    // Search in aliases JSON field
    const result = await this.storage.query<EntityRecord>(
      `SELECT * FROM entities WHERE aliases LIKE ? LIMIT 1`,
      [`%"${alias}"%`]
    );

    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.length === 0) {
      return ok(null);
    }

    return ok(Entity.fromRecord(result.value[0]!));
  }

  /**
   * Resolve entity by ID or alias
   */
  async resolve(identifier: string): Promise<Result<Entity | null, Error>> {
    // Try by ID first
    const byId = await this.findById(identifier as EntityId);
    if (!byId.ok) {
      return byId;
    }

    if (byId.value !== null) {
      return ok(byId.value);
    }

    // Try by alias
    return this.findByAlias(identifier);
  }

  /**
   * Count entities by type
   */
  async countByType(type: string): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, { type });
  }
}
