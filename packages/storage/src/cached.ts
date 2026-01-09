/**
 * Cached Storage Interface
 *
 * Wraps a storage implementation with LRU caching for improved query performance.
 */

import { ok, type Result } from '@contextgraph/core';
import {
  StorageInterface,
  StorageError,
  type QueryOptions,
  type PaginatedResult,
  type StorageRecord,
} from './interface.js';
import { LRUCache, createCacheKey, type CacheConfig, type CacheStats } from './cache.js';

/**
 * Cached storage configuration
 */
export interface CachedStorageConfig {
  /** Query result cache config */
  queryCache?: CacheConfig;
  /** Entity lookup cache config */
  entityCache?: CacheConfig;
  /** Count cache config */
  countCache?: CacheConfig;
  /** Collections to cache (empty = all) */
  cachedCollections?: readonly string[];
  /** Collections to never cache */
  excludedCollections?: readonly string[];
}

const DEFAULT_QUERY_CACHE: CacheConfig = {
  maxSize: 1000,
  ttl: 30000, // 30 seconds
  trackStats: true,
};

const DEFAULT_ENTITY_CACHE: CacheConfig = {
  maxSize: 10000,
  ttl: 60000, // 60 seconds
  trackStats: true,
};

const DEFAULT_COUNT_CACHE: CacheConfig = {
  maxSize: 500,
  ttl: 15000, // 15 seconds
  trackStats: true,
};

/**
 * Cached storage wrapper
 */
export class CachedStorage extends StorageInterface {
  private readonly _storage: StorageInterface;
  private readonly _queryCache: LRUCache<string, PaginatedResult<unknown>>;
  private readonly _entityCache: LRUCache<string, unknown>;
  private readonly _countCache: LRUCache<string, number>;
  private readonly _cachedCollections: Set<string> | null;
  private readonly _excludedCollections: Set<string>;

  constructor(storage: StorageInterface, config: CachedStorageConfig = {}) {
    super();
    this._storage = storage;
    this._queryCache = new LRUCache(config.queryCache ?? DEFAULT_QUERY_CACHE);
    this._entityCache = new LRUCache(config.entityCache ?? DEFAULT_ENTITY_CACHE);
    this._countCache = new LRUCache(config.countCache ?? DEFAULT_COUNT_CACHE);
    this._cachedCollections = config.cachedCollections !== undefined
      ? new Set(config.cachedCollections)
      : null;
    this._excludedCollections = new Set(config.excludedCollections ?? []);
  }

  /**
   * Check if collection should be cached
   */
  private shouldCache(collection: string): boolean {
    if (this._excludedCollections.has(collection)) return false;
    if (this._cachedCollections === null) return true;
    return this._cachedCollections.has(collection);
  }

  /**
   * Get entity cache key
   */
  private getEntityKey(collection: string, id: string): string {
    return `${collection}:${id}`;
  }

  /**
   * Invalidate caches for a collection
   */
  private invalidateCollection(collection: string): void {
    // Invalidate query cache entries for this collection
    this._queryCache.invalidate((key) => key.startsWith(`${collection}|`));

    // Invalidate count cache entries for this collection
    this._countCache.invalidate((key) => key.startsWith(`${collection}|`));
  }

  /**
   * Initialize storage
   */
  async initialize(): Promise<Result<void, StorageError>> {
    return this._storage.initialize();
  }

