/**
 * Cache Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache, createCacheKey } from '../cache.js';

describe('LRUCache', () => {
  describe('basic operations', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = new LRUCache({ maxSize: 3, ttl: 0 });
    });

    it('should set and get values', () => {
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.delete('a')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should track size', () => {
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      expect(cache.size).toBe(1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when full', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3, ttl: 0 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Should evict 'a'

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update LRU order on get', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3, ttl: 0 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access 'a' to make it most recently used
      cache.get('a');

      cache.set('d', 4); // Should evict 'b' now

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update entry on re-set', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3, ttl: 0 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Re-set 'a' with new value
      cache.set('a', 100);

      cache.set('d', 4); // Should evict 'b'

      expect(cache.get('a')).toBe(100);
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);

      vi.advanceTimersByTime(150);

      expect(cache.get('a')).toBeUndefined();
      vi.useRealTimers();
    });

    it('should not expire if TTL is 0', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 0 });

      cache.set('a', 1);
      vi.advanceTimersByTime(100000);

      expect(cache.get('a')).toBe(1);
      vi.useRealTimers();
    });

    it('should prune expired entries', async () => {
      vi.useFakeTimers();
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

      cache.set('a', 1);
      cache.set('b', 2);

      vi.advanceTimersByTime(50);
      cache.set('c', 3);

      vi.advanceTimersByTime(60);

      const pruned = cache.prune();
      expect(pruned).toBe(2); // 'a' and 'b' expired
      expect(cache.get('c')).toBe(3);

      vi.useRealTimers();
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 0,
        trackStats: true,
      });

      cache.set('a', 1);

      cache.get('a'); // Hit
      cache.get('a'); // Hit
      cache.get('b'); // Miss
      cache.get('c'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track evictions', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 2,
        ttl: 0,
        trackStats: true,
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // Evicts 'a'
      cache.set('d', 4); // Evicts 'b'

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });

    it('should reset statistics', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 0,
        trackStats: true,
      });

      cache.set('a', 1);
      cache.get('a');
      cache.get('b');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('invalidation', () => {
    it('should invalidate entries matching predicate', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 0 });

      cache.set('user:1', 1);
      cache.set('user:2', 2);
      cache.set('post:1', 10);
      cache.set('post:2', 20);

      const invalidated = cache.invalidate((key) => key.startsWith('user:'));

      expect(invalidated).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBe(10);
      expect(cache.get('post:2')).toBe(20);
    });

    it('should invalidate by value', () => {
      const cache = new LRUCache<string, { type: string }>({ maxSize: 10, ttl: 0 });

      cache.set('a', { type: 'admin' });
      cache.set('b', { type: 'user' });
      cache.set('c', { type: 'admin' });

      const invalidated = cache.invalidate((_, value) => value.type === 'admin');

      expect(invalidated).toBe(2);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toEqual({ type: 'user' });
      expect(cache.get('c')).toBeUndefined();
    });
  });

  describe('keys iteration', () => {
    it('should iterate over keys', () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 0 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      const keys = Array.from(cache.keys());
      expect(keys).toEqual(['a', 'b', 'c']);
    });
  });
});

describe('createCacheKey', () => {
  it('should create key from collection and criteria', () => {
    const key = createCacheKey('entities', { type: 'person' });
    expect(key).toBe('entities|{"type":"person"}');
  });

  it('should sort criteria keys for consistency', () => {
    const key1 = createCacheKey('entities', { type: 'person', name: 'Alice' });
    const key2 = createCacheKey('entities', { name: 'Alice', type: 'person' });
    expect(key1).toBe(key2);
  });

  it('should include pagination options', () => {
    const key = createCacheKey('entities', { type: 'person' }, { limit: 10, offset: 20 });
    expect(key).toContain('l:10');
    expect(key).toContain('o:20');
  });

  it('should include order options', () => {
    const key = createCacheKey('entities', {}, { orderBy: 'createdAt', orderDirection: 'desc' });
    expect(key).toContain('ob:createdAt');
    expect(key).toContain('od:desc');
  });

  it('should include temporal options', () => {
    const key = createCacheKey('entities', {}, { temporal: { start: 1000, end: 2000 } });
    expect(key).toContain('ts:1000');
    expect(key).toContain('te:2000');
  });

  it('should handle empty criteria', () => {
    const key = createCacheKey('entities', {});
    expect(key).toBe('entities|{}');
  });
});
