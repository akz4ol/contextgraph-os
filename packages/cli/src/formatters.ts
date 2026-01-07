/**
 * CLI Formatters
 *
 * Format ContextGraph data for display in CLI.
 */

import type { Entity, Claim } from '@contextgraph/sdk';
import type { Decision } from '@contextgraph/sdk';
import type { Policy } from '@contextgraph/sdk';
import type { Agent } from '@contextgraph/sdk';
import type { ProvenanceEntry } from '@contextgraph/sdk';
import type { AuditEntry } from '@contextgraph/sdk';

/**
 * Format options
 */
export interface FormatOptions {
  readonly colors?: boolean;
  readonly verbose?: boolean;
  readonly maxWidth?: number;
}

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Apply color if enabled
 */
function color(text: string, colorCode: string, options?: FormatOptions): string {
  if (options?.colors === false) return text;
  return `${colorCode}${text}${colors.reset}`;
}

/**
 * Format a timestamp
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Format an entity
 */
export function formatEntity(entity: Entity, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color(`Entity: ${entity.data.name ?? entity.data.id}`, colors.bold + colors.cyan, options));
  lines.push(`  ID: ${entity.data.id}`);
  lines.push(`  Type: ${color(entity.data.type, colors.yellow, options)}`);

  const aliases = entity.data.aliases;
  if (aliases !== undefined && aliases.length > 0) {
    lines.push(`  Aliases: ${aliases.join(', ')}`);
  }

  if (Object.keys(entity.data.properties).length > 0) {
    lines.push('  Properties:');
    for (const [key, value] of Object.entries(entity.data.properties)) {
      lines.push(`    ${key}: ${JSON.stringify(value)}`);
    }
  }

  lines.push(`  Created: ${formatTimestamp(entity.data.createdAt)}`);

  return lines.join('\n');
}

/**
 * Format a list of entities as a table
 */
export function formatEntityTable(entities: readonly Entity[], options?: FormatOptions): string {
  if (entities.length === 0) {
    return color('No entities found.', colors.dim, options);
  }

  const lines: string[] = [];
  const header = `${'ID'.padEnd(40)} ${'Type'.padEnd(20)} ${'Name'.padEnd(30)}`;
  lines.push(color(header, colors.bold, options));
  lines.push('-'.repeat(header.length));

  for (const entity of entities) {
    const id = entity.data.id.slice(0, 38).padEnd(40);
    const type = entity.data.type.slice(0, 18).padEnd(20);
    const name = (entity.data.name ?? '-').slice(0, 28).padEnd(30);
    lines.push(`${id} ${type} ${name}`);
  }

  lines.push('');
  lines.push(color(`Total: ${entities.length} entities`, colors.dim, options));

  return lines.join('\n');
}

/**
 * Format a claim
 */
export function formatClaim(claim: Claim, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color(`Claim: ${claim.data.id}`, colors.bold + colors.green, options));
  lines.push(`  Subject: ${claim.data.subjectId}`);
  lines.push(`  Predicate: ${color(claim.data.predicate, colors.yellow, options)}`);

  if (claim.data.objectId !== undefined) {
    lines.push(`  Object: ${claim.data.objectId}`);
  }
  if (claim.data.objectValue !== undefined) {
    lines.push(`  Value: ${JSON.stringify(claim.data.objectValue)}`);
  }

  if (claim.data.context.confidence !== undefined) {
    lines.push(`  Confidence: ${(claim.data.context.confidence * 100).toFixed(1)}%`);
  }

  lines.push(`  Provenance: ${claim.data.provenanceId}`);
  lines.push(`  Created: ${formatTimestamp(claim.data.createdAt)}`);

  return lines.join('\n');
}

/**
 * Format a list of claims as a table
 */
export function formatClaimTable(claims: readonly Claim[], options?: FormatOptions): string {
  if (claims.length === 0) {
    return color('No claims found.', colors.dim, options);
  }

  const lines: string[] = [];
  const header = `${'Predicate'.padEnd(25)} ${'Value'.padEnd(30)} ${'Confidence'.padEnd(12)}`;
  lines.push(color(header, colors.bold, options));
  lines.push('-'.repeat(header.length));

  for (const claim of claims) {
    const predicate = claim.data.predicate.slice(0, 23).padEnd(25);
    const value = String(claim.data.objectValue ?? claim.data.objectId ?? '-').slice(0, 28).padEnd(30);
    const confidence = claim.data.context.confidence !== undefined
      ? `${(claim.data.context.confidence * 100).toFixed(0)}%`.padEnd(12)
      : '-'.padEnd(12);
    lines.push(`${predicate} ${value} ${confidence}`);
  }

  lines.push('');
  lines.push(color(`Total: ${claims.length} claims`, colors.dim, options));

  return lines.join('\n');
}

/**
 * Format an agent
 */
export function formatAgent(agent: Agent, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color(`Agent: ${agent.data.name}`, colors.bold + colors.magenta, options));
  lines.push(`  ID: ${agent.data.id}`);
  lines.push(`  Status: ${formatStatus(agent.data.status, options)}`);

  if (agent.data.description !== undefined) {
    lines.push(`  Description: ${agent.data.description}`);
  }

  if (agent.data.parentAgentId !== undefined) {
    lines.push(`  Parent: ${agent.data.parentAgentId}`);
  }

  lines.push(`  Capabilities: ${agent.data.capabilities.length}`);
  lines.push(`  Created: ${formatTimestamp(agent.data.createdAt)}`);

  return lines.join('\n');
}

/**
 * Format a decision
 */
