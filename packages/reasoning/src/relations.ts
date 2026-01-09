/**
 * Relation Registry
 *
 * Manages relation definitions and their inference properties
 */

import type { RelationDefinition, RelationType } from './types.js';

/**
 * Built-in transitive relations
 */
const TRANSITIVE_RELATIONS: RelationDefinition[] = [
  {
    name: 'partOf',
    type: 'transitive',
    description: 'A is part of B, B is part of C => A is part of C',
  },
  {
    name: 'subclassOf',
    type: 'transitive',
    description: 'A is subclass of B, B is subclass of C => A is subclass of C',
  },
  {
    name: 'locatedIn',
    type: 'transitive',
    description: 'A is located in B, B is located in C => A is located in C',
  },
  {
    name: 'reportsTo',
    type: 'transitive',
    description: 'A reports to B, B reports to C => A reports to C',
  },
  {
    name: 'ancestorOf',
    type: 'transitive',
    description: 'A is ancestor of B, B is ancestor of C => A is ancestor of C',
  },
];

/**
 * Built-in symmetric relations
 */
const SYMMETRIC_RELATIONS: RelationDefinition[] = [
  {
    name: 'knows',
    type: 'symmetric',
    description: 'A knows B => B knows A',
  },
  {
    name: 'collaboratesWith',
    type: 'symmetric',
    description: 'A collaborates with B => B collaborates with A',
  },
  {
    name: 'relatedTo',
    type: 'symmetric',
    description: 'A is related to B => B is related to A',
  },
  {
    name: 'siblingOf',
    type: 'symmetric',
    description: 'A is sibling of B => B is sibling of A',
  },
  {
    name: 'marriedTo',
    type: 'symmetric',
    description: 'A is married to B => B is married to A',
  },
];

/**
 * Built-in inverse relations
 */
const INVERSE_RELATIONS: RelationDefinition[] = [
  {
    name: 'parentOf',
    type: 'inverse',
    inverseName: 'childOf',
    description: 'A is parent of B <=> B is child of A',
  },
  {
    name: 'employs',
    type: 'inverse',
    inverseName: 'employedBy',
    description: 'A employs B <=> B is employed by A',
  },
  {
    name: 'owns',
    type: 'inverse',
    inverseName: 'ownedBy',
    description: 'A owns B <=> B is owned by A',
  },
  {
    name: 'manages',
    type: 'inverse',
    inverseName: 'managedBy',
    description: 'A manages B <=> B is managed by A',
  },
  {
    name: 'creates',
    type: 'inverse',
    inverseName: 'createdBy',
    description: 'A creates B <=> B is created by A',
  },
  {
    name: 'contains',
    type: 'inverse',
    inverseName: 'containedIn',
    description: 'A contains B <=> B is contained in A',
  },
];

/**
 * Relation Registry
 */
export class RelationRegistry {
  private relations: Map<string, RelationDefinition> = new Map();
  private inverseMap: Map<string, string> = new Map();

  constructor() {
    // Register built-in relations
    for (const rel of TRANSITIVE_RELATIONS) {
      this.register(rel);
    }
    for (const rel of SYMMETRIC_RELATIONS) {
      this.register(rel);
    }
    for (const rel of INVERSE_RELATIONS) {
      this.register(rel);
    }
  }

  /**
   * Register a relation definition
   */
  register(definition: RelationDefinition): void {
    this.relations.set(definition.name, definition);

    // For inverse relations, also register the inverse
    if (definition.type === 'inverse' && definition.inverseName !== undefined) {
      this.inverseMap.set(definition.name, definition.inverseName);
      this.inverseMap.set(definition.inverseName, definition.name);

      // Register the inverse relation too
      if (!this.relations.has(definition.inverseName)) {
        this.relations.set(definition.inverseName, {
          name: definition.inverseName,
          type: 'inverse',
          inverseName: definition.name,
          description: `Inverse of ${definition.name}`,
        });
      }
    }
  }

  /**
   * Get a relation definition
   */
  get(name: string): RelationDefinition | undefined {
    return this.relations.get(name);
  }

  /**
   * Get all relations of a specific type
   */
  getByType(type: RelationType): RelationDefinition[] {
    return Array.from(this.relations.values()).filter((r) => r.type === type);
  }

  /**
   * Get the inverse of a relation
   */
  getInverse(name: string): string | undefined {
    const definition = this.relations.get(name);

    // Symmetric relations are their own inverse
    if (definition?.type === 'symmetric') {
      return name;
    }

    return this.inverseMap.get(name);
  }

  /**
   * Check if a relation is transitive
   */
  isTransitive(name: string): boolean {
    return this.relations.get(name)?.type === 'transitive';
  }

  /**
   * Check if a relation is symmetric
   */
  isSymmetric(name: string): boolean {
    return this.relations.get(name)?.type === 'symmetric';
  }

  /**
   * Check if a relation has an inverse
   */
  hasInverse(name: string): boolean {
    const def = this.relations.get(name);
    return def?.type === 'symmetric' || def?.type === 'inverse';
  }

  /**
   * Get all registered relations
   */
  getAll(): RelationDefinition[] {
    return Array.from(this.relations.values());
  }

  /**
   * Get count of registered relations
   */
  get size(): number {
    return this.relations.size;
  }
}

/**
 * Create a default relation registry with built-in relations
 */
export function createRelationRegistry(): RelationRegistry {
  return new RelationRegistry();
}
