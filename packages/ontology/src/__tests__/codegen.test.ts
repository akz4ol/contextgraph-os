/**
 * Code Generation Tests
 */

import { describe, it, expect } from 'vitest';
import { generateTypes, generateValidators, generateDocs } from '../codegen.js';
import { OntologySchemaBuilder } from '../schema.js';
import { ontologyV0_1 } from '../versions/v0.1.js';

describe('generateTypes', () => {
  const simpleSchema = new OntologySchemaBuilder('1.0.0', 'Test Schema', 'Test description')
    .addEntity({
      name: 'Entity',
      description: 'Base entity',
      abstract: true,
      properties: [
        { name: 'id', type: 'string', required: true, description: 'Unique ID' },
        { name: 'name', type: 'string', required: false },
      ],
    })
    .addEntity({
      name: 'Person',
      description: 'A person entity',
      extends: 'Entity',
      properties: [
        { name: 'email', type: 'string', required: false, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        { name: 'age', type: 'number', required: false, min: 0, max: 150 },
        { name: 'active', type: 'boolean', required: true },
        { name: 'metadata', type: 'json', required: false },
        { name: 'createdAt', type: 'timestamp', required: true },
        { name: 'managerId', type: 'reference', required: false, refTypes: ['Person'] },
      ],
    })
    .addRelation({
      name: 'manages',
      description: 'Manager relationship',
      from: ['Person'],
      to: ['Person'],
      cardinality: 'one-to-many',
      inverse: 'reportsTo',
    })
    .addContextDimension({
      name: 'temporal',
      description: 'Time context',
      type: 'temporal',
      required: true,
    })
    .addContextDimension({
      name: 'confidence',
      description: 'Confidence level',
      type: 'confidence',
      required: false,
    })
    .build();

  it('should generate header with version info', () => {
    const types = generateTypes(simpleSchema);

    expect(types).toContain('Generated TypeScript types from Test Schema');
    expect(types).toContain('Schema version: 1.0.0');
    expect(types).toContain('DO NOT EDIT');
  });

  it('should generate entity interfaces', () => {
    const types = generateTypes(simpleSchema);

    expect(types).toContain('export interface Entity {');
    expect(types).toContain('export interface Person extends Entity {');
  });

  it('should include JSDoc comments', () => {
    const types = generateTypes(simpleSchema, { includeComments: true });

    expect(types).toContain('* Base entity');
    expect(types).toContain('* A person entity');
    expect(types).toContain('* Unique ID');
  });

  it('should omit JSDoc comments when disabled', () => {
    const types = generateTypes(simpleSchema, { includeComments: false });

    expect(types).not.toContain('* Base entity');
    expect(types).not.toContain('* A person entity');
  });

  it('should generate correct property types', () => {
    const types = generateTypes(simpleSchema);

    expect(types).toContain('id: string;');
    expect(types).toContain('age?: number;');
    expect(types).toContain('active: boolean;');
    expect(types).toContain('metadata?: unknown;');
    expect(types).toContain('createdAt: number;');
    expect(types).toContain('managerId?: string;');
  });

  it('should use Date for timestamp when option is set', () => {
    const types = generateTypes(simpleSchema, { timestampAsDate: true });

    expect(types).toContain('createdAt: Date;');
  });

  it('should generate readonly properties when option is set', () => {
    const types = generateTypes(simpleSchema, { readonly: true });

    expect(types).toContain('readonly id: string;');
    expect(types).toContain('readonly email?: string;');
  });

  it('should generate relation types', () => {
    const types = generateTypes(simpleSchema);

    expect(types).toContain('export interface ManagesRelation {');
    expect(types).toContain("name: 'manages';");
    expect(types).toContain("from: 'Person';");
    expect(types).toContain("to: 'Person';");
    expect(types).toContain("cardinality: 'one-to-many';");
  });

  it('should generate context dimension types', () => {
    const types = generateTypes(simpleSchema);

    expect(types).toContain('export interface TemporalContext {');
    expect(types).toContain('validFrom: number;');
    expect(types).toContain('validUntil?: number;');
    expect(types).toContain('export type ConfidenceContext = number;');
  });

  it('should generate entity type union', () => {
    const types = generateTypes(simpleSchema);

    expect(types).toContain('export type AnyEntity = Person;');
    expect(types).toContain("export type EntityTypeName = 'Person';");
  });

  it('should wrap in namespace when specified', () => {
    const types = generateTypes(simpleSchema, { namespace: 'ContextGraph' });

    expect(types).toContain('export namespace ContextGraph {');
    expect(types.endsWith('}\n')).toBe(true);
  });

  it('should work with v0.1 ontology', () => {
    const types = generateTypes(ontologyV0_1);

    expect(types).toContain('export interface Entity {');
    expect(types).toContain('export interface Person extends Actor {');
    expect(types).toContain('export interface Agent extends Actor {');
    expect(types).toContain('export interface Organization extends Entity {');
  });
});

describe('generateValidators', () => {
  const simpleSchema = new OntologySchemaBuilder('1.0.0', 'Test Schema', 'Test description')
    .addEntity({
      name: 'Entity',
      description: 'Base entity',
      abstract: true,
      properties: [
        { name: 'id', type: 'string', required: true },
      ],
    })
    .addEntity({
      name: 'Person',
      description: 'A person',
      extends: 'Entity',
      properties: [
        { name: 'email', type: 'string', required: false, pattern: '^[^@]+@[^@]+$' },
        { name: 'age', type: 'number', required: false, min: 0, max: 150 },
        { name: 'active', type: 'boolean', required: true },
      ],
    })
    .build();

  it('should generate header with version info', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain('Generated Zod validators from Test Schema');
    expect(validators).toContain('Schema version: 1.0.0');
  });

  it('should import zod', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain("import { z } from 'zod';");
  });

  it('should generate zod schemas', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain('export const entitySchema = z.object({');
    expect(validators).toContain('export const personSchema = entitySchema.extend({');
  });

  it('should generate correct zod types', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain('id: z.string(),');
    expect(validators).toContain('active: z.boolean(),');
    expect(validators).toContain('age: z.number().min(0).max(150).optional(),');
  });

  it('should include regex pattern for strings', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain('.regex(/^[^@]+@[^@]+$/)');
  });

  it('should generate entity schema map', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain('export const entitySchemas = {');
    expect(validators).toContain("'Person': personSchema,");
  });

  it('should generate inferred types', () => {
    const validators = generateValidators(simpleSchema);

    expect(validators).toContain('export type Entity = z.infer<typeof entitySchema>;');
    expect(validators).toContain('export type Person = z.infer<typeof personSchema>;');
  });

  it('should work with v0.1 ontology', () => {
    const validators = generateValidators(ontologyV0_1);

    expect(validators).toContain('export const entitySchema = z.object({');
    expect(validators).toContain('export const personSchema = actorSchema.extend({');
  });
});

