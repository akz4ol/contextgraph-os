/**
 * Access Report Generator
 *
 * Generates reports on who accessed what resources.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  AccessReportOptions,
  AccessReport,
  AccessEntry,
  AccessSummary,
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
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Agent record from storage
 */
interface AgentRecord {
  readonly id: string;
  readonly name: string;
  readonly type?: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Access Report Generator class
 */
export class AccessReportGenerator {
  private readonly storage: StorageInterface;
  private readonly auditCollection = 'audit_trail';
  private readonly agentCollection = 'agents';

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Generate an access report
   */
  async generate(
    options: AccessReportOptions = {},
    generatedBy: string = 'system'
  ): Promise<Result<AccessReport, Error>> {
    const now = createTimestamp();
    const reportId = `access_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // Build query criteria
    const criteria: Record<string, unknown> = {};
    if (options.subjectId !== undefined) {
      criteria['agentId'] = options.subjectId;
    }
    if (options.resourceType !== undefined) {
      criteria['resourceType'] = options.resourceType;
    }
    if (options.resourceId !== undefined) {
      criteria['resourceId'] = options.resourceId;
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

    // Get agent info for subject types
    const agentInfo = await this.getAgentInfo(records.map((r) => r.agentId));

    // Convert to access entries
    const entries: AccessEntry[] = records.map((record) => {
      const agent = agentInfo.get(record.agentId);
      const entry: AccessEntry = {
        timestamp: record.timestamp,
        subjectId: record.agentId,
        subjectType: this.inferSubjectType(agent),
        action: record.action,
        resourceType: record.resourceType,
        outcome: record.outcome,
        source: 'audit_trail',
      };
      if (record.resourceId !== undefined) {
        (entry as { resourceId?: string }).resourceId = record.resourceId;
      }
      return entry;
    });

    // Generate summary
    const summary = this.generateSummary(entries);

    // Build metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'access',
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
   * Get agent info for a list of agent IDs
   */
  private async getAgentInfo(agentIds: readonly string[]): Promise<Map<string, AgentRecord>> {
    const info = new Map<string, AgentRecord>();
    const uniqueIds = [...new Set(agentIds)];

    for (const id of uniqueIds) {
      const result = await this.storage.findById<AgentRecord>(this.agentCollection, id);
      if (result.ok && result.value !== null) {
        info.set(id, result.value);
      }
    }

    return info;
  }

  /**
   * Infer subject type from agent record
   */
  private inferSubjectType(agent?: AgentRecord): 'user' | 'agent' | 'service' {
    if (agent === undefined) {
      return 'agent';
    }
    if (agent.type === 'service') {
      return 'service';
    }
    if (agent.name.startsWith('user_') || agent.type === 'user') {
      return 'user';
    }
    return 'agent';
  }

  /**
   * Generate access summary from entries
   */
  private generateSummary(entries: readonly AccessEntry[]): AccessSummary {
    const accessBySubject: Record<string, number> = {};
    const accessByResource: Record<string, number> = {};
    const accessByAction: Record<string, number> = {};
    const uniqueSubjects = new Set<string>();
    const uniqueResources = new Set<string>();

    for (const entry of entries) {
      // Count by subject
      accessBySubject[entry.subjectId] = (accessBySubject[entry.subjectId] ?? 0) + 1;
      uniqueSubjects.add(entry.subjectId);

      // Count by resource
      const resourceKey = entry.resourceId !== undefined
        ? `${entry.resourceType}/${entry.resourceId}`
        : entry.resourceType;
      accessByResource[resourceKey] = (accessByResource[resourceKey] ?? 0) + 1;
      uniqueResources.add(resourceKey);

      // Count by action
      accessByAction[entry.action] = (accessByAction[entry.action] ?? 0) + 1;
    }

    return {
      totalAccesses: entries.length,
      uniqueSubjects: uniqueSubjects.size,
      uniqueResources: uniqueResources.size,
      accessBySubject,
      accessByResource,
      accessByAction,
    };
  }
}
