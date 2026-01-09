/**
 * LRU Cache Implementation
 *
 * Simple, efficient Least Recently Used cache for query results.
 */

/**
 * Cache entry with value and metadata
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  accessedAt: number;
  size: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
  readonly maxSize: number;
  readonly hitRate: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum number of entries */
  maxSize: number;
  /** Time-to-live in milliseconds (0 = no expiry) */
  ttl: number;
  /** Enable statistics tracking */
  trackStats?: boolean;
}

/**
 * LRU Cache with TTL support
 */
export class LRUCache<K, V> {
  private readonly _cache: Map<K, CacheEntry<V>> = new Map();
  private readonly _maxSize: number;
  private readonly _ttl: number;
  private readonly _trackStats: boolean;

  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;

  constructor(config: CacheConfig) {
    this._maxSize = config.maxSize;
    this._ttl = config.ttl;
    this._trackStats = config.trackStats ?? false;
  }

  /**
   * Get a value from cache
   */
  get(key: K): V | undefined {
    const entry = this._cache.get(key);

    if (entry === undefined) {
      if (this._trackStats) this._misses++;
      return undefined;
    }

    // Check TTL
    if (this._ttl > 0 && Date.now() - entry.createdAt > this._ttl) {
      this._cache.delete(key);
      if (this._trackStats) this._misses++;
      return undefined;
    }

    // Update access time and move to end (most recently used)
    entry.accessedAt = Date.now();
    this._cache.delete(key);
    this._cache.set(key, entry);

    if (this._trackStats) this._hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: K, value: V, size: number = 1): void {
    // Delete existing entry if present
    if (this._cache.has(key)) {
      this._cache.delete(key);
    }

    // Evict if at capacity
    while (this._cache.size >= this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== undefined) {
        this._cache.delete(firstKey);
        if (this._trackStats) this._evictions++;
      }
    }

    const now = Date.now();
    this._cache.set(key, {
      value,
      createdAt: now,
      accessedAt: now,
      size,
    });
  }

  /**
   * Check if key exists (without updating access time)
   */
  has(key: K): boolean {
    const entry = this._cache.get(key);
    if (entry === undefined) return false;

    // Check TTL
    if (this._ttl > 0 && Date.now() - entry.createdAt > this._ttl) {
      this._cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key: K): boolean {
    return this._cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this._cache.clear();
  }

  /**
   * Invalidate entries matching a predicate
   */
  invalidate(predicate: (key: K, value: V) => boolean): number {
    let count = 0;
    for (const [key, entry] of this._cache) {
      if (predicate(key, entry.value)) {
        this._cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Get current size
   */
  get size(): number {
    return this._cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      size: this._cache.size,
      maxSize: this._maxSize,
      hitRate: total > 0 ? this._hits / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    if (this._ttl === 0) return 0;

    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this._cache) {
      if (now - entry.createdAt > this._ttl) {
        this._cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get all keys
   */
  keys(): IterableIterator<K> {
    return this._cache.keys();
  }
}

/**
 * Create a cache key from query parameters
 */
export function createCacheKey(
  collection: string,
  criteria: Record<string, unknown>,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: string;
    temporal?: { start?: number; end?: number };
  }
): string {
  const parts = [
    collection,
    JSON.stringify(criteria, Object.keys(criteria).sort()),
  ];

  if (options !== undefined) {
    if (options.limit !== undefined) parts.push(`l:${options.limit}`);
    if (options.offset !== undefined) parts.push(`o:${options.offset}`);
    if (options.orderBy !== undefined) parts.push(`ob:${options.orderBy}`);
    if (options.orderDirection !== undefined) parts.push(`od:${options.orderDirection}`);
    if (options.temporal !== undefined) {
      if (options.temporal.start !== undefined) parts.push(`ts:${options.temporal.start}`);
      if (options.temporal.end !== undefined) parts.push(`te:${options.temporal.end}`);
    }
  }

  return parts.join('|');
}
