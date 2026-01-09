/**
 * @contextgraph/storage
 *
 * Backend-agnostic storage abstraction for ContextGraph OS.
 * Provides interfaces and SQLite implementation for claims, provenance, and decisions.
 */

export { StorageInterface, StorageError, type QueryOptions, type PaginatedResult, type StorageRecord, type StorageErrorCode } from './interface.js';
export { SQLiteStorage, type SQLiteStorageOptions } from './sqlite.js';
export { InMemoryStorage } from './memory.js';
export { MigrationRunner, type Migration } from './migrations.js';
export { LRUCache, createCacheKey, type CacheConfig, type CacheStats } from './cache.js';
export { CachedStorage, createCachedStorage, type CachedStorageConfig } from './cached.js';
