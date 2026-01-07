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
