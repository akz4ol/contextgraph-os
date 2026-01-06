/**
 * Retrieval Package Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import { CKG, type Claim } from '@contextgraph/ckg';
import { ProvenanceLedger } from '@contextgraph/provenance';
import {
  createTimestamp,
  createTimeInterval,
  type Timestamp,
  type EntityId,
  type ProvenanceId,
  type Confidence,
} from '@contextgraph/core';
import {
  ContextFilterEngine,
  ContextAssembler,
  type ContextFilter,
} from './index.js';

// Helper to create mock claims with CKG structure
function createMockClaim(overrides: {
  id?: string;
  subjectId?: string;
  predicate?: string;
  temporal?: { start: Timestamp; end: Timestamp | null };
  confidence?: Confidence;
  scope?: string;
  jurisdiction?: string;
} = {}): Claim {
  const now = createTimestamp();
  const id = overrides.id ?? `claim_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return {
    data: {
      id,
      subjectId: overrides.subjectId ?? 'entity_1',
      predicate: overrides.predicate ?? 'has_property',
      objectId: undefined,
      objectValue: 'test_value',
      context: {
        temporal: overrides.temporal ?? createTimeInterval(now),
        ...(overrides.confidence !== undefined ? { confidence: overrides.confidence } : {}),
        ...(overrides.scope !== undefined ? { scope: overrides.scope } : {}),
        ...(overrides.jurisdiction !== undefined ? { jurisdiction: overrides.jurisdiction } : {}),
      },
      provenanceId: 'prov_test',
      createdAt: now,
    },
    toRecord: () => ({} as never),
    isValidAt: () => true,
  } as unknown as Claim;
}

describe('ContextFilterEngine', () => {
  let filterEngine: ContextFilterEngine;

  beforeEach(() => {
    filterEngine = new ContextFilterEngine();
  });

  describe('Temporal filtering', () => {
    it('filters claims by point-in-time (asOf)', () => {
      const now = createTimestamp();
      const past = (now - 10000) as Timestamp;
      const future = (now + 10000) as Timestamp;

      const claims = [
        createMockClaim({ temporal: { start: past, end: future } }), // Valid at now
        createMockClaim({ temporal: { start: future, end: null } }), // Not yet valid
        createMockClaim({ temporal: { start: past, end: past } }), // Already expired
        createMockClaim({ temporal: { start: past, end: null } }), // No end, always valid after start
      ];

      const filtered = filterEngine.applyTemporalFilter(claims, { asOf: now });
      expect(filtered).toHaveLength(2); // First and last
    });

    it('filters claims by range (from/to)', () => {
      const now = createTimestamp();
      const past = (now - 10000) as Timestamp;
      const future = (now + 10000) as Timestamp;

      const claims = [
        createMockClaim({ temporal: { start: past, end: now } }),
        createMockClaim({ temporal: { start: now, end: future } }),
        createMockClaim({ temporal: { start: past, end: (past - 1000) as Timestamp } }), // Expired before range
      ];

      const filtered = filterEngine.applyTemporalFilter(claims, { from: now, to: future });
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Scope filtering', () => {
    it('filters claims by scope', () => {
      const claims = [
        createMockClaim({ scope: 'internal' }),
        createMockClaim({ scope: 'external' }),
        createMockClaim({}), // No scope
      ];

      const filtered = filterEngine.applyScopeFilter(claims, { scope: 'internal' as never });
      expect(filtered).toHaveLength(2); // internal + no scope
    });

    it('filters claims by jurisdiction', () => {
      const claims = [
        createMockClaim({ jurisdiction: 'us' }),
        createMockClaim({ jurisdiction: 'eu' }),
        createMockClaim({}), // No jurisdiction
      ];

      const filtered = filterEngine.applyScopeFilter(claims, { jurisdiction: 'us' as never });
      expect(filtered).toHaveLength(2); // us + no jurisdiction
    });
  });

  describe('Confidence filtering', () => {
    it('filters claims by minimum confidence', () => {
      const claims = [
        createMockClaim({ confidence: 0.9 as Confidence }),
        createMockClaim({ confidence: 0.5 as Confidence }),
        createMockClaim({ confidence: 0.3 as Confidence }),
      ];

      const filtered = filterEngine.applyConfidenceFilter(claims, { minConfidence: 0.5 as Confidence });
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Combined filtering', () => {
    it('applies all filters to claims', () => {
      const now = createTimestamp();
      const past = (now - 10000) as Timestamp;
      const future = (now + 10000) as Timestamp;

      const claims = [
        createMockClaim({
          predicate: 'fact',
          confidence: 0.9 as Confidence,
          temporal: { start: past, end: future },
        }),
        createMockClaim({
          predicate: 'opinion',
          confidence: 0.5 as Confidence,
        }),
        createMockClaim({
          predicate: 'fact',
          confidence: 0.9 as Confidence,
        }),
      ];

      const filter: ContextFilter = {
        asOf: now,
        predicates: ['fact'],
        minConfidence: 0.8 as Confidence,
      };

      const filtered = filterEngine.filterClaims(claims, filter);
      expect(filtered).toHaveLength(2);
    });

    it('applies limit to results', () => {
      const claims = [
        createMockClaim({ confidence: 0.9 as Confidence }),
        createMockClaim({ confidence: 0.8 as Confidence }),
        createMockClaim({ confidence: 0.7 as Confidence }),
      ];

      const filtered = filterEngine.filterClaims(claims, { limit: 2 });
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Filter merging', () => {
    it('merges multiple filters with most restrictive values', () => {
      const filter1: ContextFilter = {
        minConfidence: 0.5 as Confidence,
        limit: 100,
      };

      const filter2: ContextFilter = {
        minConfidence: 0.7 as Confidence,
        limit: 50,
      };

      const merged = filterEngine.mergeFilters(filter1, filter2);
      expect(merged.minConfidence).toBe(0.7);
      expect(merged.limit).toBe(50);
    });

    it('merges entity types by intersection', () => {
      const filter1: ContextFilter = {
        entityTypes: ['person', 'org', 'place'],
      };

      const filter2: ContextFilter = {
        entityTypes: ['person', 'org'],
      };

      const merged = filterEngine.mergeFilters(filter1, filter2);
      expect(merged.entityTypes).toEqual(['person', 'org']);
    });
  });

  describe('Utility methods', () => {
    it('checks if claim is valid at timestamp', () => {
      const now = createTimestamp();
      const past = (now - 10000) as Timestamp;
      const future = (now + 10000) as Timestamp;

      const validClaim = createMockClaim({ temporal: { start: past, end: future } });
      const expiredClaim = createMockClaim({ temporal: { start: past, end: past } });
      const futureClaim = createMockClaim({ temporal: { start: future, end: null } });

      expect(filterEngine.isClaimValidAt(validClaim, now)).toBe(true);
      expect(filterEngine.isClaimValidAt(expiredClaim, now)).toBe(false);
      expect(filterEngine.isClaimValidAt(futureClaim, now)).toBe(false);
    });
  });
});

describe('ContextAssembler', () => {
  let storage: InMemoryStorage;
  let ckg: CKG;
  let provenance: ProvenanceLedger;
  let assembler: ContextAssembler;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    ckg = new CKG({ storage, requireProvenance: false });
    provenance = new ProvenanceLedger(storage);
    assembler = new ContextAssembler(ckg, provenance);
  });

  it('assembles context with entities and claims', async () => {
    // Create provenance first
    const provResult = await provenance.record({
      sourceType: 'system',
      action: 'create',
    });
    expect(provResult.ok).toBe(true);
    if (!provResult.ok) return;

    // Create entity
    const entityResult = await ckg.createEntity({
      type: 'person',
      name: 'Alice',
    });
    expect(entityResult.ok).toBe(true);
    if (!entityResult.ok) return;

    // Create claim
    const now = createTimestamp();
    const claimResult = await ckg.createClaim({
      subjectId: entityResult.value.data.id,
      subjectType: 'person',
      predicate: 'has_role',
      objectValue: 'developer',
      context: {
        temporal: createTimeInterval(now),
      },
      provenanceId: provResult.value.data.id,
    });
    expect(claimResult.ok).toBe(true);

    // Assemble context
    const contextResult = await assembler.assemble({
      entityIds: [entityResult.value.data.id],
    });

    expect(contextResult.ok).toBe(true);
    if (!contextResult.ok) return;

    expect(contextResult.value.entities).toHaveLength(1);
    expect(contextResult.value.claims).toHaveLength(1);
    expect(contextResult.value.stats.totalEntities).toBe(1);
    expect(contextResult.value.stats.totalClaims).toBe(1);
  });

  it('applies filter to assembled context', async () => {
    // Create provenance first
    const provResult = await provenance.record({
      sourceType: 'system',
      action: 'create',
    });
    expect(provResult.ok).toBe(true);
    if (!provResult.ok) return;

    const entityResult = await ckg.createEntity({
      type: 'document',
      name: 'Policy Doc',
    });
    expect(entityResult.ok).toBe(true);
    if (!entityResult.ok) return;

    const now = createTimestamp();

    // Create claims with different confidence
    await ckg.createClaim({
      subjectId: entityResult.value.data.id,
      subjectType: 'document',
      predicate: 'contains',
      objectValue: 'section_1',
      context: {
        temporal: createTimeInterval(now),
        confidence: 0.95 as Confidence,
      },
      provenanceId: provResult.value.data.id,
    });

    await ckg.createClaim({
      subjectId: entityResult.value.data.id,
      subjectType: 'document',
      predicate: 'contains',
      objectValue: 'section_2',
      context: {
        temporal: createTimeInterval(now),
        confidence: 0.5 as Confidence,
      },
      provenanceId: provResult.value.data.id,
    });

    // Assemble with confidence filter
    const contextResult = await assembler.assemble({
      entityIds: [entityResult.value.data.id],
      filter: {
        minConfidence: 0.8 as Confidence,
      },
    });

    expect(contextResult.ok).toBe(true);
    if (!contextResult.ok) return;

    expect(contextResult.value.claims).toHaveLength(1);
    expect(contextResult.value.stats.filterApplied).toBe(true);
  });

  it('calculates relevance scores', async () => {
    // Create provenance first
    const provResult = await provenance.record({
      sourceType: 'system',
      action: 'create',
    });
    expect(provResult.ok).toBe(true);
    if (!provResult.ok) return;

    const entityResult = await ckg.createEntity({
      type: 'person',
      name: 'Bob',
    });
    expect(entityResult.ok).toBe(true);
    if (!entityResult.ok) return;

    const now = createTimestamp();
    await ckg.createClaim({
      subjectId: entityResult.value.data.id,
      subjectType: 'person',
      predicate: 'has_skill',
      objectValue: 'typescript',
      context: {
        temporal: createTimeInterval(now),
        confidence: 0.99 as Confidence,
      },
      provenanceId: provResult.value.data.id,
    });

    const contextResult = await assembler.assemble({
      entityIds: [entityResult.value.data.id],
    });

    expect(contextResult.ok).toBe(true);
    if (!contextResult.ok) return;

    // Check entity relevance
    expect(contextResult.value.entities[0]!.relevance.score).toBeGreaterThan(0);
    expect(contextResult.value.entities[0]!.relevance.factors['explicit_request']).toBe(1.0);

    // Check claim relevance
    expect(contextResult.value.claims[0]!.relevance.score).toBeGreaterThan(0);
    expect(contextResult.value.claims[0]!.relevance.factors['confidence']).toBeGreaterThan(0);
  });

  it('tracks retrieval statistics', async () => {
    const contextResult = await assembler.assemble({});

    expect(contextResult.ok).toBe(true);
    if (!contextResult.ok) return;

    expect(contextResult.value.stats).toBeDefined();
    expect(typeof contextResult.value.stats.retrievalTimeMs).toBe('number');
    expect(contextResult.value.stats.filterApplied).toBe(false);
  });

  it('limits claims when maxClaims is specified', async () => {
    // Create provenance first
    const provResult = await provenance.record({
      sourceType: 'system',
      action: 'create',
    });
    expect(provResult.ok).toBe(true);
    if (!provResult.ok) return;

    const entityResult = await ckg.createEntity({
      type: 'document',
      name: 'Large Doc',
    });
    expect(entityResult.ok).toBe(true);
    if (!entityResult.ok) return;

    const now = createTimestamp();

    // Create many claims
    for (let i = 0; i < 10; i++) {
      await ckg.createClaim({
        subjectId: entityResult.value.data.id,
        subjectType: 'document',
        predicate: 'contains',
        objectValue: `section_${i}`,
        context: {
          temporal: createTimeInterval(now),
        },
        provenanceId: provResult.value.data.id,
      });
    }

    const contextResult = await assembler.assemble(
      { entityIds: [entityResult.value.data.id] },
      { maxClaims: 5 }
    );

    expect(contextResult.ok).toBe(true);
    if (!contextResult.ok) return;

    expect(contextResult.value.claims.length).toBeLessThanOrEqual(5);
  });

  it('retrieves related entities', async () => {
    // Create provenance first
    const provResult = await provenance.record({
      sourceType: 'system',
      action: 'create',
    });
    expect(provResult.ok).toBe(true);
    if (!provResult.ok) return;

    // Create two related entities
    const entity1Result = await ckg.createEntity({
      type: 'person',
      name: 'Alice',
    });
    expect(entity1Result.ok).toBe(true);
    if (!entity1Result.ok) return;

    const entity2Result = await ckg.createEntity({
      type: 'org',
      name: 'ACME Corp',
    });
    expect(entity2Result.ok).toBe(true);
    if (!entity2Result.ok) return;

    const now = createTimestamp();

    // Create relationship claim
    await ckg.createClaim({
      subjectId: entity1Result.value.data.id,
      subjectType: 'person',
      predicate: 'works_at',
      objectId: entity2Result.value.data.id,
      objectType: 'org',
      context: {
        temporal: createTimeInterval(now),
      },
      provenanceId: provResult.value.data.id,
    });

    // Retrieve context with related entities
    const contextResult = await assembler.assemble(
      { relatedTo: entity1Result.value.data.id },
      { includeRelatedEntities: true }
    );

    expect(contextResult.ok).toBe(true);
    if (!contextResult.ok) return;

    // Should include the related entity
    expect(contextResult.value.entities.length).toBeGreaterThanOrEqual(1);
  });
});
