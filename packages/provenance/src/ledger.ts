/**
 * Provenance Ledger
 *
 * Manages the provenance chain with integrity verification.
 * All entries are immutable and form a hash-linked chain.
 */

import {
  type ProvenanceId,
  type Result,
  ok,
  err,
} from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  ProvenanceRecord,
  CreateProvenanceInput,
  ProvenanceQueryOptions,
  SourceType,
  ActionType,
} from './types.js';
import { ProvenanceEntry } from './entry.js';

/**
 * Chain verification result
 */
export interface ChainVerificationResult {
  readonly valid: boolean;
  readonly entriesVerified: number;
  readonly brokenLinks: readonly {
    readonly entryId: ProvenanceId;
    readonly expectedPreviousHash: string | undefined;
    readonly actualPreviousHash: string | undefined;
  }[];
  readonly invalidHashes: readonly ProvenanceId[];
}

/**
 * Provenance Ledger Error
 */
export class ProvenanceLedgerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly entryId?: ProvenanceId
  ) {
    super(message);
    this.name = 'ProvenanceLedgerError';
  }
}

/**
 * Provenance Ledger
 *
 * Provides append-only storage for provenance entries with hash chain verification.
 */
export class ProvenanceLedger {
  private readonly collection = 'provenance';
  private lastHash: string | undefined;

  constructor(private readonly storage: StorageInterface) {}

  /**
   * Initialize the ledger by loading the last hash
   */
  async initialize(): Promise<Result<void, Error>> {
    const lastEntryResult = await this.getLastEntry();
    if (!lastEntryResult.ok) {
      return err(lastEntryResult.error);
    }

    if (lastEntryResult.value !== null) {
      this.lastHash = lastEntryResult.value.data.hash;
    }

    return ok(undefined);
  }

  /**
   * Record a new provenance entry
   */
  async record(input: CreateProvenanceInput): Promise<Result<ProvenanceEntry, Error>> {
    const entryResult = ProvenanceEntry.create(input, this.lastHash);
    if (!entryResult.ok) {
      return entryResult;
    }

    const entry = entryResult.value;
    const insertResult = await this.storage.insert(this.collection, entry.toRecord());
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    // Update last hash for next entry
    this.lastHash = entry.data.hash;

    return ok(entry);
  }

  /**
   * Get entry by ID
   */
  async getById(id: ProvenanceId): Promise<Result<ProvenanceEntry | null, Error>> {
    const result = await this.storage.findById<ProvenanceRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(ProvenanceEntry.fromRecord(result.value));
  }

  /**
   * Get the last entry in the chain
   */
  async getLastEntry(): Promise<Result<ProvenanceEntry | null, Error>> {
    const result = await this.storage.find<ProvenanceRecord>(
      this.collection,
      {},
      { limit: 1, orderBy: 'createdAt', orderDirection: 'desc' }
    );

    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.items.length === 0) {
      return ok(null);
    }

    return ok(ProvenanceEntry.fromRecord(result.value.items[0]!));
  }

  /**
   * Query provenance entries
   */
  async query(options: ProvenanceQueryOptions): Promise<Result<readonly ProvenanceEntry[], Error>> {
    const criteria: Record<string, unknown> = {};

    if (options.sourceType !== undefined) {
      criteria['sourceType'] = options.sourceType;
    }

    if (options.actor !== undefined) {
      criteria['actor'] = options.actor;
    }

    if (options.action !== undefined) {
      criteria['action'] = options.action;
    }

    const queryOptions: { limit?: number; offset?: number; orderBy?: string; orderDirection?: 'asc' | 'desc' } = {
      orderBy: 'createdAt',
      orderDirection: 'asc',
    };

    if (options.limit !== undefined) {
      queryOptions.limit = options.limit;
    }
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    // Note: time range filtering on 'timestamp' field requires post-filtering
    // since the storage interface temporal filter uses 'createdAt'
    const result = await this.storage.find<ProvenanceRecord>(this.collection, criteria, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    let entries = result.value.items.map((record) => ProvenanceEntry.fromRecord(record));

    // Apply timestamp range filter if specified (post-filter)
    if (options.timeRange !== undefined) {
      const { start, end } = options.timeRange;
      entries = entries.filter((entry) => {
        const ts = entry.data.timestamp;
        return ts >= start && ts <= end;
      });
    }

    return ok(entries);
  }

  /**
   * Find entries by source type
   */
  async findBySourceType(sourceType: SourceType): Promise<Result<readonly ProvenanceEntry[], Error>> {
    return this.query({ sourceType });
  }

  /**
   * Find entries by actor
   */
  async findByActor(actor: string): Promise<Result<readonly ProvenanceEntry[], Error>> {
    return this.query({ actor });
  }

  /**
   * Find entries by action
   */
  async findByAction(action: ActionType): Promise<Result<readonly ProvenanceEntry[], Error>> {
    return this.query({ action });
  }

  /**
   * Get the provenance chain starting from an entry
   */
  async getChain(startId: ProvenanceId): Promise<Result<readonly ProvenanceEntry[], Error>> {
    const chain: ProvenanceEntry[] = [];
    let currentId: ProvenanceId | undefined = startId;

    while (currentId !== undefined) {
      const entryResult = await this.getById(currentId);
      if (!entryResult.ok) {
        return err(entryResult.error);
      }

      if (entryResult.value === null) {
        break;
      }

      chain.push(entryResult.value);

      // Find the previous entry by hash
      if (entryResult.value.data.previousHash !== undefined) {
        const prevResult = await this.storage.find<ProvenanceRecord>(
          this.collection,
          { hash: entryResult.value.data.previousHash },
          { limit: 1 }
        );

        if (!prevResult.ok) {
          return err(prevResult.error);
        }

        if (prevResult.value.items.length > 0) {
          currentId = prevResult.value.items[0]!.id as ProvenanceId;
        } else {
          currentId = undefined;
        }
      } else {
        currentId = undefined;
      }
    }

    return ok(chain);
  }

  /**
   * Verify the integrity of the provenance chain
   */
  async verifyChain(options?: { limit?: number }): Promise<Result<ChainVerificationResult, Error>> {
    // Get all entries in order
    const queryOptions: { orderBy: string; orderDirection: 'asc' | 'desc'; limit?: number } = {
      orderBy: 'createdAt',
      orderDirection: 'asc',
    };

    if (options?.limit !== undefined) {
      queryOptions.limit = options.limit;
    }

    const result = await this.storage.find<ProvenanceRecord>(
      this.collection,
      {},
      queryOptions
    );

    if (!result.ok) {
      return err(result.error);
    }

    const entries = result.value.items.map((record) => ProvenanceEntry.fromRecord(record));
    const brokenLinks: {
      entryId: ProvenanceId;
      expectedPreviousHash: string | undefined;
      actualPreviousHash: string | undefined;
    }[] = [];
    const invalidHashes: ProvenanceId[] = [];

    let previousHash: string | undefined;

    for (const entry of entries) {
      // Verify entry's own hash
      if (!entry.verifyHash()) {
        invalidHashes.push(entry.data.id);
      }

      // Verify link to previous entry
      if (entry.data.previousHash !== previousHash) {
        brokenLinks.push({
          entryId: entry.data.id,
          expectedPreviousHash: previousHash,
          actualPreviousHash: entry.data.previousHash,
        });
      }

      previousHash = entry.data.hash;
    }

    return ok({
      valid: brokenLinks.length === 0 && invalidHashes.length === 0,
      entriesVerified: entries.length,
      brokenLinks,
      invalidHashes,
    });
  }

  /**
   * Count entries
   */
  async count(): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, {});
  }
}
