/**
 * Compliance Report Types
 *
 * Type definitions for compliance reporting and GDPR features.
 */

import type { Timestamp } from '@contextgraph/core';

/**
 * Report format options
 */
export type ReportFormat = 'json' | 'csv';

/**
 * Base report options
 */
export interface ReportOptions {
  readonly startTime?: Timestamp;
  readonly endTime?: Timestamp;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Audit report options
 */
export interface AuditReportOptions extends ReportOptions {
  readonly agentId?: string;
  readonly action?: string;
  readonly resourceType?: string;
  readonly outcome?: 'allowed' | 'denied';
}

/**
 * Access report options
 */
export interface AccessReportOptions extends ReportOptions {
  readonly subjectId?: string;
  readonly resourceId?: string;
  readonly resourceType?: string;
}

/**
 * Decision report options
 */
export interface DecisionReportOptions extends ReportOptions {
  readonly status?: 'proposed' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  readonly proposedBy?: string;
  readonly approvedBy?: string;
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Provenance report options
 */
export interface ProvenanceReportOptions extends ReportOptions {
  readonly sourceType?: string;
  readonly entityId?: string;
}

/**
 * GDPR data subject request options
 */
export interface GDPROptions {
  readonly subjectId: string;
  readonly includeRelated?: boolean;
  readonly anonymize?: boolean;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  readonly reportId: string;
  readonly reportType: string;
  readonly generatedAt: Timestamp;
  readonly generatedBy: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly totalRecords: number;
  readonly format: ReportFormat;
}

/**
 * Audit entry in report
 */
export interface AuditEntry {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly agentId: string;
  readonly agentName?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: 'allowed' | 'denied';
  readonly reason?: string;
  readonly duration?: number;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

/**
 * Access entry in report
 */
export interface AccessEntry {
  readonly timestamp: Timestamp;
  readonly subjectId: string;
  readonly subjectType: 'user' | 'agent' | 'service';
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: 'allowed' | 'denied';
  readonly source: string;
}

/**
 * Decision entry in report
 */
export interface DecisionEntry {
  readonly id: string;
  readonly type: string;
  readonly title: string;
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
}

/**
 * Provenance entry in report
 */
export interface ProvenanceEntry {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly action: string;
  readonly entityId?: string;
  readonly claimId?: string;
  readonly previousHash?: string;
  readonly hash: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Audit report
 */
export interface AuditReport {
  readonly metadata: ReportMetadata;
  readonly entries: readonly AuditEntry[];
  readonly summary: AuditSummary;
}

/**
 * Audit summary
 */
export interface AuditSummary {
  readonly totalActions: number;
  readonly allowedActions: number;
  readonly deniedActions: number;
  readonly uniqueAgents: number;
  readonly uniqueResources: number;
  readonly actionCounts: Readonly<Record<string, number>>;
  readonly outcomeByAgent: Readonly<Record<string, { allowed: number; denied: number }>>;
}

/**
 * Access report
 */
export interface AccessReport {
  readonly metadata: ReportMetadata;
  readonly entries: readonly AccessEntry[];
  readonly summary: AccessSummary;
}

/**
 * Access summary
 */
export interface AccessSummary {
  readonly totalAccesses: number;
  readonly uniqueSubjects: number;
  readonly uniqueResources: number;
  readonly accessBySubject: Readonly<Record<string, number>>;
  readonly accessByResource: Readonly<Record<string, number>>;
  readonly accessByAction: Readonly<Record<string, number>>;
}

/**
 * Decision report
 */
export interface DecisionReport {
  readonly metadata: ReportMetadata;
  readonly entries: readonly DecisionEntry[];
  readonly summary: DecisionSummary;
}

/**
 * Decision summary
 */
export interface DecisionSummary {
  readonly totalDecisions: number;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly byRiskLevel: Readonly<Record<string, number>>;
  readonly byProposer: Readonly<Record<string, number>>;
  readonly averageApprovalTime?: number;
}

/**
 * Provenance report
 */
export interface ProvenanceReport {
  readonly metadata: ReportMetadata;
  readonly entries: readonly ProvenanceEntry[];
  readonly summary: ProvenanceSummary;
  readonly chainIntegrity: ChainIntegrity;
}

/**
 * Provenance summary
 */
export interface ProvenanceSummary {
  readonly totalEntries: number;
  readonly bySourceType: Readonly<Record<string, number>>;
  readonly byAction: Readonly<Record<string, number>>;
  readonly firstEntry?: Timestamp;
  readonly lastEntry?: Timestamp;
}

/**
 * Chain integrity status
 */
export interface ChainIntegrity {
  readonly valid: boolean;
  readonly entriesVerified: number;
  readonly brokenLinks: number;
  readonly invalidHashes: number;
  readonly errors: readonly string[];
}

/**
 * GDPR personal data report
 */
export interface PersonalDataReport {
  readonly metadata: ReportMetadata;
  readonly subjectId: string;
  readonly entities: readonly PersonalDataEntity[];
  readonly claims: readonly PersonalDataClaim[];
  readonly decisions: readonly PersonalDataDecision[];
  readonly auditTrail: readonly AuditEntry[];
}

/**
 * Personal data entity
 */
export interface PersonalDataEntity {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
}

/**
 * Personal data claim
 */
export interface PersonalDataClaim {
  readonly id: string;
  readonly subjectId: string;
  readonly predicate: string;
  readonly value: unknown;
  readonly createdAt: Timestamp;
  readonly revokedAt?: Timestamp;
}

/**
 * Personal data decision
 */
export interface PersonalDataDecision {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly status: string;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
}

/**
 * GDPR deletion result
 */
export interface DeletionResult {
  readonly subjectId: string;
  readonly deletedAt: Timestamp;
  readonly entitiesDeleted: number;
  readonly claimsDeleted: number;
  readonly decisionsAnonymized: number;
  readonly auditEntriesAnonymized: number;
  readonly errors: readonly string[];
}

/**
 * GDPR export result
 */
export interface ExportResult {
  readonly subjectId: string;
  readonly exportedAt: Timestamp;
  readonly format: ReportFormat;
  readonly data: string;
  readonly checksum: string;
}
