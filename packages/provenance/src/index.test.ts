/**
 * Provenance Package Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import { createTimestamp, type Timestamp } from '@contextgraph/core';
import {
  ProvenanceEntry,
  ProvenanceLedger,
  computeProvenanceHash,
  verifyProvenanceHash,
  computeDataHash,
  type SourceType,
  type ActionType,
  type ArtifactRef,
} from './index.js';

describe('Hash Utilities', () => {
  it('computes deterministic hash', () => {
    const content = {
      sourceType: 'human' as SourceType,
      sourceId: 'user-123',
      sourceUri: undefined,
      actor: 'John Doe',
      action: 'create' as ActionType,
      inputRefs: [] as readonly ArtifactRef[],
      outputRefs: [] as readonly ArtifactRef[],
      timestamp: 1000 as Timestamp,
      metadata: {},
      previousHash: undefined,
    };

    const hash1 = computeProvenanceHash(content);
    const hash2 = computeProvenanceHash(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });

  it('produces different hashes for different content', () => {
    const content1 = {
      sourceType: 'human' as SourceType,
      sourceId: 'user-123',
      sourceUri: undefined,
      actor: 'John Doe',
      action: 'create' as ActionType,
      inputRefs: [] as readonly ArtifactRef[],
      outputRefs: [] as readonly ArtifactRef[],
      timestamp: 1000 as Timestamp,
      metadata: {},
      previousHash: undefined,
    };

    const content2 = {
      ...content1,
      actor: 'Jane Doe',
    };

    const hash1 = computeProvenanceHash(content1);
    const hash2 = computeProvenanceHash(content2);

    expect(hash1).not.toBe(hash2);
  });

  it('verifies hash correctly', () => {
    const content = {
      sourceType: 'agent' as SourceType,
      sourceId: 'agent-1',
      sourceUri: undefined,
      actor: undefined,
      action: 'derive' as ActionType,
      inputRefs: [{ type: 'claim' as const, id: 'claim-1' }],
      outputRefs: [{ type: 'claim' as const, id: 'claim-2' }],
      timestamp: 2000 as Timestamp,
      metadata: { reason: 'test' },
      previousHash: 'abc123',
    };

    const hash = computeProvenanceHash(content);
    expect(verifyProvenanceHash(content, hash)).toBe(true);
    expect(verifyProvenanceHash(content, 'wrong-hash')).toBe(false);
  });

  it('computes data hash', () => {
    const data = { foo: 'bar', num: 42 };
    const hash = computeDataHash(data);
    expect(hash).toHaveLength(64);
  });
});

describe('ProvenanceEntry', () => {
  it('creates entry with required fields', () => {
    const result = ProvenanceEntry.create({
      sourceType: 'human',
      action: 'create',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.sourceType).toBe('human');
      expect(result.value.data.action).toBe('create');
      expect(result.value.data.hash).toHaveLength(64);
      expect(result.value.data.previousHash).toBeUndefined();
    }
  });

  it('creates entry with all fields', () => {
    const timestamp = createTimestamp();
    const result = ProvenanceEntry.create({
      sourceType: 'agent',
      sourceId: 'agent-123',
      sourceUri: 'https://api.example.com/data',
      actor: 'DataProcessor',
      action: 'transform',
      inputRefs: [{ type: 'claim', id: 'claim-1' }],
      outputRefs: [{ type: 'claim', id: 'claim-2' }],
      timestamp,
      metadata: { transformType: 'normalize' },
    }, 'previous-hash-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.value;
      expect(entry.data.sourceType).toBe('agent');
      expect(entry.data.sourceId).toBe('agent-123');
      expect(entry.data.sourceUri).toBe('https://api.example.com/data');
      expect(entry.data.actor).toBe('DataProcessor');
      expect(entry.data.action).toBe('transform');
      expect(entry.data.inputRefs).toHaveLength(1);
      expect(entry.data.outputRefs).toHaveLength(1);
      expect(entry.data.previousHash).toBe('previous-hash-123');
    }
  });

  it('rejects invalid source type', () => {
    const result = ProvenanceEntry.create({
      sourceType: 'invalid' as SourceType,
      action: 'create',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid source type');
    }
  });

  it('rejects invalid action type', () => {
    const result = ProvenanceEntry.create({
      sourceType: 'human',
      action: 'invalid' as ActionType,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid action type');
    }
  });

  it('verifies its own hash', () => {
    const result = ProvenanceEntry.create({
      sourceType: 'system',
      action: 'validate',
      metadata: { result: 'passed' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verifyHash()).toBe(true);
    }
  });

  it('serializes and deserializes correctly', () => {
    const result = ProvenanceEntry.create({
      sourceType: 'document',
      sourceUri: 'file:///doc.pdf',
      action: 'import',
      inputRefs: [{ type: 'entity', id: 'doc-1' }],
      metadata: { pages: 10 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const record = result.value.toRecord();
      const restored = ProvenanceEntry.fromRecord(record);

      expect(restored.data.sourceType).toBe(result.value.data.sourceType);
      expect(restored.data.sourceUri).toBe(result.value.data.sourceUri);
      expect(restored.data.action).toBe(result.value.data.action);
      expect(restored.data.inputRefs).toEqual(result.value.data.inputRefs);
      expect(restored.data.metadata).toEqual(result.value.data.metadata);
      expect(restored.verifyHash()).toBe(true);
    }
  });

  it('detects chain links', () => {
    const entry1Result = ProvenanceEntry.create({
      sourceType: 'human',
      action: 'create',
    });

    expect(entry1Result.ok).toBe(true);
    if (!entry1Result.ok) return;

    const entry2Result = ProvenanceEntry.create({
      sourceType: 'agent',
      action: 'derive',
    }, entry1Result.value.data.hash);

    expect(entry2Result.ok).toBe(true);
    if (!entry2Result.ok) return;

    expect(entry2Result.value.isLinkedTo(entry1Result.value)).toBe(true);

    const entry3Result = ProvenanceEntry.create({
      sourceType: 'system',
      action: 'validate',
    });

    expect(entry3Result.ok).toBe(true);
    if (!entry3Result.ok) return;

    expect(entry3Result.value.isLinkedTo(entry1Result.value)).toBe(false);
  });
});

describe('ProvenanceLedger', () => {
  let storage: InMemoryStorage;
  let ledger: ProvenanceLedger;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    ledger = new ProvenanceLedger(storage);
    await ledger.initialize();
  });

  it('records entries with hash chain', async () => {
    const result1 = await ledger.record({
      sourceType: 'human',
      actor: 'Alice',
      action: 'create',
    });

    expect(result1.ok).toBe(true);
    if (!result1.ok) return;

    expect(result1.value.data.previousHash).toBeUndefined();

    const result2 = await ledger.record({
      sourceType: 'agent',
      action: 'derive',
    });

    expect(result2.ok).toBe(true);
    if (!result2.ok) return;

    expect(result2.value.data.previousHash).toBe(result1.value.data.hash);
  });

  it('retrieves entry by ID', async () => {
    const recordResult = await ledger.record({
      sourceType: 'system',
      action: 'validate',
    });

    expect(recordResult.ok).toBe(true);
    if (!recordResult.ok) return;

    const getResult = await ledger.getById(recordResult.value.data.id);

    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;

    expect(getResult.value).not.toBeNull();
    expect(getResult.value!.data.id).toBe(recordResult.value.data.id);
  });

  it('queries by source type', async () => {
    await ledger.record({ sourceType: 'human', action: 'create' });
    await ledger.record({ sourceType: 'agent', action: 'derive' });
    await ledger.record({ sourceType: 'human', action: 'approve' });

    const result = await ledger.findBySourceType('human');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value.every((e) => e.data.sourceType === 'human')).toBe(true);
  });

  it('queries by actor', async () => {
    await ledger.record({ sourceType: 'human', actor: 'Alice', action: 'create' });
    await ledger.record({ sourceType: 'human', actor: 'Bob', action: 'approve' });
    await ledger.record({ sourceType: 'human', actor: 'Alice', action: 'update' });

    const result = await ledger.findByActor('Alice');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value.every((e) => e.data.actor === 'Alice')).toBe(true);
  });

  it('queries by action', async () => {
    await ledger.record({ sourceType: 'human', action: 'create' });
    await ledger.record({ sourceType: 'agent', action: 'derive' });
    await ledger.record({ sourceType: 'system', action: 'create' });

    const result = await ledger.findByAction('create');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value.every((e) => e.data.action === 'create')).toBe(true);
  });

  it('verifies chain integrity', async () => {
    await ledger.record({ sourceType: 'human', action: 'create' });
    await ledger.record({ sourceType: 'agent', action: 'derive' });
    await ledger.record({ sourceType: 'system', action: 'validate' });

    const result = await ledger.verifyChain();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.valid).toBe(true);
    expect(result.value.entriesVerified).toBe(3);
    expect(result.value.brokenLinks).toHaveLength(0);
    expect(result.value.invalidHashes).toHaveLength(0);
  });

  it('counts entries', async () => {
    await ledger.record({ sourceType: 'human', action: 'create' });
    await ledger.record({ sourceType: 'agent', action: 'derive' });

    const result = await ledger.count();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBe(2);
  });

  it('queries with time range', async () => {
    const now = Date.now();

    await ledger.record({
      sourceType: 'human',
      action: 'create',
      timestamp: (now - 3000) as Timestamp,
    });
    await ledger.record({
      sourceType: 'agent',
      action: 'derive',
      timestamp: (now - 1000) as Timestamp,
    });
    await ledger.record({
      sourceType: 'system',
      action: 'validate',
      timestamp: (now + 1000) as Timestamp,
    });

    const result = await ledger.query({
      timeRange: {
        start: (now - 2000) as Timestamp,
        end: now as Timestamp,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.data.action).toBe('derive');
  });
});