describe('generateDocs', () => {
  const simpleSchema = new OntologySchemaBuilder('1.0.0', 'Test Schema', 'A test ontology schema')
    .addEntity({
      name: 'Person',
      description: 'A person entity',
      properties: [
        { name: 'name', type: 'string', required: true, description: 'Full name' },
        { name: 'age', type: 'number', required: false },
      ],
    })
    .addRelation({
      name: 'knows',
      description: 'Person knows another person',
      from: ['Person'],
      to: ['Person'],
      cardinality: 'many-to-many',
      inverse: 'knownBy',
    })
    .addContextDimension({
      name: 'temporal',
      description: 'Time validity',
      type: 'temporal',
      required: true,
    })
    .addChangelogEntry('Initial version')
    .build();

  describe('markdown format', () => {
    it('should generate title and version', () => {
      const docs = generateDocs(simpleSchema, 'markdown');

      expect(docs).toContain('# Test Schema');
      expect(docs).toContain('**Version:** 1.0.0');
      expect(docs).toContain('A test ontology schema');
    });

    it('should document entities', () => {
      const docs = generateDocs(simpleSchema, 'markdown');

      expect(docs).toContain('## Entities');
      expect(docs).toContain('### Person');
      expect(docs).toContain('A person entity');
      expect(docs).toContain('| `name` | string | Yes | Full name |');
      expect(docs).toContain('| `age` | number | No | - |');
    });

    it('should document relations', () => {
      const docs = generateDocs(simpleSchema, 'markdown');

      expect(docs).toContain('## Relations');
      expect(docs).toContain('### knows');
      expect(docs).toContain('- **From:** Person');
      expect(docs).toContain('- **To:** Person');
      expect(docs).toContain('- **Cardinality:** many-to-many');
      expect(docs).toContain('- **Inverse:** knownBy');
    });

    it('should document context dimensions', () => {
      const docs = generateDocs(simpleSchema, 'markdown');

      expect(docs).toContain('## Context Dimensions');
      expect(docs).toContain('### temporal *(required)*');
      expect(docs).toContain('- **Type:** temporal');
    });

    it('should include changelog', () => {
      const docs = generateDocs(simpleSchema, 'markdown');

      expect(docs).toContain('## Changelog');
      expect(docs).toContain('- Initial version');
    });

    it('should mark abstract entities', () => {
      const schemaWithAbstract = new OntologySchemaBuilder('1.0.0', 'Test', 'Test')
        .addEntity({
          name: 'Base',
          description: 'Abstract base',
          abstract: true,
          properties: [],
        })
        .build();

      const docs = generateDocs(schemaWithAbstract, 'markdown');

      expect(docs).toContain('### Base *(abstract)*');
    });

    it('should show inheritance', () => {
      const schemaWithInheritance = new OntologySchemaBuilder('1.0.0', 'Test', 'Test')
        .addEntity({
          name: 'Base',
          description: 'Base entity',
          properties: [],
        })
        .addEntity({
          name: 'Child',
          description: 'Child entity',
          extends: 'Base',
          properties: [],
        })
        .build();

      const docs = generateDocs(schemaWithInheritance, 'markdown');

      expect(docs).toContain('### Child extends `Base`');
    });
  });

  describe('json format', () => {
    it('should generate valid JSON', () => {
      const docs = generateDocs(simpleSchema, 'json');

      expect(() => JSON.parse(docs)).not.toThrow();
    });

    it('should include all schema data', () => {
      const docs = generateDocs(simpleSchema, 'json');
      const parsed = JSON.parse(docs);

      expect(parsed.name).toBe('Test Schema');
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.entities).toHaveLength(1);
      expect(parsed.entities[0].name).toBe('Person');
      expect(parsed.relations).toHaveLength(1);
      expect(parsed.relations[0].name).toBe('knows');
      expect(parsed.contextDimensions).toHaveLength(1);
    });
  });
});

