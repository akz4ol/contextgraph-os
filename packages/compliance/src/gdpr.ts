/**
 * GDPR Compliance Features
 *
 * Implements GDPR data subject rights: access, portability, erasure.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  GDPROptions,
  PersonalDataReport,
  PersonalDataEntity,
  PersonalDataClaim,
  PersonalDataDecision,
  AuditEntry,
  DeletionResult,
  ExportResult,
  ReportMetadata,
} from './types.js';
import { formatAsJSON, formatAsCSV } from './formatters.js';

/**
 * Entity record from storage
 */
interface EntityRecord {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly properties?: string;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Claim record from storage
 */
interface ClaimRecord {
  readonly id: string;
  readonly subjectId: string;
  readonly predicate: string;
  readonly value: string;
  readonly createdAt: Timestamp;
  readonly revokedAt?: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * Decision record from storage
 */
interface DecisionRecord {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly status: string;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

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
  readonly createdAt: Timestamp;
  readonly [key: string]: unknown;
}

/**
 * GDPR Compliance Manager
 */
export class GDPRComplianceManager {
  private readonly storage: StorageInterface;

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Find all personal data for a subject (Right of Access)
   */
  async findPersonalData(options: GDPROptions): Promise<Result<PersonalDataReport, Error>> {
    const now = createTimestamp();
    const reportId = `gdpr_access_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const { subjectId, includeRelated = true } = options;

    // Find entities created by or related to the subject
    const entitiesResult = await this.findEntities(subjectId, includeRelated);
    if (!entitiesResult.ok) {
      return err(entitiesResult.error);
    }

    // Find claims about the subject
    const claimsResult = await this.findClaims(subjectId);
    if (!claimsResult.ok) {
      return err(claimsResult.error);
    }

    // Find decisions proposed by or involving the subject
    const decisionsResult = await this.findDecisions(subjectId);
    if (!decisionsResult.ok) {
      return err(decisionsResult.error);
    }

    // Find audit trail entries for the subject
    const auditResult = await this.findAuditEntries(subjectId);
    if (!auditResult.ok) {
      return err(auditResult.error);
    }

    const metadata: ReportMetadata = {
      reportId,
      reportType: 'gdpr_personal_data',
      generatedAt: now,
      generatedBy: 'gdpr_compliance',
      options: options as unknown as Record<string, unknown>,
      totalRecords:
        entitiesResult.value.length +
        claimsResult.value.length +
        decisionsResult.value.length +
        auditResult.value.length,
      format: 'json',
    };

    return ok({
      metadata,
      subjectId,
      entities: entitiesResult.value,
      claims: claimsResult.value,
      decisions: decisionsResult.value,
      auditTrail: auditResult.value,
    });
  }

  /**
   * Export personal data in portable format (Right to Data Portability)
   */
  async exportPersonalData(
    options: GDPROptions,
    format: 'json' | 'csv' = 'json'
  ): Promise<Result<ExportResult, Error>> {
    const now = createTimestamp();

    // Get all personal data
    const dataResult = await this.findPersonalData(options);
    if (!dataResult.ok) {
      return err(dataResult.error);
    }

    const data = dataResult.value;
    let exportData: string;

    if (format === 'json') {
      exportData = formatAsJSON(data);
    } else {
      // For CSV, we export each category separately
      const sections: string[] = [];

      if (data.entities.length > 0) {
        sections.push('# Entities');
        sections.push(formatAsCSV(this.entitiesToRecords(data.entities)));
      }
      if (data.claims.length > 0) {
        sections.push('# Claims');
        sections.push(formatAsCSV(this.claimsToRecords(data.claims)));
      }
      if (data.decisions.length > 0) {
        sections.push('# Decisions');
        sections.push(formatAsCSV(this.decisionsToRecords(data.decisions)));
      }
      if (data.auditTrail.length > 0) {
        sections.push('# Audit Trail');
        sections.push(formatAsCSV(this.auditToRecords(data.auditTrail)));
      }

      exportData = sections.join('\n\n');
    }

    // Simple checksum (in production, use crypto hash)
    const checksum = this.simpleChecksum(exportData);

    return ok({
      subjectId: options.subjectId,
      exportedAt: now,
      format,
      data: exportData,
      checksum,
    });
  }

  /**
   * Delete personal data (Right to Erasure / Right to be Forgotten)
   * Note: This anonymizes data rather than fully deleting to preserve audit integrity
   */
  async deletePersonalData(options: GDPROptions): Promise<Result<DeletionResult, Error>> {
    const now = createTimestamp();
    const { subjectId, anonymize = true } = options;
    const errors: string[] = [];

    let entitiesDeleted = 0;
    let claimsDeleted = 0;
    let decisionsAnonymized = 0;
    let auditEntriesAnonymized = 0;

    // Get all personal data first
    const dataResult = await this.findPersonalData(options);
    if (!dataResult.ok) {
      return err(dataResult.error);
    }

    const data = dataResult.value;

    // Anonymize or delete entities
    for (const entity of data.entities) {
      if (anonymize) {
        const anonymizedRecord: EntityRecord = {
          id: entity.id,
          type: entity.type,
          name: '[REDACTED]',
          properties: JSON.stringify({ anonymized: true, originalId: subjectId }),
          createdAt: entity.createdAt,
        };

        const result = await this.storage.upsert('entities', anonymizedRecord);
        if (result.ok) {
          entitiesDeleted++;
        } else {
          errors.push(`Failed to anonymize entity ${entity.id}: ${result.error.message}`);
        }
      }
    }

    // Anonymize claims
    for (const claim of data.claims) {
      if (anonymize) {
        const anonymizedRecord: ClaimRecord = {
          id: claim.id,
          subjectId: '[REDACTED]',
          predicate: claim.predicate,
          value: JSON.stringify('[REDACTED]'),
          createdAt: claim.createdAt,
          revokedAt: now,
        };

        const result = await this.storage.upsert('claims', anonymizedRecord);
        if (result.ok) {
          claimsDeleted++;
        } else {
          errors.push(`Failed to anonymize claim ${claim.id}: ${result.error.message}`);
        }
      }
    }

    // Anonymize decisions (preserve structure for audit)
    for (const decision of data.decisions) {
      if (anonymize) {
        const anonymizedRecord: DecisionRecord = {
          id: decision.id,
          type: decision.type,
          title: '[REDACTED]',
          status: decision.status,
          proposedBy: '[REDACTED]',
          proposedAt: decision.proposedAt,
          createdAt: decision.proposedAt,
        };

        const result = await this.storage.upsert('decisions', anonymizedRecord);
        if (result.ok) {
          decisionsAnonymized++;
        } else {
          errors.push(`Failed to anonymize decision ${decision.id}: ${result.error.message}`);
        }
      }
    }

    // Anonymize audit entries
    for (const entry of data.auditTrail) {
      if (anonymize) {
        const anonymizedRecord: AuditRecord = {
          id: entry.id,
          timestamp: entry.timestamp,
          agentId: '[REDACTED]',
          action: entry.action,
          resourceType: entry.resourceType,
          outcome: entry.outcome,
          createdAt: entry.timestamp,
        };

        const result = await this.storage.upsert('audit_trail', anonymizedRecord);
        if (result.ok) {
          auditEntriesAnonymized++;
        } else {
          errors.push(`Failed to anonymize audit entry ${entry.id}: ${result.error.message}`);
        }
      }
    }

    return ok({
      subjectId,
      deletedAt: now,
      entitiesDeleted,
      claimsDeleted,
      decisionsAnonymized,
      auditEntriesAnonymized,
      errors,
    });
  }

  /**
   * Find entities for a subject
   */
  private async findEntities(
    subjectId: string,
    includeRelated: boolean
  ): Promise<Result<PersonalDataEntity[], Error>> {
    const entities: PersonalDataEntity[] = [];

    // Find entity with matching ID
    const directResult = await this.storage.findById<EntityRecord>('entities', subjectId);
    if (directResult.ok && directResult.value !== null) {
      const record = directResult.value;
      entities.push({
        id: record.id,
        type: record.type,
        name: record.name,
        properties: record.properties !== undefined ? JSON.parse(record.properties) : {},
        createdAt: record.createdAt,
      });
    }

    // If including related, search for entities by name pattern
    if (includeRelated) {
      const relatedResult = await this.storage.find<EntityRecord>(
        'entities',
        {},
        { limit: 100 }
      );

      if (relatedResult.ok) {
        for (const record of relatedResult.value.items) {
          // Check if entity references the subject in properties
          if (record.properties !== undefined) {
            const props = JSON.parse(record.properties);
            if (JSON.stringify(props).includes(subjectId)) {
              if (!entities.some((e) => e.id === record.id)) {
                entities.push({
                  id: record.id,
                  type: record.type,
                  name: record.name,
                  properties: props,
                  createdAt: record.createdAt,
                });
              }
            }
          }
        }
      }
    }

    return ok(entities);
  }

  /**
   * Find claims for a subject
   */
  private async findClaims(subjectId: string): Promise<Result<PersonalDataClaim[], Error>> {
    const result = await this.storage.find<ClaimRecord>(
      'claims',
      { subjectId },
      { limit: 1000 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const claims: PersonalDataClaim[] = result.value.items.map((record) => {
      const claim: PersonalDataClaim = {
        id: record.id,
        subjectId: record.subjectId,
        predicate: record.predicate,
        value: this.parseValue(record.value),
        createdAt: record.createdAt,
      };
      if (record.revokedAt !== undefined) {
        (claim as { revokedAt?: Timestamp }).revokedAt = record.revokedAt;
      }
      return claim;
    });

    return ok(claims);
  }

  /**
   * Find decisions for a subject
   */
  private async findDecisions(subjectId: string): Promise<Result<PersonalDataDecision[], Error>> {
    const result = await this.storage.find<DecisionRecord>(
      'decisions',
      { proposedBy: subjectId },
      { limit: 1000 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const decisions: PersonalDataDecision[] = result.value.items.map((record) => ({
      id: record.id,
      type: record.type,
      title: record.title,
      status: record.status,
      proposedBy: record.proposedBy,
      proposedAt: record.proposedAt,
    }));

    return ok(decisions);
  }

  /**
   * Find audit entries for a subject
   */
  private async findAuditEntries(subjectId: string): Promise<Result<AuditEntry[], Error>> {
    const result = await this.storage.find<AuditRecord>(
      'audit_trail',
      { agentId: subjectId },
      { limit: 1000 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const entries: AuditEntry[] = result.value.items.map((record) => {
      const entry: AuditEntry = {
        id: record.id,
        timestamp: record.timestamp,
        agentId: record.agentId,
        action: record.action,
        resourceType: record.resourceType,
        outcome: record.outcome,
      };
      if (record.resourceId !== undefined) {
        (entry as { resourceId?: string }).resourceId = record.resourceId;
      }
      if (record.reason !== undefined) {
        (entry as { reason?: string }).reason = record.reason;
      }
      return entry;
    });

    return ok(entries);
  }

  /**
   * Convert entities to plain records for CSV export
   */
  private entitiesToRecords(entities: readonly PersonalDataEntity[]): Record<string, unknown>[] {
    return entities.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      properties: JSON.stringify(e.properties),
      createdAt: e.createdAt,
    }));
  }

  /**
   * Convert claims to plain records for CSV export
   */
  private claimsToRecords(claims: readonly PersonalDataClaim[]): Record<string, unknown>[] {
    return claims.map((c) => ({
      id: c.id,
      subjectId: c.subjectId,
      predicate: c.predicate,
      value: typeof c.value === 'string' ? c.value : JSON.stringify(c.value),
      createdAt: c.createdAt,
      revokedAt: c.revokedAt ?? '',
    }));
  }

  /**
   * Convert decisions to plain records for CSV export
   */
  private decisionsToRecords(decisions: readonly PersonalDataDecision[]): Record<string, unknown>[] {
    return decisions.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      status: d.status,
      proposedBy: d.proposedBy,
      proposedAt: d.proposedAt,
    }));
  }

  /**
   * Convert audit entries to plain records for CSV export
   */
  private auditToRecords(entries: readonly AuditEntry[]): Record<string, unknown>[] {
    return entries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      agentId: e.agentId,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId ?? '',
      outcome: e.outcome,
      reason: e.reason ?? '',
    }));
  }

  /**
   * Parse a value from storage
   */
  private parseValue(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Simple checksum for data integrity
   */
  private simpleChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
