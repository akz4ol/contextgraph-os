/**
 * Storage interface abstraction
 *
 * Defines the contract for all storage backends.
 * Implementations must be append-only for provenance data.
 */

import type { Result, Timestamp } from '@contextgraph/core';

/**
 * Query options for filtering and pagination
 */
export interface QueryOptions {
  /** Filter by time range */
  temporal?: {
    start?: Timestamp;
    end?: Timestamp;
  };
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Order by field */
  orderBy?: string;
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/**
 * Storage error types
 */
export type StorageErrorCode =
  | 'CONNECTION_FAILED'
  | 'QUERY_FAILED'
  | 'NOT_FOUND'
  | 'DUPLICATE_KEY'
  | 'CONSTRAINT_VIOLATION'
  | 'INVALID_DATA'
  | 'MIGRATION_FAILED';

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly originalCause: Error | undefined;

  constructor(message: string, code: StorageErrorCode, originalCause?: Error) {
    super(message, { cause: originalCause });
    this.name = 'StorageError';
    this.code = code;
    this.originalCause = originalCause;
  }
}

/**
 * Generic record type for storage
 */
export interface StorageRecord {
  readonly id: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Storage interface contract
 *
 * All implementations must:
 * 1. Be append-only for provenance-tracked data
 * 2. Support transactional operations
 * 3. Provide deterministic query results
 */
export abstract class StorageInterface {
  /**
   * Initialize the storage backend
   */
  abstract initialize(): Promise<Result<void, StorageError>>;

  /**
   * Close the storage connection
   */
  abstract close(): Promise<Result<void, StorageError>>;

  /**
   * Check if storage is healthy
   */
  abstract healthCheck(): Promise<Result<boolean, StorageError>>;

  /**
   * Insert a record (append-only)
   */
  abstract insert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>>;

  /**
   * Insert multiple records in a transaction
   */
  abstract insertMany<T extends StorageRecord>(
    collection: string,
    records: readonly T[]
  ): Promise<Result<readonly T[], StorageError>>;

  /**
   * Find a record by ID
   */
  abstract findById<T extends StorageRecord>(
    collection: string,
    id: string
  ): Promise<Result<T | null, StorageError>>;

  /**
   * Find records matching criteria
   */
  abstract find<T extends StorageRecord>(
    collection: string,
    criteria: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<Result<PaginatedResult<T>, StorageError>>;

  /**
   * Count records matching criteria
   */
  abstract count(
    collection: string,
    criteria?: Record<string, unknown>
  ): Promise<Result<number, StorageError>>;

  /**
   * Upsert a record (insert or update if exists)
   */
  abstract upsert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>>;

  /**
   * Execute a raw query (for advanced use cases)
   */
  abstract query<T>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Result<readonly T[], StorageError>>;

  /**
   * Run operations in a transaction
   */
  abstract transaction<T>(
    fn: () => Promise<Result<T, StorageError>>
  ): Promise<Result<T, StorageError>>;

  /**
   * Get storage statistics
   */
  abstract stats(): Promise<
    Result<{ collections: Record<string, number>; totalSize: number }, StorageError>
  >;
}
