/**
 * In-memory storage implementation
 *
 * Useful for testing and prototyping.
 * Not suitable for production use.
 */

import { ok, err, type Result, createTimestamp } from '@contextgraph/core';
import {
  StorageInterface,
  StorageError,
  type QueryOptions,
  type PaginatedResult,
  type StorageRecord,
} from './interface.js';

export class InMemoryStorage extends StorageInterface {
  private collections: Map<string, Map<string, StorageRecord>> = new Map();
  private initialized = false;

  async initialize(): Promise<Result<void, StorageError>> {
    this.collections.clear();
    this.initialized = true;
    return ok(undefined);
  }

  async close(): Promise<Result<void, StorageError>> {
    this.collections.clear();
    this.initialized = false;
    return ok(undefined);
  }

  async healthCheck(): Promise<Result<boolean, StorageError>> {
    return ok(this.initialized);
  }

  async insert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>> {
    this.ensureInitialized();

    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map());
    }

    const col = this.collections.get(collection)!;
    if (col.has(record.id)) {
      return err(new StorageError(`Duplicate key: ${record.id}`, 'DUPLICATE_KEY'));
    }

    const now = createTimestamp();
    const recordWithTimestamp = { ...record, createdAt: record.createdAt ?? now } as T;
    col.set(record.id, recordWithTimestamp);
    return ok(recordWithTimestamp);
  }

  async insertMany<T extends StorageRecord>(
    collection: string,
    records: readonly T[]
  ): Promise<Result<readonly T[], StorageError>> {
    const results: T[] = [];
    for (const record of records) {
      const result = await this.insert(collection, record);
      if (!result.ok) {
        // Rollback: remove all inserted records
        const col = this.collections.get(collection);
        if (col !== undefined) {
          for (const inserted of results) {
            col.delete(inserted.id);
          }
        }
        return result as Result<never, StorageError>;
      }
      results.push(result.value);
    }
    return ok(results);
  }

  async findById<T extends StorageRecord>(
    collection: string,
    id: string
  ): Promise<Result<T | null, StorageError>> {
    this.ensureInitialized();
    const col = this.collections.get(collection);
    if (col === undefined) {
      return ok(null);
    }
    const record = col.get(id);
    return ok(record !== undefined ? (record as T) : null);
  }

  async find<T extends StorageRecord>(
    collection: string,
    criteria: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<Result<PaginatedResult<T>, StorageError>> {
    this.ensureInitialized();

    const col = this.collections.get(collection);
    if (col === undefined) {
      return ok({ items: [], total: 0, limit: options?.limit ?? 100, offset: options?.offset ?? 0, hasMore: false });
    }

    let records = Array.from(col.values()) as T[];

    // Apply criteria filter
    records = records.filter((record) => {
      for (const [key, value] of Object.entries(criteria)) {
        if (value === undefined) continue;
        const recordValue = record[key as keyof T];
        if (JSON.stringify(recordValue) !== JSON.stringify(value)) {
          return false;
        }
      }
      return true;
    });

    // Apply temporal filter
    if (options?.temporal !== undefined) {
      records = records.filter((record) => {
        const createdAt = record.createdAt;
        if (options.temporal?.start !== undefined && createdAt < options.temporal.start) {
          return false;
        }
        if (options.temporal?.end !== undefined && createdAt > options.temporal.end) {
          return false;
        }
        return true;
      });
    }

    const total = records.length;

    // Apply sorting
    const orderBy = options?.orderBy ?? 'createdAt';
    const orderDir = options?.orderDirection ?? 'desc';
    records.sort((a, b) => {
      const aVal = a[orderBy as keyof T];
      const bVal = b[orderBy as keyof T];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const comparison = aVal < bVal ? -1 : 1;
      return orderDir === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    records = records.slice(offset, offset + limit);

    return ok({
      items: records,
      total,
      limit,
      offset,
      hasMore: offset + records.length < total,
    });
  }

  async count(
    collection: string,
    criteria?: Record<string, unknown>
  ): Promise<Result<number, StorageError>> {
    const result = await this.find(collection, criteria ?? {}, { limit: 0 });
    if (!result.ok) {
      return result as Result<never, StorageError>;
    }
    return ok(result.value.total);
  }

  async upsert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>> {
    this.ensureInitialized();

    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map());
    }

    const col = this.collections.get(collection)!;
    const now = createTimestamp();
    const recordWithTimestamp = { ...record, createdAt: record.createdAt ?? now } as T;
    col.set(record.id, recordWithTimestamp);
    return ok(recordWithTimestamp);
  }

  async query<T>(
    _sql: string,
    _params?: readonly unknown[]
  ): Promise<Result<readonly T[], StorageError>> {
    return err(new StorageError('Raw queries not supported in memory storage', 'QUERY_FAILED'));
  }

  async transaction<T>(
    fn: () => Promise<Result<T, StorageError>>
  ): Promise<Result<T, StorageError>> {
    // Simple implementation - no real transaction support
    return fn();
  }

  async stats(): Promise<
    Result<{ collections: Record<string, number>; totalSize: number }, StorageError>
  > {
    const collections: Record<string, number> = {};
    let totalSize = 0;

    for (const [name, col] of this.collections) {
      collections[name] = col.size;
      totalSize += col.size;
    }

    return ok({ collections, totalSize });
  }

  /**
   * Clear all data (useful for tests)
   */
  async clear(): Promise<void> {
    this.collections.clear();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new StorageError('Storage not initialized', 'CONNECTION_FAILED');
    }
  }
}
