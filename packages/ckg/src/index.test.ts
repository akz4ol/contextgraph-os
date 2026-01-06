import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createEntityId,
  createProvenanceId,
  createTimestamp,
  createTimeInterval,
  type Timestamp,
  type ContextDimensions,
} from '@contextgraph/core';
import { OntologyLoader, ontologyV0_1 } from '@contextgraph/ontology';
import { InMemoryStorage, SQLiteStorage } from '@contextgraph/storage';
import { CKG, Entity, Claim, ContextFilter } from './index.js';

describe('Entity', () => {
  it('should create entity without ontology validation', () => {
    const result = Entity.create({
      type: 'Person',
      name: 'John Doe',
      properties: { role: 'Engineer' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.type).toBe('Person');
      expect(result.value.data.name).toBe('John Doe');
    }
  });

  it('should create entity with custom ID', () => {
    const id = createEntityId('custom-id');
    const result = Entity.create({ id, type: 'Agent', properties: {} });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.id).toBe('custom-id');
    }
  });

  it('should validate against ontology when provided', () => {
    const loader = new OntologyLoader();
    loader.register(ontologyV0_1);
    const loadResult = loader.load(ontologyV0_1.version);
    if (!loadResult.ok) throw new Error('Failed to load ontology');
    const ontology = loadResult.value;

    // Person type requires no properties to be required
    const result = Entity.create(
      { type: 'Person', name: 'Jane', properties: {} },
      ontology
    );

    expect(result.ok).toBe(true);
  });

  it('should reject abstract entity type with ontology', () => {
    const loader = new OntologyLoader();
    loader.register(ontologyV0_1);
    const loadResult = loader.load(ontologyV0_1.version);
    if (!loadResult.ok) throw new Error('Failed to load ontology');
    const ontology = loadResult.value;

    const result = Entity.create(
      { type: 'Actor', properties: {} }, // Actor is abstract
      ontology
    );

    expect(result.ok).toBe(false);
  });

  it('should handle aliases', () => {
    const result = Entity.create({
      type: 'Person',
      name: 'John Doe',
      aliases: ['JD', 'Johnny'],
      properties: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hasAlias('JD')).toBe(true);
      expect(result.value.hasAlias('Johnny')).toBe(true);
      expect(result.value.hasAlias('Unknown')).toBe(false);
    }
  });

  it('should serialize and deserialize correctly', () => {
    const result = Entity.create({
      type: 'Person',
      name: 'Test',
      aliases: ['T1', 'T2'],
      properties: { key: 'value' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const record = result.value.toRecord();
      const restored = Entity.fromRecord(record);
      expect(restored.data.name).toBe('Test');
      expect(restored.data.aliases).toEqual(['T1', 'T2']);
      expect(restored.data.properties).toEqual({ key: 'value' });
    }
  });
});

describe('Claim', () => {
  const createContext = (): ContextDimensions => ({
    temporal: createTimeInterval(createTimestamp()),
  });

  it('should create claim with object entity', () => {
    const result = Claim.create({
      subjectId: createEntityId('subject-1'),
      subjectType: 'Person',
      predicate: 'belongsTo',
      objectId: createEntityId('object-1'),
      objectType: 'Organization',
      context: createContext(),
      provenanceId: createProvenanceId('prov-1'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.predicate).toBe('belongsTo');
      expect(result.value.data.objectId).toBeDefined();
    }
  });

  it('should create claim with object value', () => {
    const result = Claim.create({
      subjectId: createEntityId('subject-2'),
      subjectType: 'Person',
      predicate: 'hasRole',
      objectValue: 'Manager',
      context: createContext(),
      provenanceId: createProvenanceId('prov-2'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.objectValue).toBe('Manager');
    }
  });

  it('should reject claim without object', () => {
    const result = Claim.create({
      subjectId: createEntityId('subject-3'),
      subjectType: 'Person',
      predicate: 'test',
      context: createContext(),
      provenanceId: createProvenanceId('prov-3'),
    });

    expect(result.ok).toBe(false);
  });

  it('should check temporal validity', () => {
    const now = createTimestamp();
    const past = (now - 10000) as Timestamp;
    const future = (now + 10000) as Timestamp;

    const result = Claim.create({
      subjectId: createEntityId('subject-4'),
      subjectType: 'Person',
      predicate: 'test',
      objectValue: 'value',
      context: {
        temporal: createTimeInterval(past, future),
      },
      provenanceId: createProvenanceId('prov-4'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isValidAt(now)).toBe(true);
      expect(result.value.isValidAt((past - 1000) as Timestamp)).toBe(false);
      expect(result.value.isValidAt((future + 1000) as Timestamp)).toBe(false);
    }
  });
});

describe('ContextFilter', () => {
  const filter = new ContextFilter();

  const createClaim = (
    id: string,
    subjectId: string,
    predicate: string,
    temporal: { start: Timestamp; end: Timestamp | null }
  ): Claim => {
    const result = Claim.create({
      subjectId: createEntityId(subjectId),
      subjectType: 'Person',
      predicate,
      objectValue: 'test',
      context: {
        temporal: createTimeInterval(temporal.start, temporal.end ?? undefined),
      },
      provenanceId: createProvenanceId('test'),
    });
    if (!result.ok) throw new Error('Failed to create claim');
    return result.value;
  };

  it('should filter by point in time', () => {
    const now = createTimestamp();
    const claims = [
      createClaim('1', 's1', 'p1', { start: (now - 5000) as Timestamp, end: (now + 5000) as Timestamp }),
      createClaim('2', 's2', 'p2', { start: (now + 10000) as Timestamp, end: null }), // Future claim
    ];

    const result = filter.filterAsOf(claims, now);
    expect(result.claims.length).toBe(1);
    expect(result.excluded.length).toBe(1);
  });

  it('should find conflicting claims', () => {
    const now = createTimestamp();
    // Same subject and predicate, different objects
    const claim1 = Claim.create({
      subjectId: createEntityId('entity-1'),
      subjectType: 'Person',
      predicate: 'hasRole',
      objectValue: 'Manager',
      context: { temporal: createTimeInterval(now) },
      provenanceId: createProvenanceId('p1'),
    });
    const claim2 = Claim.create({
      subjectId: createEntityId('entity-1'),
      subjectType: 'Person',
      predicate: 'hasRole',
      objectValue: 'Developer', // Different value!
      context: { temporal: createTimeInterval(now) },
      provenanceId: createProvenanceId('p2'),
    });

    if (!claim1.ok || !claim2.ok) throw new Error('Failed to create claims');

    const conflicts = filter.findConflicts([claim1.value, claim2.value]);
    expect(conflicts.size).toBe(1);
  });
});

describe('CKG Integration', () => {
  let storage: SQLiteStorage;
  let ckg: CKG;

  beforeEach(async () => {
    storage = new SQLiteStorage({ path: ':memory:' });
    await storage.initialize();
    ckg = new CKG({ storage, requireProvenance: false }); // Disable for easier testing
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should create and retrieve entities', async () => {
    const createResult = await ckg.createEntity({
      type: 'Person',
      name: 'Test User',
      properties: { role: 'Tester' },
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = await ckg.getEntity(createResult.value.data.id);
    expect(getResult.ok).toBe(true);
    if (getResult.ok && getResult.value !== null) {
      expect(getResult.value.data.name).toBe('Test User');
    }
  });

  it('should create claims linking entities', async () => {
    const person = await ckg.createEntity({ type: 'Person', name: 'Alice', properties: {} });
    const org = await ckg.createEntity({ type: 'Organization', name: 'Acme', properties: { orgType: 'company' } });

    if (!person.ok || !org.ok) throw new Error('Failed to create entities');

    const claimResult = await ckg.createClaim({
      subjectId: person.value.data.id,
      subjectType: 'Person',
      predicate: 'belongsTo',
      objectId: org.value.data.id,
      objectType: 'Organization',
      context: { temporal: createTimeInterval(createTimestamp()) },
      provenanceId: createProvenanceId('test-prov'),
    });

    expect(claimResult.ok).toBe(true);
  });

  it('should get entity with related claims', async () => {
    const person = await ckg.createEntity({ type: 'Person', name: 'Bob', properties: {} });
    if (!person.ok) throw new Error('Failed to create person');

    // Create some claims
    await ckg.createClaim({
      subjectId: person.value.data.id,
      subjectType: 'Person',
      predicate: 'hasSkill',
      objectValue: 'TypeScript',
      context: { temporal: createTimeInterval(createTimestamp()) },
      provenanceId: createProvenanceId('p1'),
    });

    await ckg.createClaim({
      subjectId: person.value.data.id,
      subjectType: 'Person',
      predicate: 'hasSkill',
      objectValue: 'Rust',
      context: { temporal: createTimeInterval(createTimestamp()) },
      provenanceId: createProvenanceId('p2'),
    });

    const result = await ckg.getEntityWithClaims(person.value.data.id);
    expect(result.ok).toBe(true);
    if (result.ok && result.value !== null) {
      expect(result.value.entity.data.name).toBe('Bob');
      expect(result.value.outgoingClaims.length).toBe(2);
    }
  });

  it('should filter claims by time', async () => {
    const person = await ckg.createEntity({ type: 'Person', name: 'Charlie', properties: {} });
    if (!person.ok) throw new Error('Failed to create person');

    const now = createTimestamp();
    const past = (now - 100000) as Timestamp;
    const future = (now + 100000) as Timestamp;

    // Past claim (expired)
    await ckg.createClaim({
      subjectId: person.value.data.id,
      subjectType: 'Person',
      predicate: 'hadRole',
      objectValue: 'Intern',
      context: { temporal: createTimeInterval(past, (past + 1000) as Timestamp) },
      provenanceId: createProvenanceId('p1'),
    });

    // Current claim
    await ckg.createClaim({
      subjectId: person.value.data.id,
      subjectType: 'Person',
      predicate: 'hasRole',
      objectValue: 'Engineer',
      context: { temporal: createTimeInterval((now - 1000) as Timestamp, future) },
      provenanceId: createProvenanceId('p2'),
    });

    const result = await ckg.getClaimsAsOf(now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.claims.length).toBe(1);
      expect(result.value.claims[0]?.data.objectValue).toBe('Engineer');
    }
  });
});