export function formatDecision(decision: Decision, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color(`Decision: ${decision.data.title}`, colors.bold + colors.blue, options));
  lines.push(`  ID: ${decision.data.id}`);
  lines.push(`  Type: ${decision.data.type}`);
  lines.push(`  Status: ${formatStatus(decision.data.status, options)}`);
  lines.push(`  Risk Level: ${formatRiskLevel(decision.data.riskLevel, options)}`);
  lines.push(`  Proposed By: ${decision.data.proposedBy}`);

  if (decision.data.description !== undefined) {
    lines.push(`  Description: ${decision.data.description}`);
  }

  lines.push(`  Created: ${formatTimestamp(decision.data.createdAt)}`);

  return lines.join('\n');
}

/**
 * Format a policy
 */
export function formatPolicy(policy: Policy, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color(`Policy: ${policy.data.name}`, colors.bold + colors.yellow, options));
  lines.push(`  ID: ${policy.data.id}`);
  lines.push(`  Version: ${policy.data.version}`);
  lines.push(`  Status: ${formatStatus(policy.data.status, options)}`);
  lines.push(`  Priority: ${policy.data.priority}`);

  if (policy.data.description !== undefined) {
    lines.push(`  Description: ${policy.data.description}`);
  }

  lines.push(`  Rules: ${policy.data.rules.length}`);
  lines.push(`  Created: ${formatTimestamp(policy.data.createdAt)}`);

  return lines.join('\n');
}

/**
 * Format a provenance entry
 */
export function formatProvenance(entry: ProvenanceEntry, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color(`Provenance: ${entry.data.id}`, colors.bold + colors.cyan, options));
  lines.push(`  Source: ${entry.data.sourceType}${entry.data.sourceId ? ` (${entry.data.sourceId})` : ''}`);
  lines.push(`  Action: ${entry.data.action}`);

  if (entry.data.actor !== undefined) {
    lines.push(`  Actor: ${entry.data.actor}`);
  }

  lines.push(`  Timestamp: ${formatTimestamp(entry.data.timestamp)}`);
  lines.push(`  Hash: ${entry.data.hash.slice(0, 16)}...`);

  if (entry.data.previousHash !== undefined) {
    lines.push(`  Previous: ${entry.data.previousHash.slice(0, 16)}...`);
  }

  return lines.join('\n');
}

/**
 * Format an audit entry
 */
export function formatAuditEntry(entry: AuditEntry, options?: FormatOptions): string {
  const outcome = entry.outcome === 'success'
    ? color('SUCCESS', colors.green, options)
    : entry.outcome === 'denied'
      ? color('DENIED', colors.yellow, options)
      : color('FAILURE', colors.red, options);

  const time = formatTimestamp(entry.timestamp).slice(11, 19);
  return `[${time}] ${entry.action.padEnd(12)} ${entry.resource.slice(0, 30).padEnd(32)} ${outcome}`;
}

/**
 * Format audit trail
 */
export function formatAuditTrail(entries: readonly AuditEntry[], options?: FormatOptions): string {
  if (entries.length === 0) {
    return color('No audit entries found.', colors.dim, options);
  }

  const lines: string[] = [];
  lines.push(color('Audit Trail:', colors.bold, options));
  lines.push('-'.repeat(70));

  for (const entry of entries) {
    lines.push(formatAuditEntry(entry, options));
  }

  lines.push('');
  lines.push(color(`Total: ${entries.length} entries`, colors.dim, options));

  return lines.join('\n');
}

/**
 * Format a status with color
 */
function formatStatus(status: string, options?: FormatOptions): string {
  const statusColors: Record<string, string> = {
    active: colors.green,
    proposed: colors.yellow,
    approved: colors.green,
    rejected: colors.red,
    executed: colors.blue,
    failed: colors.red,
    suspended: colors.yellow,
    draft: colors.dim,
    deprecated: colors.dim,
  };

  const statusColor = statusColors[status] ?? colors.white;
  return color(status.toUpperCase(), statusColor, options);
}

/**
 * Format risk level with color
 */
function formatRiskLevel(level: string, options?: FormatOptions): string {
  const levelColors: Record<string, string> = {
    low: colors.green,
    medium: colors.yellow,
    high: colors.red,
    critical: colors.bold + colors.red,
  };

  const levelColor = levelColors[level] ?? colors.white;
  return color(level.toUpperCase(), levelColor, options);
}

/**
 * Format statistics
 */
export function formatStats(stats: {
  entities: number;
  claims: number;
  agents: number;
  decisions: number;
  policies: number;
}, options?: FormatOptions): string {
  const lines: string[] = [];

  lines.push(color('System Statistics:', colors.bold, options));
  lines.push('-'.repeat(30));
  lines.push(`  Entities:  ${String(stats.entities).padStart(6)}`);
  lines.push(`  Claims:    ${String(stats.claims).padStart(6)}`);
  lines.push(`  Agents:    ${String(stats.agents).padStart(6)}`);
  lines.push(`  Decisions: ${String(stats.decisions).padStart(6)}`);
  lines.push(`  Policies:  ${String(stats.policies).padStart(6)}`);

  return lines.join('\n');
}

/**
 * Format JSON with optional pretty printing
 */
export function formatJSON(data: unknown, pretty: boolean = true): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Format a Result type
 */
export function formatResult<T>(
  result: { ok: true; value: T } | { ok: false; error: Error },
  formatter: (value: T) => string,
  options?: FormatOptions
): string {
  if (result.ok) {
    return formatter(result.value);
  }
  return color(`Error: ${result.error.message}`, colors.red, options);
}