describe('inheritance handling', () => {
  it('should sort entities by inheritance order', () => {
    // Schema with out-of-order inheritance
    const schema = new OntologySchemaBuilder('1.0.0', 'Test', 'Test')
      .addEntity({
        name: 'Child',
        description: 'Child',
        extends: 'Parent',
        properties: [{ name: 'childProp', type: 'string', required: false }],
      })
      .addEntity({
        name: 'Parent',
        description: 'Parent',
        extends: 'GrandParent',
        properties: [{ name: 'parentProp', type: 'string', required: false }],
      })
      .addEntity({
        name: 'GrandParent',
        description: 'GrandParent',
        properties: [{ name: 'grandProp', type: 'string', required: true }],
      })
      .build();

    const types = generateTypes(schema);
    const validators = generateValidators(schema);

    // GrandParent should appear before Parent, Parent before Child
    const gpIndex = types.indexOf('interface GrandParent');
    const pIndex = types.indexOf('interface Parent');
    const cIndex = types.indexOf('interface Child');

    expect(gpIndex).toBeLessThan(pIndex);
    expect(pIndex).toBeLessThan(cIndex);

    // Same for validators
    const gpSchemaIndex = validators.indexOf('grandParentSchema');
    const pSchemaIndex = validators.indexOf('parentSchema');
    const cSchemaIndex = validators.indexOf('childSchema');

    expect(gpSchemaIndex).toBeLessThan(pSchemaIndex);
    expect(pSchemaIndex).toBeLessThan(cSchemaIndex);
  });
});
