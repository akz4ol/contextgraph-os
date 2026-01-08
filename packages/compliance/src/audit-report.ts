/**
 * Audit Report Generator
 *
 * Generates comprehensive audit trail reports.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  AuditReportOptions,
  AuditReport,
  AuditEntry,
  AuditSummary,
  ReportMetadata,
} from './types.js';

/**
 * Audit record from storage
 */
interface AuditRecord {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly agentId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: 'allowed' | 'denied';
  readonly reason?: string;
  readonly duration?: number;
  readonly parameters?: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Agent record from storage
 */
interface AgentRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Audit Report Generator class
 */
export class AuditReportGenerator {
  private readonly storage: StorageInterface;
  private readonly auditCollection = 'audit_trail';
  private readonly agentCollection = 'agents';

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Generate an audit report
   */
  async generate(
    options: AuditReportOptions = {},
    generatedBy: string = 'system'
  ): Promise<Result<AuditReport, Error>> {
    const now = createTimestamp();
    const reportId = `audit_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // Build query criteria
    const criteria: Record<string, unknown> = {};
    if (options.agentId !== undefined) {
      criteria['agentId'] = options.agentId;
    }
    if (options.action !== undefined) {
      criteria['action'] = options.action;
    }
    if (options.resourceType !== undefined) {
      criteria['resourceType'] = options.resourceType;
    }
    if (options.outcome !== undefined) {
      criteria['outcome'] = options.outcome;
    }

    // Query audit records
    const queryOptions: { limit: number; offset?: number } = {
      limit: options.limit ?? 1000,
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<AuditRecord>(
      this.auditCollection,
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

    // Get agent names for enrichment
    const agentNames = await this.getAgentNames(records.map((r) => r.agentId));

    // Convert to audit entries
    const entries: AuditEntry[] = records.map((record) => {
      const entry: AuditEntry = {
        id: record.id,
        timestamp: record.timestamp,
        agentId: record.agentId,
        action: record.action,
        resourceType: record.resourceType,
        outcome: record.outcome,
      };
      const agentName = agentNames.get(record.agentId);
      if (agentName !== undefined) {
        (entry as { agentName?: string }).agentName = agentName;
      }
      if (record.resourceId !== undefined) {
        (entry as { resourceId?: string }).resourceId = record.resourceId;
      }
      if (record.reason !== undefined) {
        (entry as { reason?: string }).reason = record.reason;
      }
      if (record.duration !== undefined) {
        (entry as { duration?: number }).duration = record.duration;
      }
      if (record.parameters !== undefined) {
        (entry as { parameters?: Record<string, unknown> }).parameters = JSON.parse(record.parameters);
      }
      return entry;
    });

    // Generate summary
    const summary = this.generateSummary(entries);

    // Build metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'audit',
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
   * Get agent names for a list of agent IDs
   */
  private async getAgentNames(agentIds: readonly string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const uniqueIds = [...new Set(agentIds)];

    for (const id of uniqueIds) {
      const result = await this.storage.findById<AgentRecord>(this.agentCollection, id);
      if (result.ok && result.value !== null) {
        names.set(id, result.value.name);
      }
    }

    return names;
  }

  /**
   * Generate audit summary from entries
   */
  private generateSummary(entries: readonly AuditEntry[]): AuditSummary {
    const actionCounts: Record<string, number> = {};
    const outcomeByAgent: Record<string, { allowed: number; denied: number }> = {};
    const uniqueAgents = new Set<string>();
    const uniqueResources = new Set<string>();

    let allowedActions = 0;
    let deniedActions = 0;

    for (const entry of entries) {
      // Count actions
      actionCounts[entry.action] = (actionCounts[entry.action] ?? 0) + 1;

      // Count outcomes
      if (entry.outcome === 'allowed') {
        allowedActions++;
      } else {
        deniedActions++;
      }

      // Track unique agents
      uniqueAgents.add(entry.agentId);

      // Track unique resources
      if (entry.resourceId !== undefined) {
        uniqueResources.add(`${entry.resourceType}/${entry.resourceId}`);
      } else {
        uniqueResources.add(entry.resourceType);
      }

      // Track outcome by agent
      if (outcomeByAgent[entry.agentId] === undefined) {
        outcomeByAgent[entry.agentId] = { allowed: 0, denied: 0 };
      }
      outcomeByAgent[entry.agentId]![entry.outcome]++;
    }

    return {
      totalActions: entries.length,
      allowedActions,
      deniedActions,
      uniqueAgents: uniqueAgents.size,
      uniqueResources: uniqueResources.size,
      actionCounts,
      outcomeByAgent,
    };
  }
}
