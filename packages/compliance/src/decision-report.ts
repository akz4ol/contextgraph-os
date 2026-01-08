/**
 * Decision Report Generator
 *
 * Generates reports on decisions and their lifecycle.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  DecisionReportOptions,
  DecisionReport,
  DecisionEntry,
  DecisionSummary,
  ReportMetadata,
} from './types.js';

/**
 * Decision record from storage
 */
interface DecisionRecord {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly riskLevel: string;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
  readonly approvedBy?: string;
  readonly approvedAt?: Timestamp;
  readonly rejectedBy?: string;
  readonly rejectedAt?: Timestamp;
  readonly executedAt?: Timestamp;
  readonly rationale?: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Decision Report Generator class
 */
export class DecisionReportGenerator {
  private readonly storage: StorageInterface;
  private readonly decisionCollection = 'decisions';

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Generate a decision report
   */
  async generate(
    options: DecisionReportOptions = {},
    generatedBy: string = 'system'
  ): Promise<Result<DecisionReport, Error>> {
    const now = createTimestamp();
    const reportId = `decision_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // Build query criteria
    const criteria: Record<string, unknown> = {};
    if (options.status !== undefined) {
      criteria['status'] = options.status;
    }
    if (options.proposedBy !== undefined) {
      criteria['proposedBy'] = options.proposedBy;
    }
    if (options.approvedBy !== undefined) {
      criteria['approvedBy'] = options.approvedBy;
    }
    if (options.riskLevel !== undefined) {
      criteria['riskLevel'] = options.riskLevel;
    }

    // Query decision records
    const queryOptions: { limit: number; offset?: number } = {
      limit: options.limit ?? 1000,
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<DecisionRecord>(
      this.decisionCollection,
      criteria,
      queryOptions
    );

    if (!result.ok) {
      return err(result.error);
    }

    // Filter by time range if specified
    let records = result.value.items;
    if (options.startTime !== undefined) {
      records = records.filter((r) => r.proposedAt >= options.startTime!);
    }
    if (options.endTime !== undefined) {
      records = records.filter((r) => r.proposedAt <= options.endTime!);
    }

    // Convert to decision entries
    const entries: DecisionEntry[] = records.map((record) => {
      const entry: DecisionEntry = {
        id: record.id,
        type: record.type,
        title: record.title,
        status: record.status,
        riskLevel: record.riskLevel,
        proposedBy: record.proposedBy,
        proposedAt: record.proposedAt,
      };
      if (record.approvedBy !== undefined) {
        (entry as { approvedBy?: string }).approvedBy = record.approvedBy;
      }
      if (record.approvedAt !== undefined) {
        (entry as { approvedAt?: Timestamp }).approvedAt = record.approvedAt;
      }
      if (record.rejectedBy !== undefined) {
        (entry as { rejectedBy?: string }).rejectedBy = record.rejectedBy;
      }
      if (record.rejectedAt !== undefined) {
        (entry as { rejectedAt?: Timestamp }).rejectedAt = record.rejectedAt;
      }
      if (record.executedAt !== undefined) {
        (entry as { executedAt?: Timestamp }).executedAt = record.executedAt;
      }
      if (record.rationale !== undefined) {
        (entry as { rationale?: string }).rationale = record.rationale;
      }
      return entry;
    });

    // Generate summary
    const summary = this.generateSummary(entries);

    // Build metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'decision',
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
    });
  }

  /**
   * Generate decision summary from entries
   */
  private generateSummary(entries: readonly DecisionEntry[]): DecisionSummary {
    const byStatus: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    const byProposer: Record<string, number> = {};
    const approvalTimes: number[] = [];

    for (const entry of entries) {
      // Count by status
      byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;

      // Count by risk level
      byRiskLevel[entry.riskLevel] = (byRiskLevel[entry.riskLevel] ?? 0) + 1;

      // Count by proposer
      byProposer[entry.proposedBy] = (byProposer[entry.proposedBy] ?? 0) + 1;

      // Calculate approval time
      if (entry.approvedAt !== undefined && entry.proposedAt !== undefined) {
        approvalTimes.push(entry.approvedAt - entry.proposedAt);
      }
    }

    const summary: DecisionSummary = {
      totalDecisions: entries.length,
      byStatus,
      byRiskLevel,
      byProposer,
    };

    // Calculate average approval time if we have data
    if (approvalTimes.length > 0) {
      const avgTime = approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length;
      return { ...summary, averageApprovalTime: avgTime };
    }

    return summary;
  }
}
