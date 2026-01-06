/**
 * Ontology Loader
 *
 * Loads and manages ontology versions with compatibility checking.
 */

import {
  type OntologyVersion,
  type Result,
  ok,
  err,
} from '@contextgraph/core';
import type { OntologySchema, EntityDefinition, RelationDefinition } from './schema.js';

/**
 * Loaded ontology with indexed lookups
 */
export interface LoadedOntology {
  readonly schema: OntologySchema;
  readonly entityIndex: ReadonlyMap<string, EntityDefinition>;
  readonly relationIndex: ReadonlyMap<string, RelationDefinition>;
  readonly relationsBySource: ReadonlyMap<string, readonly RelationDefinition[]>;
  readonly relationsByTarget: ReadonlyMap<string, readonly RelationDefinition[]>;
}

/**
 * Ontology loader error
 */
export class OntologyLoadError extends Error {
  constructor(
    message: string,
    public readonly version?: OntologyVersion
  ) {
    super(message);
    this.name = 'OntologyLoadError';
  }
}

/**
 * Manages loading and caching of ontology versions
 */
export class OntologyLoader {
  private readonly versions: Map<OntologyVersion, LoadedOntology> = new Map();
  private currentVersion: OntologyVersion | null = null;

  /**
   * Register an ontology schema
   */
  register(schema: OntologySchema): Result<LoadedOntology, OntologyLoadError> {
    const validationResult = this.validateSchema(schema);
    if (!validationResult.ok) {
      return validationResult;
    }

    const loaded = this.indexSchema(schema);
    this.versions.set(schema.version, loaded);
    return ok(loaded);
  }

  /**
   * Load and set the current ontology version
   */
  load(version: OntologyVersion): Result<LoadedOntology, OntologyLoadError> {
    const loaded = this.versions.get(version);
    if (loaded === undefined) {
      return err(new OntologyLoadError(`Ontology version ${version} not registered`, version));
    }
    this.currentVersion = version;
    return ok(loaded);
  }

  /**
   * Get the currently loaded ontology
   */
  getCurrent(): Result<LoadedOntology, OntologyLoadError> {
    if (this.currentVersion === null) {
      return err(new OntologyLoadError('No ontology version loaded'));
    }
    const loaded = this.versions.get(this.currentVersion);
    if (loaded === undefined) {
      return err(new OntologyLoadError('Current ontology not found'));
    }
    return ok(loaded);
  }

  /**
   * Get a specific ontology version
   */
  getVersion(version: OntologyVersion): Result<LoadedOntology, OntologyLoadError> {
    const loaded = this.versions.get(version);
    if (loaded === undefined) {
      return err(new OntologyLoadError(`Ontology version ${version} not found`, version));
    }
    return ok(loaded);
  }

  /**
   * Get the current version string
   */
  getCurrentVersion(): OntologyVersion | null {
    return this.currentVersion;
  }

  /**
   * List all registered versions
   */
  listVersions(): readonly OntologyVersion[] {
    return Array.from(this.versions.keys());
  }

  /**
   * Check if a version is compatible with the current version
   */
  isCompatible(version: OntologyVersion): boolean {
    if (this.currentVersion === null) {
      return false;
    }
    if (version === this.currentVersion) {
      return true;
    }
    const current = this.versions.get(this.currentVersion);
    if (current === undefined) {
      return false;
    }
    return current.schema.compatibleWith?.includes(version) ?? false;
  }

  /**
   * Validate schema internal consistency
   */
  private validateSchema(schema: OntologySchema): Result<void, OntologyLoadError> {
    const entityNames = new Set(schema.entities.map((e) => e.name));
    const relationNames = new Set(schema.relations.map((r) => r.name));

    // Check for duplicate entity names
    if (entityNames.size !== schema.entities.length) {
      return err(new OntologyLoadError('Duplicate entity names in schema', schema.version));
    }

    // Check for duplicate relation names
    if (relationNames.size !== schema.relations.length) {
      return err(new OntologyLoadError('Duplicate relation names in schema', schema.version));
    }

    // Validate entity extends references
    for (const entity of schema.entities) {
      if (entity.extends !== undefined && !entityNames.has(entity.extends)) {
        return err(
          new OntologyLoadError(
            `Entity ${entity.name} extends unknown type: ${entity.extends}`,
            schema.version
          )
        );
      }
    }

    // Validate relation entity references
    for (const relation of schema.relations) {
      for (const from of relation.from) {
        if (!entityNames.has(from)) {
          return err(
            new OntologyLoadError(
              `Relation ${relation.name} references unknown source type: ${from}`,
              schema.version
            )
          );
        }
      }
      for (const to of relation.to) {
        if (!entityNames.has(to)) {
          return err(
            new OntologyLoadError(
              `Relation ${relation.name} references unknown target type: ${to}`,
              schema.version
            )
          );
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Create indexed lookups for the schema
   */
  private indexSchema(schema: OntologySchema): LoadedOntology {
    const entityIndex = new Map<string, EntityDefinition>();
    for (const entity of schema.entities) {
      entityIndex.set(entity.name, entity);
    }

    const relationIndex = new Map<string, RelationDefinition>();
    const relationsBySource = new Map<string, RelationDefinition[]>();
    const relationsByTarget = new Map<string, RelationDefinition[]>();

    for (const relation of schema.relations) {
      relationIndex.set(relation.name, relation);

      for (const from of relation.from) {
        const existing = relationsBySource.get(from) ?? [];
        existing.push(relation);
        relationsBySource.set(from, existing);
      }

      for (const to of relation.to) {
        const existing = relationsByTarget.get(to) ?? [];
        existing.push(relation);
        relationsByTarget.set(to, existing);
      }
    }

    return {
      schema,
      entityIndex,
      relationIndex,
      relationsBySource,
      relationsByTarget,
    };
  }
}
