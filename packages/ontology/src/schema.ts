/**
 * Ontology Schema Definitions
 *
 * Defines the structure of the ontology including:
 * - Entity types and their properties
 * - Relations between entities
 * - Context dimensions
 */

import type { OntologyVersion } from '@contextgraph/core';

/**
 * Property type definition
 */
export interface PropertyDefinition {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'timestamp' | 'json' | 'reference';
  readonly required: boolean;
  readonly description?: string;
  /** For reference types, the allowed entity types */
  readonly refTypes?: readonly string[];
  /** Validation pattern for strings */
  readonly pattern?: string;
  /** Minimum value for numbers */
  readonly min?: number;
  /** Maximum value for numbers */
  readonly max?: number;
}

/**
 * Entity type definition
 */
export interface EntityDefinition {
  readonly name: string;
  readonly description: string;
  readonly properties: readonly PropertyDefinition[];
  /** Whether this entity type is abstract (cannot be instantiated directly) */
  readonly abstract?: boolean;
  /** Parent entity type (for inheritance) */
  readonly extends?: string;
}

/**
 * Cardinality constraints for relations
 */
export type Cardinality = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

/**
 * Relation definition between entity types
 */
export interface RelationDefinition {
  readonly name: string;
  readonly description: string;
  /** Source entity type(s) */
  readonly from: readonly string[];
  /** Target entity type(s) */
  readonly to: readonly string[];
  /** Cardinality constraint */
  readonly cardinality: Cardinality;
  /** Whether this relation is required */
  readonly required?: boolean;
  /** Properties that can be attached to this relation */
  readonly properties?: readonly PropertyDefinition[];
  /** Inverse relation name (for bidirectional queries) */
  readonly inverse?: string;
}

/**
 * Context dimension definition
 */
export interface ContextDimensionDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: 'temporal' | 'jurisdiction' | 'scope' | 'confidence' | 'custom';
  /** Whether this dimension is required on all claims */
  readonly required: boolean;
  /** Allowed values for enumerated dimensions */
  readonly allowedValues?: readonly string[];
}

/**
 * Complete ontology schema
 */
export interface OntologySchema {
  readonly version: OntologyVersion;
  readonly name: string;
  readonly description: string;
  readonly entities: readonly EntityDefinition[];
  readonly relations: readonly RelationDefinition[];
  readonly contextDimensions: readonly ContextDimensionDefinition[];
  /** Previous version this ontology is compatible with */
  readonly compatibleWith?: readonly OntologyVersion[];
  /** Changelog from previous version */
  readonly changelog?: readonly string[];
}

/**
 * Builder for creating ontology schemas
 */
export class OntologySchemaBuilder {
  private entities: EntityDefinition[] = [];
  private relations: RelationDefinition[] = [];
  private contextDimensions: ContextDimensionDefinition[] = [];
  private compatibleWith: OntologyVersion[] = [];
  private changelog: string[] = [];

  constructor(
    private readonly version: OntologyVersion,
    private readonly name: string,
    private readonly description: string
  ) {}

  addEntity(entity: EntityDefinition): this {
    this.entities.push(entity);
    return this;
  }

  addRelation(relation: RelationDefinition): this {
    this.relations.push(relation);
    return this;
  }

  addContextDimension(dimension: ContextDimensionDefinition): this {
    this.contextDimensions.push(dimension);
    return this;
  }

  addCompatibleVersion(version: OntologyVersion): this {
    this.compatibleWith.push(version);
    return this;
  }

  addChangelogEntry(entry: string): this {
    this.changelog.push(entry);
    return this;
  }

  build(): OntologySchema {
    const schema: OntologySchema = {
      version: this.version,
      name: this.name,
      description: this.description,
      entities: [...this.entities],
      relations: [...this.relations],
      contextDimensions: [...this.contextDimensions],
    };

    // Only add optional properties if they have values
    if (this.compatibleWith.length > 0) {
      (schema as { compatibleWith: readonly OntologyVersion[] }).compatibleWith = [...this.compatibleWith];
    }
    if (this.changelog.length > 0) {
      (schema as { changelog: readonly string[] }).changelog = [...this.changelog];
    }

    return schema;
  }
}
