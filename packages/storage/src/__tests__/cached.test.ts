/**
 * CachedStorage Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryStorage } from '../memory.js';
import { CachedStorage, createCachedStorage } from '../cached.js';

describe('CachedStorage', () => {
  let storage: InMemoryStorage;
  let cachedStorage: CachedStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    cachedStorage = createCachedStorage(storage, {
      queryCache: { maxSize: 100, ttl: 1000, trackStats: true },
      entityCache: { maxSize: 100, ttl: 1000, trackStats: true },
      countCache: { maxSize: 100, ttl: 1000, trackStats: true },
    });
  });

  describe('basic operations', () => {
    it('should initialize and close', async () => {
      const newStorage = new InMemoryStorage();
      const cached = createCachedStorage(newStorage);

      const initResult = await cached.initialize();
      expect(initResult.ok).toBe(true);

      const closeResult = await cached.close();
      expect(closeResult.ok).toBe(true);
    });

    it('should pass through health check', async () => {
      const result = await cachedStorage.healthCheck();
      expect(result.ok).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should pass through stats', async () => {
      const result = await cachedStorage.stats();
      expect(result.ok).toBe(true);
    });
  });

  describe('insert operations', () => {
    it('should insert and cache record', async () => {
      const record = { id: 'e1', type: 'test', createdAt: Date.now() };
      const result = await cachedStorage.insert('entities', record);

      expect(result.ok).toBe(true);

      // Should be cached
      const findResult = await cachedStorage.findById('entities', 'e1');
      expect(findResult.ok).toBe(true);
      expect(findResult.value).toEqual(record);

      // Check cache stats
      const stats = cachedStorage.getCacheStats();
      expect(stats.entity.hits).toBe(1);
    });

    it('should invalidate query cache on insert', async () => {
      // First query to populate cache
      await cachedStorage.find('entities', { type: 'test' });

      // Insert new record
      await cachedStorage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      // Query cache should be invalidated
      const stats = cachedStorage.getCacheStats();
      expect(stats.query.size).toBe(0);
    });

    it('should insert many records', async () => {
      const records = [
        { id: 'e1', type: 'test', createdAt: Date.now() },
        { id: 'e2', type: 'test', createdAt: Date.now() },
      ];

      const result = await cachedStorage.insertMany('entities', records);
      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(2);

      // Both should be cached
      const find1 = await cachedStorage.findById('entities', 'e1');
      const find2 = await cachedStorage.findById('entities', 'e2');

      expect(find1.value).toEqual(records[0]);
      expect(find2.value).toEqual(records[1]);
    });
  });

  describe('findById caching', () => {
    it('should cache findById results', async () => {
      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      // First call - cache miss
      await cachedStorage.findById('entities', 'e1');

      // Second call - cache hit
      await cachedStorage.findById('entities', 'e1');

      const stats = cachedStorage.getCacheStats();
      expect(stats.entity.hits).toBe(1);
      expect(stats.entity.misses).toBe(1);
    });

    it('should not cache null results', async () => {
      await cachedStorage.findById('entities', 'nonexistent');
      await cachedStorage.findById('entities', 'nonexistent');

      const stats = cachedStorage.getCacheStats();
      expect(stats.entity.hits).toBe(0);
      expect(stats.entity.misses).toBe(2);
    });
  });

  describe('find caching', () => {
    beforeEach(async () => {
      await storage.insert('entities', { id: 'e1', type: 'person', createdAt: Date.now() });
      await storage.insert('entities', { id: 'e2', type: 'person', createdAt: Date.now() });
      await storage.insert('entities', { id: 'e3', type: 'project', createdAt: Date.now() });
    });

    it('should cache find results', async () => {
      // First call - cache miss
      await cachedStorage.find('entities', { type: 'person' });

      // Second call - cache hit
      await cachedStorage.find('entities', { type: 'person' });

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.hits).toBe(1);
      expect(stats.query.misses).toBe(1);
    });

    it('should use different cache keys for different criteria', async () => {
      await cachedStorage.find('entities', { type: 'person' });
      await cachedStorage.find('entities', { type: 'project' });
      await cachedStorage.find('entities', { type: 'person' });

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.hits).toBe(1);
      expect(stats.query.misses).toBe(2);
    });

    it('should use different cache keys for different options', async () => {
      await cachedStorage.find('entities', {}, { limit: 10 });
      await cachedStorage.find('entities', {}, { limit: 20 });
      await cachedStorage.find('entities', {}, { limit: 10 });

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.hits).toBe(1);
      expect(stats.query.misses).toBe(2);
    });

    it('should cache individual entities from find results', async () => {
      // Find caches individual entities
      await cachedStorage.find('entities', { type: 'person' });

      // findById should hit entity cache
      await cachedStorage.findById('entities', 'e1');

      const stats = cachedStorage.getCacheStats();
      expect(stats.entity.hits).toBe(1);
    });
  });

  describe('count caching', () => {
    beforeEach(async () => {
      await storage.insert('entities', { id: 'e1', type: 'person', createdAt: Date.now() });
      await storage.insert('entities', { id: 'e2', type: 'person', createdAt: Date.now() });
    });

    it('should cache count results', async () => {
      await cachedStorage.count('entities', { type: 'person' });
      await cachedStorage.count('entities', { type: 'person' });

      const stats = cachedStorage.getCacheStats();
      expect(stats.count.hits).toBe(1);
      expect(stats.count.misses).toBe(1);
    });

    it('should invalidate count cache on insert', async () => {
      await cachedStorage.count('entities', { type: 'person' });
      await cachedStorage.insert('entities', { id: 'e3', type: 'person', createdAt: Date.now() });
      await cachedStorage.count('entities', { type: 'person' });

      const stats = cachedStorage.getCacheStats();
      expect(stats.count.hits).toBe(0);
      expect(stats.count.misses).toBe(2);
    });
  });

  describe('upsert', () => {
    it('should invalidate caches on upsert', async () => {
      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      // Populate caches
      await cachedStorage.find('entities', { type: 'test' });
      await cachedStorage.findById('entities', 'e1');

      // Upsert
      await cachedStorage.upsert('entities', { id: 'e1', type: 'updated', createdAt: Date.now() });

      // Query cache should be invalidated
      const stats = cachedStorage.getCacheStats();
      expect(stats.query.size).toBe(0);
    });
  });

  describe('transaction', () => {
    it('should invalidate all caches after transaction', async () => {
      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      // Populate caches
      await cachedStorage.find('entities', { type: 'test' });
      await cachedStorage.findById('entities', 'e1');
      await cachedStorage.count('entities', {});

      // Run transaction
      await cachedStorage.transaction(async () => {
        await storage.insert('entities', { id: 'e2', type: 'test', createdAt: Date.now() });
        return { ok: true as const, value: undefined };
      });

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.size).toBe(0);
      expect(stats.entity.size).toBe(0);
      expect(stats.count.size).toBe(0);
    });
  });

  describe('raw query', () => {
    it('should not cache raw queries', async () => {
      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      await cachedStorage.query('SELECT * FROM entities');
      await cachedStorage.query('SELECT * FROM entities');

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.hits).toBe(0);
    });
  });

  describe('collection filtering', () => {
    it('should only cache specified collections', async () => {
      const filtered = createCachedStorage(storage, {
        cachedCollections: ['entities'],
        queryCache: { maxSize: 100, ttl: 1000, trackStats: true },
      });

      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });
      await storage.insert('claims', { id: 'c1', subjectId: 'e1', createdAt: Date.now() });

      // Entities should be cached
      await filtered.findById('entities', 'e1');
      await filtered.findById('entities', 'e1');

      // Claims should not be cached
      await filtered.findById('claims', 'c1');
      await filtered.findById('claims', 'c1');

      const stats = filtered.getCacheStats();
      expect(stats.entity.hits).toBe(1);
      // No hits for claims since they're not cached
    });

    it('should exclude specified collections', async () => {
      const filtered = createCachedStorage(storage, {
        excludedCollections: ['claims'],
        entityCache: { maxSize: 100, ttl: 1000, trackStats: true },
      });

      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });
      await storage.insert('claims', { id: 'c1', subjectId: 'e1', createdAt: Date.now() });

      await filtered.findById('entities', 'e1');
      await filtered.findById('entities', 'e1');
      await filtered.findById('claims', 'c1');
      await filtered.findById('claims', 'c1');

      const stats = filtered.getCacheStats();
      expect(stats.entity.hits).toBe(1); // Only entities cached
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      await cachedStorage.find('entities', {});
      await cachedStorage.findById('entities', 'e1');
      await cachedStorage.count('entities', {});

      cachedStorage.clearCache();

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.size).toBe(0);
      expect(stats.entity.size).toBe(0);
      expect(stats.count.size).toBe(0);
    });

    it('should invalidate specific collection', async () => {
      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });
      await storage.insert('claims', { id: 'c1', subjectId: 'e1', createdAt: Date.now() });

      await cachedStorage.find('entities', {});
      await cachedStorage.find('claims', {});

      cachedStorage.invalidate('entities');

      // Query again to check invalidation
      await cachedStorage.find('entities', {});
      await cachedStorage.find('claims', {});

      const stats = cachedStorage.getCacheStats();
      expect(stats.query.hits).toBe(1); // Only claims hit
    });

    it('should prune expired entries', async () => {
      vi.useFakeTimers();

      await storage.insert('entities', { id: 'e1', type: 'test', createdAt: Date.now() });

      await cachedStorage.findById('entities', 'e1');

      vi.advanceTimersByTime(2000); // Past TTL

      const pruned = cachedStorage.pruneExpired();
      expect(pruned.entity).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('should provide underlying storage access', () => {
      expect(cachedStorage.underlying).toBe(storage);
    });
  });
});
