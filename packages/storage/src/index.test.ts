import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEntityId, createTimestamp, type Timestamp } from '@contextgraph/core';
import { SQLiteStorage, InMemoryStorage, type StorageRecord } from './index.js';

interface TestEntity extends StorageRecord {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly createdAt: Timestamp;
}

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should initialize successfully', async () => {
    const result = await storage.healthCheck();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('should insert and retrieve records', async () => {
    const entity: TestEntity = {
      id: createEntityId('test-1'),
      type: 'Person',
      name: 'John Doe',
      createdAt: createTimestamp(),
    };

    const insertResult = await storage.insert('entities', entity);
    expect(insertResult.ok).toBe(true);

    const findResult = await storage.findById<TestEntity>('entities', entity.id);
    expect(findResult.ok).toBe(true);
    if (findResult.ok) {
      expect(findResult.value?.id).toBe(entity.id);
      expect(findResult.value?.name).toBe('John Doe');
    }
  });

  it('should reject duplicate inserts', async () => {
    const entity: TestEntity = {
      id: createEntityId('test-2'),
      type: 'Person',
      name: 'Jane Doe',
      createdAt: createTimestamp(),
    };

    await storage.insert('entities', entity);
    const duplicateResult = await storage.insert('entities', entity);

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.error.code).toBe('DUPLICATE_KEY');
    }
  });

  it('should find records by criteria', async () => {
    const entities: TestEntity[] = [
      { id: createEntityId('test-3'), type: 'Person', name: 'Alice', createdAt: createTimestamp() },
      { id: createEntityId('test-4'), type: 'Agent', name: 'Bot', createdAt: createTimestamp() },
      { id: createEntityId('test-5'), type: 'Person', name: 'Bob', createdAt: createTimestamp() },
    ];

    for (const entity of entities) {
      await storage.insert('entities', entity);
    }

    const result = await storage.find<TestEntity>('entities', { type: 'Person' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items.length).toBe(2);
      expect(result.value.total).toBe(2);
    }
  });

  it('should count records', async () => {
    const entities: TestEntity[] = [
      { id: createEntityId('test-6'), type: 'Person', name: 'One', createdAt: createTimestamp() },
      { id: createEntityId('test-7'), type: 'Person', name: 'Two', createdAt: createTimestamp() },
    ];

    for (const entity of entities) {
      await storage.insert('entities', entity);
    }

    const result = await storage.count('entities');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2);
    }
  });

  it('should return stats', async () => {
    const entity: TestEntity = {
      id: createEntityId('test-8'),
      type: 'Person',
      name: 'Stats Test',
      createdAt: createTimestamp(),
    };

    await storage.insert('entities', entity);

    const result = await storage.stats();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.collections['entities']).toBe(1);
    }
  });
});

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage;

  beforeEach(async () => {
    storage = new SQLiteStorage({ path: ':memory:' });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should initialize successfully', async () => {
    const result = await storage.healthCheck();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('should insert and retrieve records', async () => {
    const entity: TestEntity = {
      id: createEntityId('sqlite-1'),
      type: 'Person',
      name: 'SQLite User',
      createdAt: createTimestamp(),
    };

    const insertResult = await storage.insert('entities', entity);
    expect(insertResult.ok).toBe(true);

    const findResult = await storage.findById<TestEntity>('entities', entity.id);
    expect(findResult.ok).toBe(true);
    if (findResult.ok) {
      expect(findResult.value?.id).toBe(entity.id);
      expect(findResult.value?.name).toBe('SQLite User');
    }
  });

  it('should handle JSON fields', async () => {
    interface EntityWithMeta extends StorageRecord {
      id: string;
      type: string;
      name: string | null;
      aliases: string | null;
      metadata: { key: string; value: number } | null;
      createdAt: Timestamp;
    }

    const entity: EntityWithMeta = {
      id: createEntityId('sqlite-2'),
      type: 'Agent',
      name: 'JSON Test',
      aliases: null,
      metadata: { key: 'test', value: 42 },
      createdAt: createTimestamp(),
    };

    await storage.insert('entities', entity);

    const result = await storage.findById<EntityWithMeta>('entities', entity.id);
    expect(result.ok).toBe(true);
    if (result.ok && result.value !== null) {
      expect(result.value.metadata).toEqual({ key: 'test', value: 42 });
    }
  });

  it('should run migrations automatically', async () => {
    const stats = await storage.stats();
    expect(stats.ok).toBe(true);
    if (stats.ok) {
      // Should have tables from migrations
      expect('entities' in stats.value.collections).toBe(true);
      expect('claims' in stats.value.collections).toBe(true);
      expect('provenance' in stats.value.collections).toBe(true);
      expect('decisions' in stats.value.collections).toBe(true);
    }
  });
});
