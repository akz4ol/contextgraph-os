/**
 * SDK Types
 *
 * Configuration and options for the ContextGraph SDK.
 */

import type { Timestamp, EntityId, Scope, Jurisdiction, Confidence } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';

/**
 * SDK Configuration
 */
export interface ContextGraphConfig {
  /** Storage backend (defaults to in-memory) */
  readonly storage?: StorageInterface;
  /** Default scope for operations */
  readonly defaultScope?: Scope;
  /** Default jurisdiction for operations */
  readonly defaultJurisdiction?: Jurisdiction;
  /** Enable automatic provenance tracking */
  readonly autoProvenance?: boolean;
  /** Enable policy enforcement */
  readonly enablePolicies?: boolean;
  /** Enable capability checking */
  readonly enableCapabilities?: boolean;
}

/**
 * Context options for operations
 */
export interface ContextOptions {
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
  readonly confidence?: Confidence;
  readonly validFrom?: Timestamp;
  readonly validUntil?: Timestamp | null;
}

/**
 * Query options
 */
export interface QueryOptions {
  readonly asOf?: Timestamp;
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
  readonly minConfidence?: number;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Entity creation input
 */
export interface CreateEntityInput {
  readonly type: string;
  readonly name: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly context?: ContextOptions;
}

/**
 * Claim creation input
 */
export interface CreateClaimInput {
  readonly subjectId: EntityId;
  readonly predicate: string;
  readonly value: unknown;
  readonly objectId?: EntityId;
  readonly context?: ContextOptions;
}

/**
 * Agent creation input
 */
export interface CreateAgentInput {
  readonly name: string;
  readonly type?: string;
  readonly description?: string;
  readonly parentAgentId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Action execution input
 */
export interface ExecuteActionInput {
  readonly agentId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly description?: string;
}

/**
 * Policy creation input
 */
export interface CreatePolicyInput {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly effect: 'allow' | 'deny' | 'require_approval';
  readonly subjects: readonly string[];
  readonly actions: readonly string[];
  readonly resources: readonly string[];
  readonly conditions?: readonly PolicyCondition[];
  readonly priority?: number;
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  readonly field: string;
  readonly operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  readonly value: unknown;
}

/**
 * Event types emitted by the SDK
 */
export type EventType =
  | 'entity:created'
  | 'entity:updated'
  | 'claim:added'
  | 'claim:superseded'
  | 'agent:created'
  | 'agent:suspended'
  | 'decision:proposed'
  | 'decision:approved'
  | 'decision:rejected'
  | 'decision:executed'
  | 'execution:started'
  | 'execution:completed'
  | 'execution:failed'
  | 'policy:created'
  | 'policy:activated';

/**
 * Event payload
 */
export interface SDKEvent<T = unknown> {
  readonly type: EventType;
  readonly timestamp: Timestamp;
  readonly data: T;
}

/**
 * Event handler
 */
export type EventHandler<T = unknown> = (event: SDKEvent<T>) => void | Promise<void>;

/**
 * Audit entry
 */
export interface AuditEntry {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly action: string;
  readonly actor: string;
  readonly resource: string;
  readonly outcome: 'success' | 'failure' | 'denied';
  readonly details?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// Import/Export Types
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Export options
 */
export interface ExportOptions {
  /** Include entities in export */
  readonly includeEntities?: boolean;
  /** Include claims in export */
  readonly includeClaims?: boolean;
  /** Include agents in export */
  readonly includeAgents?: boolean;
  /** Include decisions in export */
  readonly includeDecisions?: boolean;
  /** Include policies in export */
  readonly includePolicies?: boolean;
  /** Include provenance in export */
  readonly includeProvenance?: boolean;
  /** Export only data modified since this timestamp */
  readonly since?: Timestamp;
  /** Pretty print JSON output */
  readonly prettyPrint?: boolean;
}

/**
 * Full JSON export format
 */
export interface GraphExport {
  readonly version: string;
  readonly exportedAt: Timestamp;
  readonly entities: readonly EntityExport[];
  readonly claims: readonly ClaimExport[];
  readonly agents: readonly AgentExport[];
  readonly decisions: readonly DecisionExport[];
  readonly policies: readonly PolicyExport[];
  readonly provenance: readonly ProvenanceExport[];
}

/**
 * Entity export format
 */
export interface EntityExport {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly aliases?: readonly string[];
  readonly createdAt: Timestamp;
}

/**
 * Claim export format
 */
export interface ClaimExport {
  readonly id: string;
  readonly subjectId: string;
  readonly predicate: string;
  readonly value: unknown;
  readonly objectId?: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly provenanceId: string;
  readonly createdAt: Timestamp;
}

/**
 * Agent export format
 */
export interface AgentExport {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly description?: string;
  readonly parentAgentId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
}

/**
 * Decision export format
 */
export interface DecisionExport {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly proposedBy: string;
  readonly riskLevel?: string;
  readonly createdAt: Timestamp;
}

/**
 * Policy export format
 */
export interface PolicyExport {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly effect: string;
  readonly subjects: readonly string[];
  readonly actions: readonly string[];
  readonly resources: readonly string[];
  readonly conditions?: readonly PolicyCondition[];
  readonly priority: number;
  readonly status: string;
  readonly createdAt: Timestamp;
}

/**
 * Provenance export format
 */
export interface ProvenanceExport {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly action: string;
  readonly timestamp: Timestamp;
  readonly hash: string;
  readonly previousHash?: string;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Skip validation (not recommended) */
  readonly skipValidation?: boolean;
  /** Merge with existing data instead of replacing */
  readonly merge?: boolean;
  /** Dry run - validate without importing */
  readonly dryRun?: boolean;
  /** On conflict: 'skip' | 'overwrite' | 'error' */
  readonly onConflict?: 'skip' | 'overwrite' | 'error';
}

/**
 * Import result
 */
export interface ImportResult {
  readonly success: boolean;
  readonly entitiesImported: number;
  readonly claimsImported: number;
  readonly agentsImported: number;
  readonly decisionsImported: number;
  readonly policiesImported: number;
  readonly skipped: number;
  readonly errors: readonly string[];
}

/**
 * CSV row for entity export
 */
export interface EntityCSVRow {
  id: string;
  type: string;
  name: string;
  description: string;
  properties: string;
  createdAt: string;
}

/**
 * CSV row for claim export
 */
export interface ClaimCSVRow {
  id: string;
  subjectId: string;
  predicate: string;
  value: string;
  objectId: string;
  provenanceId: string;
  createdAt: string;
}
