/**
 * @contextgraph/cli
 *
 * CLI and inspection tools for ContextGraph OS.
 */

export { GraphInspector, type InspectorConfig, type InspectorResult } from './inspector.js';
export { ContextGraphRepl, type ReplCommand, type ReplConfig } from './repl.js';
export {
  formatEntity,
  formatEntityTable,
  formatClaim,
  formatClaimTable,
  formatAgent,
  formatDecision,
  formatPolicy,
  formatProvenance,
  formatAuditEntry,
  formatAuditTrail,
  formatStats,
  formatJSON,
  formatTimestamp,
  formatResult,
  type FormatOptions,
} from './formatters.js';
