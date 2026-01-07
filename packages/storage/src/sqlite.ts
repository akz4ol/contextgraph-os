/**
 * SQLite storage implementation using sql.js
 *
 * Provides a SQLite-backed storage with:
 * - Append-only semantics
 * - JSON field support
 * - Pure JavaScript (no native dependencies)
 */

import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { ok, err, type Result, createTimestamp, type Timestamp } from '@contextgraph/core';
import {
  StorageInterface,
  StorageError,
  type QueryOptions,
  type PaginatedResult,
  type StorageRecord,
} from './interface.js';
import { MigrationRunner, coreMigrations } from './migrations.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SQLiteStorageOptions {
  /** Path to SQLite database file (use ':memory:' for in-memory) */
  path: string;
  /** Run migrations on initialize */
  runMigrations?: boolean;
  /** Auto-save interval in milliseconds (0 to disable) */
  autoSaveInterval?: number;
}

export class SQLiteStorage extends StorageInterface {
  private db: SqlJsDatabase | null = null;
  private SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
  private readonly options: Required<SQLiteStorageOptions>;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isDirty = false;

  constructor(options: SQLiteStorageOptions) {
    super();
    this.options = {
      path: options.path,
      runMigrations: options.runMigrations ?? true,
      autoSaveInterval: options.autoSaveInterval ?? 0,
    };
  }

