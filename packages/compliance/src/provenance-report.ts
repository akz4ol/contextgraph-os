/**
 * Provenance Report Generator
 *
 * Generates data lineage and provenance chain reports.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  ProvenanceReportOptions,
  ProvenanceReport,
  ProvenanceEntry,
  ProvenanceSummary,
  ChainIntegrity,
  ReportMetadata,
} from './types.js';

/**
 * Provenance record from storage
 */
interface ProvenanceRecord {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly action: string;
  readonly entityId?: string;
  readonly claimId?: string;
  readonly previousHash?: string;
  readonly hash: string;
  readonly metadata?: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Provenance Report Generator class
 */
export class ProvenanceReportGenerator {
  private readonly storage: StorageInterface;
  private readonly provenanceCollection = 'provenance';

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Generate a provenance report
   */
  async generate(
    options: ProvenanceReportOptions = {},
    generatedBy: string = 'system'
  ): Promise<Result<ProvenanceReport, Error>> {
    const now = createTimestamp();
    const reportId = `provenance_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // Build query criteria
    const criteria: Record<string, unknown> = {};
    if (options.sourceType !== undefined) {
      criteria['sourceType'] = options.sourceType;
    }
    if (options.entityId !== undefined) {
      criteria['entityId'] = options.entityId;
    }

    // Query provenance records
    const queryOptions: { limit: number; offset?: number; orderBy?: string; orderDirection?: 'asc' | 'desc' } = {
      limit: options.limit ?? 1000,
      orderBy: 'timestamp',
      orderDirection: 'asc',
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<ProvenanceRecord>(
      this.provenanceCollection,
      criteria,
      queryOptions
    );

    if (!result.ok) {
      return err(result.error);
    }

    // Filter by time range if specified
    let records = result.value.items;
    if (options.startTime !== undefined) {
      records = records.filter((r) => r.timestamp >= options.startTime!);
    }
    if (options.endTime !== undefined) {
      records = records.filter((r) => r.timestamp <= options.endTime!);
    }

    // Convert to provenance entries
    const entries: ProvenanceEntry[] = records.map((record) => {
      const entry: ProvenanceEntry = {
        id: record.id,
        timestamp: record.timestamp,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        action: record.action,
        hash: record.hash,
      };
      if (record.entityId !== undefined) {
        (entry as { entityId?: string }).entityId = record.entityId;
      }
      if (record.claimId !== undefined) {
        (entry as { claimId?: string }).claimId = record.claimId;
      }
      if (record.previousHash !== undefined) {
        (entry as { previousHash?: string }).previousHash = record.previousHash;
      }
      if (record.metadata !== undefined) {
        (entry as { metadata?: Record<string, unknown> }).metadata = JSON.parse(record.metadata);
      }
      return entry;
    });

    // Generate summary
    const summary = this.generateSummary(entries);

    // Verify chain integrity
    const chainIntegrity = this.verifyChainIntegrity(entries);

    // Build metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'provenance',
      generatedAt: now,
      generatedBy,
      options: options as Record<string, unknown>,
      totalRecords: entries.length,
      format: 'json',
    };

    return ok({
      metadata,
      entries,
      summary,
      chainIntegrity,
    });
  }

  /**
   * Generate provenance summary from entries
   */
  private generateSummary(entries: readonly ProvenanceEntry[]): ProvenanceSummary {
    const bySourceType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let firstEntry: Timestamp | undefined;
    let lastEntry: Timestamp | undefined;

    for (const entry of entries) {
      // Count by source type
      bySourceType[entry.sourceType] = (bySourceType[entry.sourceType] ?? 0) + 1;

      // Count by action
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;

      // Track first/last entries
      if (firstEntry === undefined || entry.timestamp < firstEntry) {
        firstEntry = entry.timestamp;
      }
      if (lastEntry === undefined || entry.timestamp > lastEntry) {
        lastEntry = entry.timestamp;
      }
    }

    const summary: ProvenanceSummary = {
      totalEntries: entries.length,
      bySourceType,
      byAction,
    };

    if (firstEntry !== undefined) {
      (summary as { firstEntry?: Timestamp }).firstEntry = firstEntry;
    }
    if (lastEntry !== undefined) {
      (summary as { lastEntry?: Timestamp }).lastEntry = lastEntry;
    }

    return summary;
  }

  /**
   * Verify chain integrity
   */
  private verifyChainIntegrity(entries: readonly ProvenanceEntry[]): ChainIntegrity {
    if (entries.length === 0) {
      return {
        valid: true,
        entriesVerified: 0,
        brokenLinks: 0,
        invalidHashes: 0,
        errors: [],
      };
    }

    const errors: string[] = [];
    let brokenLinks = 0;
    let invalidHashes = 0;

    // Sort by timestamp
    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

    // Build hash index for quick lookup
    const hashIndex = new Map<string, ProvenanceEntry>();
    for (const entry of sortedEntries) {
      hashIndex.set(entry.hash, entry);
    }

    // Verify chain linkage
    for (let i = 1; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i]!;

      if (entry.previousHash !== undefined) {
        if (!hashIndex.has(entry.previousHash)) {
          brokenLinks++;
          errors.push(`Broken link at entry ${entry.id}: previousHash ${entry.previousHash} not found`);
        }
      }
    }

    // Note: Full hash verification would require re-computing hashes
    // For now, we only check structural integrity

    const valid = brokenLinks === 0 && invalidHashes === 0;

    return {
      valid,
      entriesVerified: sortedEntries.length,
      brokenLinks,
      invalidHashes,
      errors,
    };
  }
}