  /**
   * Close storage
   */
  async close(): Promise<Result<void, StorageError>> {
    this.clearCache();
    return this._storage.close();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Result<boolean, StorageError>> {
    return this._storage.healthCheck();
  }

  /**
   * Insert record (invalidates cache)
   */
  async insert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>> {
    const result = await this._storage.insert(collection, record);

    if (result.ok) {
      this.invalidateCollection(collection);

      // Cache the inserted entity
      if (this.shouldCache(collection)) {
        this._entityCache.set(this.getEntityKey(collection, record.id), record);
      }
    }

    return result;
  }

  /**
   * Insert many records (invalidates cache)
   */
  async insertMany<T extends StorageRecord>(
    collection: string,
    records: readonly T[]
  ): Promise<Result<readonly T[], StorageError>> {
    const result = await this._storage.insertMany(collection, records);

    if (result.ok) {
      this.invalidateCollection(collection);

      // Cache inserted entities
      if (this.shouldCache(collection)) {
        for (const record of result.value) {
          this._entityCache.set(this.getEntityKey(collection, record.id), record);
        }
      }
    }

    return result;
  }

  /**
   * Find by ID (cached)
   */
  async findById<T extends StorageRecord>(
    collection: string,
    id: string
  ): Promise<Result<T | null, StorageError>> {
    if (this.shouldCache(collection)) {
      const cacheKey = this.getEntityKey(collection, id);
      const cached = this._entityCache.get(cacheKey);

      if (cached !== undefined) {
        return ok(cached as T);
      }
    }

    const result = await this._storage.findById<T>(collection, id);

    if (result.ok && result.value !== null && this.shouldCache(collection)) {
      this._entityCache.set(this.getEntityKey(collection, id), result.value);
    }

    return result;
  }

  /**
   * Find records (cached)
   */
  async find<T extends StorageRecord>(
    collection: string,
    criteria: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<Result<PaginatedResult<T>, StorageError>> {
    if (this.shouldCache(collection)) {
      const cacheKey = createCacheKey(collection, criteria, options);
      const cached = this._queryCache.get(cacheKey);

      if (cached !== undefined) {
        return ok(cached as PaginatedResult<T>);
      }
    }

    const result = await this._storage.find<T>(collection, criteria, options);

    if (result.ok && this.shouldCache(collection)) {
      const cacheKey = createCacheKey(collection, criteria, options);
      this._queryCache.set(cacheKey, result.value);

      // Also cache individual entities
      for (const item of result.value.items) {
        this._entityCache.set(this.getEntityKey(collection, item.id), item);
      }
    }

    return result;
  }

  /**
   * Count records (cached)
   */
  async count(
    collection: string,
    criteria?: Record<string, unknown>
  ): Promise<Result<number, StorageError>> {
    if (this.shouldCache(collection)) {
      const cacheKey = createCacheKey(collection, criteria ?? {});
      const cached = this._countCache.get(cacheKey);

      if (cached !== undefined) {
        return ok(cached);
      }
    }

    const result = await this._storage.count(collection, criteria);

    if (result.ok && this.shouldCache(collection)) {
      const cacheKey = createCacheKey(collection, criteria ?? {});
      this._countCache.set(cacheKey, result.value);
    }

    return result;
  }

  /**
   * Upsert record (invalidates cache)
   */
  async upsert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>> {
    const result = await this._storage.upsert(collection, record);

    if (result.ok) {
      this.invalidateCollection(collection);

      // Update entity cache
      if (this.shouldCache(collection)) {
        this._entityCache.set(this.getEntityKey(collection, record.id), record);
      }
    }

    return result;
  }

  /**
   * Execute raw query (not cached)
   */
  async query<T>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Result<readonly T[], StorageError>> {
    return this._storage.query<T>(sql, params);
  }

  /**
   * Transaction (invalidates all caches on success)
   */
  async transaction<T>(
    fn: () => Promise<Result<T, StorageError>>
  ): Promise<Result<T, StorageError>> {
    const result = await this._storage.transaction(fn);

    if (result.ok) {
      // Conservatively invalidate all caches after transaction
      this.clearCache();
    }

    return result;
  }

  /**
   * Get storage stats
   */
  async stats(): Promise<
    Result<{ collections: Record<string, number>; totalSize: number }, StorageError>
  > {
    return this._storage.stats();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this._queryCache.clear();
    this._entityCache.clear();
    this._countCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    query: CacheStats;
    entity: CacheStats;
    count: CacheStats;
  } {
    return {
      query: this._queryCache.getStats(),
      entity: this._entityCache.getStats(),
      count: this._countCache.getStats(),
    };
  }

  /**
   * Prune expired entries from all caches
   */
  pruneExpired(): { query: number; entity: number; count: number } {
    return {
      query: this._queryCache.prune(),
      entity: this._entityCache.prune(),
      count: this._countCache.prune(),
    };
  }

  /**
   * Invalidate cache for specific collection
   */
  invalidate(collection: string): void {
    this.invalidateCollection(collection);

    // Also invalidate entity cache for this collection
    this._entityCache.invalidate((key) => key.startsWith(`${collection}:`));
  }

  /**
   * Get underlying storage
   */
  get underlying(): StorageInterface {
    return this._storage;
  }
}

/**
 * Create cached storage wrapper
 */
export function createCachedStorage(
  storage: StorageInterface,
  config?: CachedStorageConfig
): CachedStorage {
  return new CachedStorage(storage, config);
}
