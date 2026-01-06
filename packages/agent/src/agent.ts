/**
 * Agent Model
 *
 * Represents an AI agent with capabilities and policy bindings.
 */

import {
  type Result,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type {
  AgentId,
  AgentData,
  AgentRecord,
  AgentStatus,
  AgentCapability,
  AgentProblemSpaceBinding,
  CreateAgentInput,
  GrantCapabilityInput,
  CapabilityCheckContext,
  CapabilityCheckResult,
  ProblemSpaceId,
} from './types.js';
import { CapabilityRegistry } from './capability.js';

/**
 * Generate agent ID
 */
function createAgentId(): AgentId {
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as AgentId;
}

/**
 * Agent class
 *
 * Represents an AI agent with its capabilities and bindings.
 */
export class Agent {
  private constructor(public readonly data: AgentData) {}

  /**
   * Create a new agent
   */
  static create(input: CreateAgentInput): Result<Agent, ValidationError> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Agent name is required', 'name'));
    }

    const id = createAgentId();
    const now = createTimestamp();

    const data: AgentData = {
      id,
      name: input.name.trim(),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      status: 'active',
      capabilities: [],
      problemSpaceBindings: [],
      policyIds: [],
      ...(input.parentAgentId !== undefined ? { parentAgentId: input.parentAgentId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      createdAt: now,
      updatedAt: now,
    };

    return ok(new Agent(data));
  }

  /**
   * Reconstruct agent from stored record
   */
  static fromRecord(record: AgentRecord): Agent {
    const capabilities = typeof record.capabilities === 'string'
      ? JSON.parse(record.capabilities) as AgentCapability[]
      : [];

    const problemSpaceBindings = typeof record.problemSpaceBindings === 'string'
      ? JSON.parse(record.problemSpaceBindings) as AgentProblemSpaceBinding[]
      : [];

    const policyIds = typeof record.policyIds === 'string'
      ? JSON.parse(record.policyIds) as string[]
      : [];

    const metadata = record.metadata !== null
      ? JSON.parse(record.metadata) as Record<string, unknown>
      : undefined;

    return new Agent({
      id: record.id as AgentId,
      name: record.name,
      ...(record.description !== null ? { description: record.description } : {}),
      status: record.status as AgentStatus,
      capabilities,
      problemSpaceBindings,
      policyIds,
      ...(record.parentAgentId !== null ? { parentAgentId: record.parentAgentId as AgentId } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): AgentRecord {
    return {
      id: this.data.id,
      name: this.data.name,
      description: this.data.description ?? null,
      status: this.data.status,
      capabilities: JSON.stringify(this.data.capabilities),
      problemSpaceBindings: JSON.stringify(this.data.problemSpaceBindings),
      policyIds: JSON.stringify(this.data.policyIds),
      parentAgentId: this.data.parentAgentId ?? null,
      metadata: this.data.metadata !== undefined ? JSON.stringify(this.data.metadata) : null,
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
    };
  }

  /**
   * Grant a capability to the agent
   */
  grantCapability(input: GrantCapabilityInput): Result<Agent, ValidationError> {
    if (this.data.status !== 'active') {
      return err(new ValidationError(`Cannot grant capability to ${this.data.status} agent`, 'status'));
    }

    // Check for duplicate capability
    const existing = this.data.capabilities.find((c) => c.capabilityId === input.capabilityId);
    if (existing) {
      return err(new ValidationError('Capability already granted', 'capabilityId'));
    }

    const capability: AgentCapability = {
      capabilityId: input.capabilityId,
      grantedAt: createTimestamp(),
      grantedBy: input.grantedBy,
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.jurisdiction !== undefined ? { jurisdiction: input.jurisdiction } : {}),
    };

    return ok(new Agent({
      ...this.data,
      capabilities: [...this.data.capabilities, capability],
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Revoke a capability from the agent
   */
  revokeCapability(capabilityId: string): Result<Agent, ValidationError> {
    const index = this.data.capabilities.findIndex((c) => c.capabilityId === capabilityId);
    if (index === -1) {
      return err(new ValidationError('Capability not found', 'capabilityId'));
    }

    const newCapabilities = [...this.data.capabilities];
    newCapabilities.splice(index, 1);

    return ok(new Agent({
      ...this.data,
      capabilities: newCapabilities,
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Check if agent has a specific capability
   */
  hasCapability(capabilityId: string): boolean {
    return this.data.capabilities.some((c) => c.capabilityId === capabilityId);
  }

  /**
   * Check if agent can perform an action
   */
  checkCapability(context: CapabilityCheckContext, registry: CapabilityRegistry): CapabilityCheckResult {
    if (this.data.status !== 'active') {
      return {
        allowed: false,
        reason: `Agent is ${this.data.status}`,
      };
    }

    const now = createTimestamp();

    for (const agentCap of this.data.capabilities) {
      // Check expiration
      if (agentCap.expiresAt !== undefined && agentCap.expiresAt < now) {
        continue;
      }

      // Check scope match
      if (context.scope !== undefined && agentCap.scope !== undefined && agentCap.scope !== context.scope) {
        continue;
      }

      // Check jurisdiction match
      if (context.jurisdiction !== undefined && agentCap.jurisdiction !== undefined && agentCap.jurisdiction !== context.jurisdiction) {
        continue;
      }

      // Check capability allows the action
      if (registry.checkAction(agentCap.capabilityId, context.action, context.resourceType)) {
        const capability = registry.get(agentCap.capabilityId);
        return {
          allowed: true,
          matchedCapability: agentCap,
          ...(capability?.constraints !== undefined ? { constraints: capability.constraints } : {}),
        };
      }
    }

    return {
      allowed: false,
      reason: 'No matching capability found',
    };
  }

  /**
   * Bind agent to a problem space
   */
  bindProblemSpace(
    problemSpaceId: ProblemSpaceId,
    allowedNodeIds: readonly string[],
    deniedNodeIds: readonly string[] = []
  ): Result<Agent, ValidationError> {
    if (this.data.status !== 'active') {
      return err(new ValidationError(`Cannot bind problem space to ${this.data.status} agent`, 'status'));
    }

    // Check for existing binding
    const existing = this.data.problemSpaceBindings.find((b) => b.problemSpaceId === problemSpaceId);
    if (existing) {
      return err(new ValidationError('Problem space already bound', 'problemSpaceId'));
    }

    const binding: AgentProblemSpaceBinding = {
      problemSpaceId,
      allowedNodeIds: [...allowedNodeIds],
      deniedNodeIds: [...deniedNodeIds],
      boundAt: createTimestamp(),
    };

    return ok(new Agent({
      ...this.data,
      problemSpaceBindings: [...this.data.problemSpaceBindings, binding],
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Unbind agent from a problem space
   */
  unbindProblemSpace(problemSpaceId: ProblemSpaceId): Result<Agent, ValidationError> {
    const index = this.data.problemSpaceBindings.findIndex((b) => b.problemSpaceId === problemSpaceId);
    if (index === -1) {
      return err(new ValidationError('Problem space binding not found', 'problemSpaceId'));
    }

    const newBindings = [...this.data.problemSpaceBindings];
    newBindings.splice(index, 1);

    return ok(new Agent({
      ...this.data,
      problemSpaceBindings: newBindings,
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Check if agent can operate on a problem space node
   */
  canOperateOnNode(problemSpaceId: ProblemSpaceId, nodeId: string): boolean {
    const binding = this.data.problemSpaceBindings.find((b) => b.problemSpaceId === problemSpaceId);
    if (!binding) {
      return false;
    }

    // Check if explicitly denied
    if (binding.deniedNodeIds.includes(nodeId)) {
      return false;
    }

    // Check if explicitly allowed (or wildcard)
    if (binding.allowedNodeIds.includes('*') || binding.allowedNodeIds.includes(nodeId)) {
      return true;
    }

    return false;
  }

  /**
   * Bind agent to a policy
   */
  bindPolicy(policyId: string): Result<Agent, ValidationError> {
    if (this.data.policyIds.includes(policyId)) {
      return err(new ValidationError('Policy already bound', 'policyId'));
    }

    return ok(new Agent({
      ...this.data,
      policyIds: [...this.data.policyIds, policyId],
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Unbind agent from a policy
   */
  unbindPolicy(policyId: string): Result<Agent, ValidationError> {
    const index = this.data.policyIds.indexOf(policyId);
    if (index === -1) {
      return err(new ValidationError('Policy not bound', 'policyId'));
    }

    const newPolicyIds = [...this.data.policyIds];
    newPolicyIds.splice(index, 1);

    return ok(new Agent({
      ...this.data,
      policyIds: newPolicyIds,
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Suspend the agent
   */
  suspend(): Result<Agent, ValidationError> {
    if (this.data.status !== 'active') {
      return err(new ValidationError(`Cannot suspend agent with status: ${this.data.status}`, 'status'));
    }

    return ok(new Agent({
      ...this.data,
      status: 'suspended',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Reactivate a suspended agent
   */
  reactivate(): Result<Agent, ValidationError> {
    if (this.data.status !== 'suspended') {
      return err(new ValidationError(`Cannot reactivate agent with status: ${this.data.status}`, 'status'));
    }

    return ok(new Agent({
      ...this.data,
      status: 'active',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Revoke the agent permanently
   */
  revoke(): Result<Agent, ValidationError> {
    if (this.data.status === 'revoked') {
      return err(new ValidationError('Agent is already revoked', 'status'));
    }

    return ok(new Agent({
      ...this.data,
      status: 'revoked',
      updatedAt: createTimestamp(),
    }));
  }

  /**
   * Check if agent is active
   */
  isActive(): boolean {
    return this.data.status === 'active';
  }

  /**
   * Get active capabilities (non-expired)
   */
  getActiveCapabilities(): readonly AgentCapability[] {
    const now = createTimestamp();
    return this.data.capabilities.filter((c) => {
      if (c.expiresAt === undefined) {
        return true;
      }
      return c.expiresAt > now;
    });
  }
}
