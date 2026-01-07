/**
 * @contextgraph/sdk
 *
 * Unified high-level API for ContextGraph OS.
 */

export { ContextGraph } from './client.js';

export type {
  ContextGraphConfig,
  ContextOptions,
  QueryOptions,
  CreateEntityInput,
  CreateClaimInput,
  CreateAgentInput,
  ExecuteActionInput,
  CreatePolicyInput,
  PolicyCondition,
  EventType,
  SDKEvent,
  EventHandler,
  AuditEntry,
} from './types.js';

// Re-export commonly used types from core packages
export type { Result, EntityId, Timestamp, Scope, Jurisdiction, Confidence } from '@contextgraph/core';
export type { Entity, Claim } from '@contextgraph/ckg';
export type { Agent } from '@contextgraph/agent';
export type { Decision } from '@contextgraph/dtg';
export type { Policy } from '@contextgraph/policy';
export type { ProvenanceEntry, ChainVerificationResult } from '@contextgraph/provenance';
export type { ExecutionResult, ActionHandler } from '@contextgraph/execution';
export type { AssembledContext } from '@contextgraph/retrieval';
export type { StorageInterface } from '@contextgraph/storage';

// Re-export useful factories from core
export {
  createTimestamp,
  createScope,
  createJurisdiction,
  createConfidence,
  ok,
  err,
} from '@contextgraph/core';
