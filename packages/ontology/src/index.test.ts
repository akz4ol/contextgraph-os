import { describe, it, expect, beforeEach } from 'vitest';
import { createOntologyVersion, createEntityId, createClaimId } from '@contextgraph/core';
import { OntologyLoader, OntologyValidator, ontologyV0_1 } from './index.js';
import type { EntityInput, ClaimInput } from './validator.js';

describe('OntologyLoader', () => {
  let loader: OntologyLoader;

  beforeEach(() => {
    loader = new OntologyLoader();
  });

  it('should register and load ontology', () => {
    const registerResult = loader.register(ontologyV0_1);
    expect(registerResult.ok).toBe(true);

    const loadResult = loader.load(ontologyV0_1.version);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.schema.version).toBe(ontologyV0_1.version);
    }
  });

  it('should fail to load unregistered version', () => {
    const version = createOntologyVersion('9.9.9');
    const result = loader.load(version);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('not registered');
    }
  });

  it('should list all registered versions', () => {
    loader.register(ontologyV0_1);
    const versions = loader.listVersions();
    expect(versions).toContain(ontologyV0_1.version);
  });

  it('should get current version after loading', () => {
    loader.register(ontologyV0_1);
    expect(loader.getCurrentVersion()).toBeNull();

    loader.load(ontologyV0_1.version);
    expect(loader.getCurrentVersion()).toBe(ontologyV0_1.version);
  });

  it('should index entities correctly', () => {
    loader.register(ontologyV0_1);
    const loadResult = loader.load(ontologyV0_1.version);

    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      const { entityIndex } = loadResult.value;
      expect(entityIndex.has('Person')).toBe(true);
      expect(entityIndex.has('Agent')).toBe(true);
      expect(entityIndex.has('Organization')).toBe(true);
      expect(entityIndex.has('Decision')).toBe(true);
    }
  });

  it('should index relations correctly', () => {
    loader.register(ontologyV0_1);
    const loadResult = loader.load(ontologyV0_1.version);

    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      const { relationIndex, relationsBySource } = loadResult.value;
      expect(relationIndex.has('belongsTo')).toBe(true);
      expect(relationIndex.has('proposedBy')).toBe(true);

      const personRelations = relationsBySource.get('Person') ?? [];
      const relationNames = personRelations.map((r) => r.name);
      expect(relationNames).toContain('belongsTo');
      expect(relationNames).toContain('reportsTo');
    }
  });
});

describe('OntologyValidator', () => {
  let validator: OntologyValidator;

  beforeEach(() => {
    const loader = new OntologyLoader();
    loader.register(ontologyV0_1);
    const loadResult = loader.load(ontologyV0_1.version);
    if (!loadResult.ok) throw new Error('Failed to load ontology');
    validator = new OntologyValidator(loadResult.value);
  });

  describe('Entity Validation', () => {
    it('should validate valid entity', () => {
      const entity: EntityInput = {
        id: createEntityId('person-1'),
        type: 'Person',
        properties: {
          name: 'John Doe',
          email: 'john@example.com',
          role: 'Engineer',
        },
      };

      const result = validator.validateEntity(entity);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unknown entity type', () => {
      const entity: EntityInput = {
        id: createEntityId('unknown-1'),
        type: 'UnknownType',
        properties: {},
      };

      const result = validator.validateEntity(entity);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('UNKNOWN_ENTITY_TYPE');
    });

    it('should reject abstract entity type', () => {
      const entity: EntityInput = {
        id: createEntityId('actor-1'),
        type: 'Actor',
        properties: {},
      };

      const result = validator.validateEntity(entity);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ABSTRACT_ENTITY')).toBe(true);
    });

    it('should validate email pattern', () => {
      const entity: EntityInput = {
        id: createEntityId('person-2'),
        type: 'Person',
        properties: {
          email: 'invalid-email',
        },
      };

      const result = validator.validateEntity(entity);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'PATTERN_MISMATCH')).toBe(true);
    });

    it('should require required properties for Agent', () => {
      const entity: EntityInput = {
        id: createEntityId('agent-1'),
        type: 'Agent',
        properties: {
          name: 'TestAgent',
          // Missing required: agentType
        },
      };

      const result = validator.validateEntity(entity);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'REQUIRED_PROPERTY_MISSING')).toBe(true);
    });

    it('should warn about unknown properties', () => {
      const entity: EntityInput = {
        id: createEntityId('person-3'),
        type: 'Person',
        properties: {
          unknownProp: 'value',
        },
      };

      const result = validator.validateEntity(entity);
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_PROPERTY')).toBe(true);
    });
  });

  describe('Claim Validation', () => {
    it('should validate valid claim', () => {
      const claim: ClaimInput = {
        id: createClaimId('claim-1'),
        subjectType: 'Person',
        predicate: 'belongsTo',
        objectType: 'Organization',
        context: {
          temporal: { start: Date.now(), end: null },
        },
      };

      const result = validator.validateClaim(claim);
      expect(result.valid).toBe(true);
    });

    it('should reject unknown predicate', () => {
      const claim: ClaimInput = {
        id: createClaimId('claim-2'),
        subjectType: 'Person',
        predicate: 'unknownRelation',
        objectType: 'Organization',
        context: {
          temporal: { start: Date.now(), end: null },
        },
      };

      const result = validator.validateClaim(claim);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_PREDICATE')).toBe(true);
    });

    it('should reject invalid subject type for relation', () => {
      const claim: ClaimInput = {
        id: createClaimId('claim-3'),
        subjectType: 'Organization', // Organization cannot "belongsTo"
        predicate: 'belongsTo',
        objectType: 'Team',
        context: {
          temporal: { start: Date.now(), end: null },
        },
      };

      const result = validator.validateClaim(claim);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_SUBJECT_TYPE')).toBe(true);
    });

    it('should reject invalid object type for relation', () => {
      const claim: ClaimInput = {
        id: createClaimId('claim-4'),
        subjectType: 'Person',
        predicate: 'belongsTo',
        objectType: 'Person', // Person cannot belong to Person
        context: {
          temporal: { start: Date.now(), end: null },
        },
      };

      const result = validator.validateClaim(claim);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_OBJECT_TYPE')).toBe(true);
    });

    it('should require temporal context', () => {
      const claim: ClaimInput = {
        id: createClaimId('claim-5'),
        subjectType: 'Person',
        predicate: 'belongsTo',
        objectType: 'Organization',
        context: {}, // Missing temporal
      };

      const result = validator.validateClaim(claim);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'REQUIRED_CONTEXT_MISSING')).toBe(true);
    });
  });

  describe('Relation Validation', () => {
    it('should validate correct relation', () => {
      const result = validator.isValidRelation('Person', 'belongsTo', 'Organization');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should reject invalid relation', () => {
      const result = validator.isValidRelation('Organization', 'belongsTo', 'Person');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('should error on unknown relation', () => {
      const result = validator.isValidRelation('Person', 'unknownRelation', 'Organization');
      expect(result.ok).toBe(false);
    });

    it('should get valid relations from entity type', () => {
      const relations = validator.getValidRelationsFrom('Person');
      const names = relations.map((r) => r.name);
      expect(names).toContain('belongsTo');
      expect(names).toContain('reportsTo');
      expect(names).toContain('worksOn');
    });
  });
});
