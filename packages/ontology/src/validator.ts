/**
 * Ontology Validator
 *
 * Validates claims and entities against the ontology schema.
 * Ensures all data conforms to defined types and relations.
 */

import {
  type Result,
  ok,
  err,
  OntologyViolationError,
  type EntityId,
  type ClaimId,
} from '@contextgraph/core';
import type { LoadedOntology } from './loader.js';
import type { EntityDefinition, RelationDefinition, PropertyDefinition } from './schema.js';

/**
 * Validation result with details
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export interface ValidationWarning {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Entity to validate
 */
export interface EntityInput {
  readonly id: EntityId;
  readonly type: string;
  readonly properties: Record<string, unknown>;
}

/**
 * Claim to validate
 */
export interface ClaimInput {
  readonly id: ClaimId;
  readonly subjectType: string;
  readonly predicate: string;
  readonly objectType?: string;
  readonly objectValue?: unknown;
  readonly context: Record<string, unknown>;
}

/**
 * Validates data against the ontology
 */
export class OntologyValidator {
  constructor(private readonly ontology: LoadedOntology) {}

  /**
   * Validate an entity against the ontology
   */
  validateEntity(entity: EntityInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check entity type exists
    const entityDef = this.ontology.entityIndex.get(entity.type);
    if (entityDef === undefined) {
      errors.push({
        path: 'type',
        message: `Unknown entity type: ${entity.type}`,
        code: 'UNKNOWN_ENTITY_TYPE',
      });
      return { valid: false, errors, warnings };
    }

    // Check if entity type is abstract
    if (entityDef.abstract === true) {
      errors.push({
        path: 'type',
        message: `Cannot instantiate abstract entity type: ${entity.type}`,
        code: 'ABSTRACT_ENTITY',
      });
    }

    // Get all properties including inherited ones
    const allProperties = this.getInheritedProperties(entityDef);

    // Validate required properties
    for (const prop of allProperties) {
      if (prop.required && entity.properties[prop.name] === undefined) {
        errors.push({
          path: `properties.${prop.name}`,
          message: `Required property missing: ${prop.name}`,
          code: 'REQUIRED_PROPERTY_MISSING',
        });
      }
    }

    // Validate property types
    for (const [propName, propValue] of Object.entries(entity.properties)) {
      const propDef = allProperties.find((p) => p.name === propName);
      if (propDef === undefined) {
        warnings.push({
          path: `properties.${propName}`,
          message: `Unknown property: ${propName}`,
          code: 'UNKNOWN_PROPERTY',
        });
        continue;
      }

      const propErrors = this.validatePropertyValue(propDef, propValue, `properties.${propName}`);
      errors.push(...propErrors);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a claim against the ontology
   */
  validateClaim(claim: ClaimInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check subject type exists
    if (!this.ontology.entityIndex.has(claim.subjectType)) {
      errors.push({
        path: 'subjectType',
        message: `Unknown subject type: ${claim.subjectType}`,
        code: 'UNKNOWN_SUBJECT_TYPE',
      });
    }

    // Check predicate (relation) exists
    const relationDef = this.ontology.relationIndex.get(claim.predicate);
    if (relationDef === undefined) {
      errors.push({
        path: 'predicate',
        message: `Unknown predicate: ${claim.predicate}`,
        code: 'UNKNOWN_PREDICATE',
      });
      return { valid: false, errors, warnings };
    }

    // Check subject type is allowed for this relation
    if (!relationDef.from.includes(claim.subjectType)) {
      errors.push({
        path: 'subjectType',
        message: `Subject type ${claim.subjectType} not allowed for relation ${claim.predicate}`,
        code: 'INVALID_SUBJECT_TYPE',
      });
    }

    // Check object type if provided
    if (claim.objectType !== undefined) {
      if (!this.ontology.entityIndex.has(claim.objectType)) {
        errors.push({
          path: 'objectType',
          message: `Unknown object type: ${claim.objectType}`,
          code: 'UNKNOWN_OBJECT_TYPE',
        });
      } else if (!relationDef.to.includes(claim.objectType)) {
        errors.push({
          path: 'objectType',
          message: `Object type ${claim.objectType} not allowed for relation ${claim.predicate}`,
          code: 'INVALID_OBJECT_TYPE',
        });
      }
    }

    // Validate context dimensions
    const contextErrors = this.validateContext(claim.context);
    errors.push(...contextErrors);

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check if a relation is valid between two entity types
   */
  isValidRelation(
    fromType: string,
    relationName: string,
    toType: string
  ): Result<boolean, OntologyViolationError> {
    const relation = this.ontology.relationIndex.get(relationName);
    if (relation === undefined) {
      return err(
        new OntologyViolationError(`Unknown relation: ${relationName}`, undefined, relationName)
      );
    }

    const fromValid = relation.from.includes(fromType);
    const toValid = relation.to.includes(toType);

    return ok(fromValid && toValid);
  }

  /**
   * Get all valid relations from a given entity type
   */
  getValidRelationsFrom(entityType: string): readonly RelationDefinition[] {
    return this.ontology.relationsBySource.get(entityType) ?? [];
  }

  /**
   * Get all valid relations to a given entity type
   */
  getValidRelationsTo(entityType: string): readonly RelationDefinition[] {
    return this.ontology.relationsByTarget.get(entityType) ?? [];
  }

  /**
   * Get inherited properties for an entity definition
   */
  private getInheritedProperties(entityDef: EntityDefinition): readonly PropertyDefinition[] {
    const properties: PropertyDefinition[] = [...entityDef.properties];

    if (entityDef.extends !== undefined) {
      const parent = this.ontology.entityIndex.get(entityDef.extends);
      if (parent !== undefined) {
        const parentProps = this.getInheritedProperties(parent);
        // Parent properties first, then override with child
        const propNames = new Set(properties.map((p) => p.name));
        for (const parentProp of parentProps) {
          if (!propNames.has(parentProp.name)) {
            properties.unshift(parentProp);
          }
        }
      }
    }

    return properties;
  }

  /**
   * Validate a single property value
   */
  private validatePropertyValue(
    propDef: PropertyDefinition,
    value: unknown,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (value === null || value === undefined) {
      if (propDef.required) {
        errors.push({
          path,
          message: `Required property is null or undefined`,
          code: 'REQUIRED_PROPERTY_NULL',
        });
      }
      return errors;
    }

    switch (propDef.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            path,
            message: `Expected string, got ${typeof value}`,
            code: 'INVALID_TYPE',
          });
        } else if (propDef.pattern !== undefined) {
          const regex = new RegExp(propDef.pattern);
          if (!regex.test(value)) {
            errors.push({
              path,
              message: `Value does not match pattern: ${propDef.pattern}`,
              code: 'PATTERN_MISMATCH',
            });
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push({
            path,
            message: `Expected number, got ${typeof value}`,
            code: 'INVALID_TYPE',
          });
        } else {
          if (propDef.min !== undefined && value < propDef.min) {
            errors.push({
              path,
              message: `Value ${value} is below minimum ${propDef.min}`,
              code: 'BELOW_MINIMUM',
            });
          }
          if (propDef.max !== undefined && value > propDef.max) {
            errors.push({
              path,
              message: `Value ${value} is above maximum ${propDef.max}`,
              code: 'ABOVE_MAXIMUM',
            });
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            path,
            message: `Expected boolean, got ${typeof value}`,
            code: 'INVALID_TYPE',
          });
        }
        break;

      case 'timestamp':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          errors.push({
            path,
            message: `Expected timestamp (positive integer), got ${typeof value}`,
            code: 'INVALID_TYPE',
          });
        }
        break;

      case 'json':
        // JSON accepts any value that can be serialized
        try {
          JSON.stringify(value);
        } catch {
          errors.push({
            path,
            message: `Value cannot be serialized to JSON`,
            code: 'INVALID_JSON',
          });
        }
        break;

      case 'reference':
        if (typeof value !== 'string') {
          errors.push({
            path,
            message: `Expected reference (string ID), got ${typeof value}`,
            code: 'INVALID_TYPE',
          });
        }
        break;
    }

    return errors;
  }

  /**
   * Validate context dimensions
   */
  private validateContext(context: Record<string, unknown>): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const dimension of this.ontology.schema.contextDimensions) {
      const value = context[dimension.name];

      if (dimension.required && value === undefined) {
        errors.push({
          path: `context.${dimension.name}`,
          message: `Required context dimension missing: ${dimension.name}`,
          code: 'REQUIRED_CONTEXT_MISSING',
        });
        continue;
      }

      if (value !== undefined && dimension.allowedValues !== undefined) {
        if (!dimension.allowedValues.includes(String(value))) {
          errors.push({
            path: `context.${dimension.name}`,
            message: `Invalid value for ${dimension.name}: ${String(value)}`,
            code: 'INVALID_CONTEXT_VALUE',
          });
        }
      }
    }

    return errors;
  }
}