  async initialize(): Promise<Result<void, StorageError>> {
    try {
      this.SQL = await initSqlJs();

      // Load existing database or create new one
      if (this.options.path !== ':memory:') {
        try {
          const fileBuffer = await readFile(this.options.path);
          this.db = new this.SQL.Database(fileBuffer);
        } catch {
          // File doesn't exist, create new database
          this.db = new this.SQL.Database();
        }
      } else {
        this.db = new this.SQL.Database();
      }

      // Run migrations if enabled
      if (this.options.runMigrations) {
        const migrationRunner = new MigrationRunner(this.db);
        const migrationResult = migrationRunner.run(coreMigrations);
        if (!migrationResult.ok) {
          return err(migrationResult.error);
        }
        this.isDirty = true;
      }

      // Setup auto-save if configured
      if (this.options.autoSaveInterval > 0 && this.options.path !== ':memory:') {
        this.autoSaveTimer = setInterval(() => {
          void this.save();
        }, this.options.autoSaveInterval);
      }

      return ok(undefined);
    } catch (error) {
      return err(
        new StorageError(
          `Failed to initialize SQLite: ${error instanceof Error ? error.message : String(error)}`,
          'CONNECTION_FAILED',
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async close(): Promise<Result<void, StorageError>> {
    try {
      if (this.autoSaveTimer !== null) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }

      // Save before closing
      if (this.isDirty) {
        await this.save();
      }

      if (this.db !== null) {
        this.db.close();
        this.db = null;
      }
      return ok(undefined);
    } catch (error) {
      return err(
        new StorageError(
          `Failed to close SQLite: ${error instanceof Error ? error.message : String(error)}`,
          'CONNECTION_FAILED',
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * Save the database to disk
   */
  async save(): Promise<Result<void, StorageError>> {
    if (this.options.path === ':memory:' || this.db === null) {
      return ok(undefined);
    }

    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      await mkdir(dirname(this.options.path), { recursive: true });
      await writeFile(this.options.path, buffer);
      this.isDirty = false;
      return ok(undefined);
    } catch (error) {
      return err(
        new StorageError(
          `Failed to save database: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED',
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async healthCheck(): Promise<Result<boolean, StorageError>> {
    try {
      if (this.db === null) {
        return ok(false);
      }
      this.db.exec('SELECT 1');
      return ok(true);
    } catch (error) {
      return err(
        new StorageError(
          `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED',
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async insert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>> {
    try {
      this.ensureConnected();
      const now = createTimestamp();
      const recordWithTimestamp = { ...record, createdAt: record.createdAt ?? now };

      const columns = Object.keys(recordWithTimestamp);
      const placeholders = columns.map(() => '?').join(', ');
      const values: SqlValue[] = columns.map((col) => {
        const value = recordWithTimestamp[col as keyof typeof recordWithTimestamp];
        return (typeof value === 'object' && value !== null ? JSON.stringify(value) : value) as SqlValue;
      });

      const sql = `INSERT INTO ${this.escapeIdentifier(collection)} (${columns.map((c) => this.escapeIdentifier(c)).join(', ')}) VALUES (${placeholders})`;
      this.db!.run(sql, values);
      this.isDirty = true;

      return ok(recordWithTimestamp as T);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint')) {
        return err(new StorageError(`Duplicate key in ${collection}`, 'DUPLICATE_KEY'));
      }
      return err(new StorageError(`Insert failed: ${message}`, 'QUERY_FAILED'));
    }
  }

  async insertMany<T extends StorageRecord>(
    collection: string,
    records: readonly T[]
  ): Promise<Result<readonly T[], StorageError>> {
    return this.transaction(async () => {
      const results: T[] = [];
      for (const record of records) {
        const result = await this.insert(collection, record);
        if (!result.ok) {
          return result as Result<never, StorageError>;
        }
        results.push(result.value);
      }
      return ok(results);
    });
  }

  async findById<T extends StorageRecord>(
    collection: string,
    id: string
  ): Promise<Result<T | null, StorageError>> {
    try {
      this.ensureConnected();
      const sql = `SELECT * FROM ${this.escapeIdentifier(collection)} WHERE id = ?`;
      const result = this.db!.exec(sql, [id]);

      if (result.length === 0 || result[0]!.values.length === 0) {
        return ok(null);
      }

      const columns = result[0]!.columns;
      const values = result[0]!.values[0]!;
      const row = this.rowToObject(columns, values);

      return ok(this.deserializeRow<T>(row));
    } catch (error) {
      return err(
        new StorageError(
          `Find by ID failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  async find<T extends StorageRecord>(
    collection: string,
    criteria: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<Result<PaginatedResult<T>, StorageError>> {
    try {
      this.ensureConnected();
      const { whereClause, params } = this.buildWhereClause(criteria, options);

      const limit = options?.limit ?? 100;
      const offset = options?.offset ?? 0;
      const orderBy = options?.orderBy ?? 'createdAt';
      const orderDir = options?.orderDirection ?? 'desc';

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(collection)} ${whereClause}`;
      const countResult = this.db!.exec(countSql, params);
      const total = countResult.length > 0 && countResult[0]!.values.length > 0
        ? (countResult[0]!.values[0]![0] as number)
        : 0;

      // Get paginated results
      const sql = `SELECT * FROM ${this.escapeIdentifier(collection)} ${whereClause} ORDER BY ${this.escapeIdentifier(orderBy)} ${orderDir.toUpperCase()} LIMIT ? OFFSET ?`;
      const result = this.db!.exec(sql, [...params, limit as SqlValue, offset as SqlValue]);

      const items: T[] = [];
      if (result.length > 0) {
        const columns = result[0]!.columns;
        for (const values of result[0]!.values) {
          const row = this.rowToObject(columns, values);
          items.push(this.deserializeRow<T>(row));
        }
      }

      return ok({
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      });
    } catch (error) {
      return err(
        new StorageError(
          `Find failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  async count(
    collection: string,
    criteria?: Record<string, unknown>
  ): Promise<Result<number, StorageError>> {
    try {
      this.ensureConnected();
      const { whereClause, params } = this.buildWhereClause(criteria ?? {});
      const sql = `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(collection)} ${whereClause}`;
      const result = this.db!.exec(sql, params);
      const count = result.length > 0 && result[0]!.values.length > 0
        ? (result[0]!.values[0]![0] as number)
        : 0;
      return ok(count);
    } catch (error) {
      return err(
        new StorageError(
          `Count failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  async upsert<T extends StorageRecord>(
    collection: string,
    record: T
  ): Promise<Result<T, StorageError>> {
    try {
      this.ensureConnected();
      const now = createTimestamp();
      const recordWithTimestamp = { ...record, createdAt: record.createdAt ?? now };

      const columns = Object.keys(recordWithTimestamp);
      const placeholders = columns.map(() => '?').join(', ');
      const updateSets = columns
        .filter((c) => c !== 'id')
        .map((c) => `${this.escapeIdentifier(c)} = excluded.${this.escapeIdentifier(c)}`)
        .join(', ');
      const values: SqlValue[] = columns.map((col) => {
        const value = recordWithTimestamp[col as keyof typeof recordWithTimestamp];
        return (typeof value === 'object' && value !== null ? JSON.stringify(value) : value) as SqlValue;
      });

      const sql = `INSERT INTO ${this.escapeIdentifier(collection)} (${columns.map((c) => this.escapeIdentifier(c)).join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSets}`;
      this.db!.run(sql, values);
      this.isDirty = true;

      return ok(recordWithTimestamp as T);
    } catch (error) {
      return err(
        new StorageError(
          `Upsert failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  async query<T>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Result<readonly T[], StorageError>> {
    try {
      this.ensureConnected();
      const result = this.db!.exec(sql, params as SqlValue[] | undefined);

      const items: T[] = [];
      if (result.length > 0) {
        const columns = result[0]!.columns;
        for (const values of result[0]!.values) {
          const row = this.rowToObject(columns, values);
          items.push(row as T);
        }
      }

      return ok(items);
    } catch (error) {
      return err(
        new StorageError(
          `Query failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  async transaction<T>(
    fn: () => Promise<Result<T, StorageError>>
  ): Promise<Result<T, StorageError>> {
    this.ensureConnected();
    try {
      this.db!.run('BEGIN TRANSACTION');
      const result = await fn();
      if (result.ok) {
        this.db!.run('COMMIT');
      } else {
        this.db!.run('ROLLBACK');
      }
      return result;
    } catch (error) {
      this.db!.run('ROLLBACK');
      return err(
        new StorageError(
          `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  async stats(): Promise<
    Result<{ collections: Record<string, number>; totalSize: number }, StorageError>
  > {
    try {
      this.ensureConnected();

      // Get all table names
      const tablesResult = this.db!.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'"
      );

      const collections: Record<string, number> = {};
      if (tablesResult.length > 0) {
        for (const row of tablesResult[0]!.values) {
          const tableName = row[0] as string;
          const countResult = this.db!.exec(
            `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(tableName)}`
          );
          collections[tableName] = countResult.length > 0 && countResult[0]!.values.length > 0
            ? (countResult[0]!.values[0]![0] as number)
            : 0;
        }
      }

      // Estimate size
      const data = this.db!.export();
      const totalSize = data.length;

      return ok({ collections, totalSize });
    } catch (error) {
      return err(
        new StorageError(
          `Stats failed: ${error instanceof Error ? error.message : String(error)}`,
          'QUERY_FAILED'
        )
      );
    }
  }

  /**
   * Get raw database instance for advanced operations
   */
  getRawDatabase(): SqlJsDatabase {
    this.ensureConnected();
    return this.db!;
  }

  private ensureConnected(): void {
    if (this.db === null) {
      throw new StorageError('Database not initialized', 'CONNECTION_FAILED');
    }
  }

  private escapeIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  private rowToObject(columns: string[], values: unknown[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]!] = values[i];
    }
    return obj;
  }

  private buildWhereClause(
    criteria: Record<string, unknown>,
    options?: QueryOptions
  ): { whereClause: string; params: SqlValue[] } {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    for (const [key, value] of Object.entries(criteria)) {
      if (value === undefined) continue;
      conditions.push(`${this.escapeIdentifier(key)} = ?`);
      params.push((typeof value === 'object' && value !== null ? JSON.stringify(value) : value) as SqlValue);
    }

    if (options?.temporal !== undefined) {
      if (options.temporal.start !== undefined) {
        conditions.push('"createdAt" >= ?');
        params.push(options.temporal.start as SqlValue);
      }
      if (options.temporal.end !== undefined) {
        conditions.push('"createdAt" <= ?');
        params.push(options.temporal.end as SqlValue);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  private deserializeRow<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    if (typeof result['createdAt'] === 'number') {
      result['createdAt'] = result['createdAt'] as Timestamp;
    }
    return result as T;
  }
}
