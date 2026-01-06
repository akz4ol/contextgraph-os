/**
 * Agent Types
 *
 * Types for agent policy and problem-space modeling.
 */

import type { Timestamp, EntityId, Scope, Jurisdiction } from '@contextgraph/core';

/**
 * Branded type for Agent IDs
 */
export type AgentId = string & { readonly __brand: 'AgentId' };

/**
 * Branded type for Capability IDs
 */
export type CapabilityId = string & { readonly __brand: 'CapabilityId' };

/**
 * Branded type for Problem Space IDs
 */
export type ProblemSpaceId = string & { readonly __brand: 'ProblemSpaceId' };

/**
 * Agent status
 */
export type AgentStatus = 'active' | 'suspended' | 'revoked';

/**
 * Capability category
 */
export type CapabilityCategory =
  | 'read'
  | 'write'
  | 'execute'
  | 'communicate'
  | 'delegate'
  | 'admin';

/**
 * Resource constraint type
 */
export type ResourceConstraintType =
  | 'max_tokens'
  | 'max_requests'
  | 'max_time'
  | 'max_cost'
  | 'rate_limit';

/**
 * Resource constraint
 */
export interface ResourceConstraint {
  readonly type: ResourceConstraintType;
  readonly value: number;
  readonly period?: 'minute' | 'hour' | 'day';
}

/**
 * Capability definition
 */
export interface Capability {
  readonly id: CapabilityId;
  readonly name: string;
  readonly description?: string;
  readonly category: CapabilityCategory;
  readonly actions: readonly string[];
  readonly resourceTypes: readonly string[];
  readonly constraints?: readonly ResourceConstraint[];
}

/**
 * Agent capability assignment
 */
export interface AgentCapability {
  readonly capabilityId: CapabilityId;
  readonly grantedAt: Timestamp;
  readonly grantedBy: EntityId;
  readonly expiresAt?: Timestamp;
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
}

/**
 * Problem space node type
 */
export type ProblemSpaceNodeType =
  | 'domain'
  | 'task'
  | 'subtask'
  | 'goal'
  | 'constraint';

/**
 * Problem space node
 */
export interface ProblemSpaceNode {
  readonly id: string;
  readonly type: ProblemSpaceNodeType;
  readonly name: string;
  readonly description?: string;
  readonly parentId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Problem space definition
 */
export interface ProblemSpace {
  readonly id: ProblemSpaceId;
  readonly name: string;
  readonly description?: string;
  readonly nodes: readonly ProblemSpaceNode[];
  readonly rootNodeIds: readonly string[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Agent-problem space binding
 */
export interface AgentProblemSpaceBinding {
  readonly problemSpaceId: ProblemSpaceId;
  readonly allowedNodeIds: readonly string[];
  readonly deniedNodeIds: readonly string[];
  readonly boundAt: Timestamp;
}

/**
 * Agent data
 */
export interface AgentData {
  readonly id: AgentId;
  readonly name: string;
  readonly description?: string;
  readonly status: AgentStatus;
  readonly capabilities: readonly AgentCapability[];
  readonly problemSpaceBindings: readonly AgentProblemSpaceBinding[];
  readonly policyIds: readonly string[];
  readonly parentAgentId?: AgentId;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Agent record (for storage)
 */
export interface AgentRecord {
  readonly [key: string]: string | number | null | Timestamp;
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly capabilities: string;
  readonly problemSpaceBindings: string;
  readonly policyIds: string;
  readonly parentAgentId: string | null;
  readonly metadata: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Create agent input
 */
export interface CreateAgentInput {
  readonly name: string;
  readonly description?: string;
  readonly parentAgentId?: AgentId;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Grant capability input
 */
export interface GrantCapabilityInput {
  readonly capabilityId: CapabilityId;
  readonly grantedBy: EntityId;
  readonly expiresAt?: Timestamp;
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
}

/**
 * Capability check context
 */
export interface CapabilityCheckContext {
  readonly action: string;
  readonly resourceType: string;
  readonly scope?: Scope;
  readonly jurisdiction?: Jurisdiction;
}

/**
 * Capability check result
 */
export interface CapabilityCheckResult {
  readonly allowed: boolean;
  readonly matchedCapability?: AgentCapability;
  readonly reason?: string;
  readonly constraints?: readonly ResourceConstraint[];
}

/**
 * Create problem space input
 */
export interface CreateProblemSpaceInput {
  readonly name: string;
  readonly description?: string;
  readonly nodes?: readonly ProblemSpaceNode[];
  readonly rootNodeIds?: readonly string[];
}

/**
 * Capability registry entry
 */
export interface CapabilityRegistryEntry {
  readonly capability: Capability;
  readonly registeredAt: Timestamp;
}
