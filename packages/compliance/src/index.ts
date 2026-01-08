/**
 * @contextgraph/compliance
 *
 * Compliance reporting and GDPR features for ContextGraph OS.
 */

// Types
export type {
  ReportFormat,
  ReportOptions,
  AuditReportOptions,
  AccessReportOptions,
  DecisionReportOptions,
  ProvenanceReportOptions,
  GDPROptions,
  ReportMetadata,
  AuditEntry,
  AccessEntry,
  DecisionEntry,
  ProvenanceEntry,
  AuditReport,
  AuditSummary,
  AccessReport,
  AccessSummary,
  DecisionReport,
  DecisionSummary,
  ProvenanceReport,
  ProvenanceSummary,
  ChainIntegrity,
  PersonalDataReport,
  PersonalDataEntity,
  PersonalDataClaim,
  PersonalDataDecision,
  DeletionResult,
  ExportResult,
} from './types.js';

// Report Generators
export { AuditReportGenerator } from './audit-report.js';
export { AccessReportGenerator } from './access-report.js';
export { DecisionReportGenerator } from './decision-report.js';
export { ProvenanceReportGenerator } from './provenance-report.js';

// GDPR Compliance
export { GDPRComplianceManager } from './gdpr.js';

// Formatters
export {
  formatAsJSON,
  formatAsCSV,
  formatAuditReportAsCSV,
  formatAccessReportAsCSV,
  formatDecisionReportAsCSV,
  formatProvenanceReportAsCSV,
  formatMetadataAsComment,
  parseCSV,
} from './formatters.js';
