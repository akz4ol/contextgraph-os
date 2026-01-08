/**
 * Agent Hierarchy Manager
 *
 * Manages agent hierarchies, delegation, and supervision.
 */

import {
  type Result,
  ok,
  err,
  createTimestamp,
  ValidationError,
} from '@contextgraph/core';
import type { Timestamp, EntityId } from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  AgentId,
  CapabilityId,
  CreateAgentInput,
} from './types.js';
import { Agent } from './agent.js';
import { AgentRegistry } from './registry.js';

/**
 * Delegation record
 */
export interface Delegation {
  readonly id: string;
  readonly fromAgentId: AgentId;
  readonly toAgentId: AgentId;
  readonly capabilityId: CapabilityId;
  readonly delegatedAt: Timestamp;
  readonly delegatedBy: EntityId;
  readonly expiresAt?: Timestamp;
  readonly revokedAt?: Timestamp;
  readonly revokedBy?: EntityId;
}

/**
 * Delegation record for storage
 */
export interface DelegationRecord {
  readonly [key: string]: string | number | null | Timestamp;
  readonly id: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly capabilityId: string;
  readonly delegatedAt: Timestamp;
  readonly delegatedBy: string;
  readonly expiresAt: Timestamp | null;
  readonly revokedAt: Timestamp | null;
  readonly revokedBy: string | null;
  readonly createdAt: Timestamp;
}

/**
 * Agent hierarchy node
 */
export interface AgentHierarchyNode {
  readonly agent: Agent;
  readonly children: readonly AgentHierarchyNode[];
  readonly depth: number;
}

/**
 * Cascade operation type
 */
export type CascadeOperation = 'suspend' | 'revoke' | 'reactivate';

/**
 * Cascade result
 */
export interface CascadeResult {
  readonly operation: CascadeOperation;
  readonly affectedAgents: readonly AgentId[];
  readonly errors: readonly { agentId: AgentId; error: string }[];
}

/**
 * Delegation input
 */
export interface DelegateCapabilityInput {
  readonly fromAgentId: AgentId;
  readonly toAgentId: AgentId;
  readonly capabilityId: CapabilityId;
  readonly delegatedBy: EntityId;
  readonly expiresAt?: Timestamp;
}

/**
 * Agent Hierarchy Manager
 */
export class AgentHierarchyManager {
  private readonly registry: AgentRegistry;
  private readonly delegationCollection = 'agent_delegations';

  constructor(
    private readonly storage: StorageInterface,
    registry?: AgentRegistry
  ) {
    this.registry = registry ?? new AgentRegistry(storage);
  }

  /**
   * Create a child agent under a parent
   */
  async createChildAgent(
    parentId: AgentId,
    input: Omit<CreateAgentInput, 'parentAgentId'>
  ): Promise<Result<Agent, Error>> {
    // Verify parent exists and is active
    const parentResult = await this.registry.findById(parentId);
    if (!parentResult.ok) {
      return err(parentResult.error);
    }

    if (parentResult.value === null) {
      return err(new ValidationError('Parent agent not found', 'parentAgentId'));
    }

    if (!parentResult.value.isActive()) {
      return err(new ValidationError('Parent agent is not active', 'parentAgentId'));
    }

    // Create child with parent reference
    return this.registry.create({
      ...input,
      parentAgentId: parentId,
    });
  }

  /**
   * Get direct children of an agent
   */
  async getChildren(agentId: AgentId): Promise<Result<readonly Agent[], Error>> {
    return this.registry.findChildren(agentId);
  }

  /**
   * Get all descendants of an agent (recursive)
   */
  async getDescendants(agentId: AgentId): Promise<Result<readonly Agent[], Error>> {
    const descendants: Agent[] = [];
    const queue: AgentId[] = [agentId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const childrenResult = await this.registry.findChildren(currentId);
      if (!childrenResult.ok) {
        return err(childrenResult.error);
      }

      for (const child of childrenResult.value) {
        descendants.push(child);
        queue.push(child.data.id);
      }
    }

    return ok(descendants);
  }

  /**
   * Get the full agent hierarchy tree starting from a root agent
   */
  async getHierarchy(rootId: AgentId): Promise<Result<AgentHierarchyNode, Error>> {
    const rootResult = await this.registry.findById(rootId);
    if (!rootResult.ok) {
      return err(rootResult.error);
    }

    if (rootResult.value === null) {
      return err(new ValidationError('Root agent not found', 'rootId'));
    }

    return this.buildHierarchyNode(rootResult.value, 0);
  }

  /**
   * Recursively build hierarchy node
   */
  private async buildHierarchyNode(
    agent: Agent,
    depth: number
  ): Promise<Result<AgentHierarchyNode, Error>> {
    const childrenResult = await this.registry.findChildren(agent.data.id);
    if (!childrenResult.ok) {
      return err(childrenResult.error);
    }

    const childNodes: AgentHierarchyNode[] = [];
    for (const child of childrenResult.value) {
      const childNodeResult = await this.buildHierarchyNode(child, depth + 1);
      if (!childNodeResult.ok) {
        return err(childNodeResult.error);
      }
      childNodes.push(childNodeResult.value);
    }

    return ok({
      agent,
      children: childNodes,
      depth,
    });
  }

  /**
   * Get ancestors of an agent (path to root)
   */
  async getAncestors(agentId: AgentId): Promise<Result<readonly Agent[], Error>> {
    const ancestors: Agent[] = [];
    let currentId: AgentId | undefined = agentId;

    while (currentId !== undefined) {
      const agentResult = await this.registry.findById(currentId);
      if (!agentResult.ok) {
        return err(agentResult.error);
      }

      if (agentResult.value === null) {
        break;
      }

      // Don't include the starting agent
      if (agentResult.value.data.id !== agentId) {
        ancestors.push(agentResult.value);
      }

      currentId = agentResult.value.data.parentAgentId;
    }

    return ok(ancestors);
  }

  /**
   * Check if an agent is a descendant of another
   */
  async isDescendantOf(agentId: AgentId, ancestorId: AgentId): Promise<Result<boolean, Error>> {
    const ancestorsResult = await this.getAncestors(agentId);
    if (!ancestorsResult.ok) {
      return err(ancestorsResult.error);
    }

    return ok(ancestorsResult.value.some((a) => a.data.id === ancestorId));
  }

  // ==================== DELEGATION ====================

  /**
   * Delegate a capability from one agent to another
   */
  async delegateCapability(input: DelegateCapabilityInput): Promise<Result<Delegation, Error>> {
    const { fromAgentId, toAgentId, capabilityId, delegatedBy, expiresAt } = input;

    // Verify from-agent exists and has the capability
    const fromAgentResult = await this.registry.findById(fromAgentId);
    if (!fromAgentResult.ok) {
      return err(fromAgentResult.error);
    }

    if (fromAgentResult.value === null) {
      return err(new ValidationError('Source agent not found', 'fromAgentId'));
    }

    if (!fromAgentResult.value.hasCapability(capabilityId)) {
      return err(new ValidationError('Source agent does not have the capability', 'capabilityId'));
    }

    // Verify from-agent has delegation capability
    if (!fromAgentResult.value.hasCapability('cap_delegate' as CapabilityId)) {
      return err(new ValidationError('Source agent cannot delegate capabilities', 'fromAgentId'));
    }

    // Verify to-agent exists and is active
    const toAgentResult = await this.registry.findById(toAgentId);
    if (!toAgentResult.ok) {
      return err(toAgentResult.error);
    }

    if (toAgentResult.value === null) {
      return err(new ValidationError('Target agent not found', 'toAgentId'));
    }

    if (!toAgentResult.value.isActive()) {
      return err(new ValidationError('Target agent is not active', 'toAgentId'));
    }

    // Check for existing active delegation
    const existingResult = await this.findActiveDelegation(fromAgentId, toAgentId, capabilityId);
    if (existingResult.ok && existingResult.value !== null) {
      return err(new ValidationError('Delegation already exists', 'capabilityId'));
    }

    // Create delegation record
    const now = createTimestamp();
    const delegation: Delegation = {
      id: `del_${now}_${Math.random().toString(36).slice(2, 8)}`,
      fromAgentId,
      toAgentId,
      capabilityId,
      delegatedAt: now,
      delegatedBy,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    };

    const record: DelegationRecord = {
      id: delegation.id,
      fromAgentId: delegation.fromAgentId,
      toAgentId: delegation.toAgentId,
      capabilityId: delegation.capabilityId,
      delegatedAt: delegation.delegatedAt,
      delegatedBy: delegation.delegatedBy,
      expiresAt: delegation.expiresAt ?? null,
      revokedAt: null,
      revokedBy: null,
      createdAt: now,
    };

    const insertResult = await this.storage.insert(this.delegationCollection, record);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    // Grant the capability to the target agent
    const grantInput = {
      capabilityId,
      grantedBy: delegatedBy,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    };
    const updatedAgent = toAgentResult.value.grantCapability(grantInput);

    if (updatedAgent.ok) {
      await this.storage.upsert('agents', updatedAgent.value.toRecord());
    }

    return ok(delegation);
  }

  /**
   * Revoke a delegated capability
   */
  async revokeDelegation(
    fromAgentId: AgentId,
    toAgentId: AgentId,
    capabilityId: CapabilityId,
    revokedBy: EntityId
  ): Promise<Result<void, Error>> {
    // Find active delegation
    const delegationResult = await this.findActiveDelegation(fromAgentId, toAgentId, capabilityId);
    if (!delegationResult.ok) {
      return err(delegationResult.error);
    }

    if (delegationResult.value === null) {
      return err(new ValidationError('Delegation not found', 'capabilityId'));
    }

    // Update delegation as revoked
    const now = createTimestamp();
    const revokedRecord: DelegationRecord = {
      id: delegationResult.value.id,
      fromAgentId: delegationResult.value.fromAgentId,
      toAgentId: delegationResult.value.toAgentId,
      capabilityId: delegationResult.value.capabilityId,
      delegatedAt: delegationResult.value.delegatedAt,
      delegatedBy: delegationResult.value.delegatedBy,
      expiresAt: delegationResult.value.expiresAt ?? null,
      revokedAt: now,
      revokedBy,
      createdAt: delegationResult.value.delegatedAt,
    };

    const updateResult = await this.storage.upsert(this.delegationCollection, revokedRecord);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    // Revoke the capability from the target agent
    const toAgentResult = await this.registry.findById(toAgentId);
    if (toAgentResult.ok && toAgentResult.value !== null) {
      const updated = toAgentResult.value.revokeCapability(capabilityId);
      if (updated.ok) {
        await this.storage.upsert('agents', updated.value.toRecord());
      }
    }

    return ok(undefined);
  }

  /**
   * Find active delegation
   */
  private async findActiveDelegation(
    fromAgentId: AgentId,
    toAgentId: AgentId,
    capabilityId: CapabilityId
  ): Promise<Result<Delegation | null, Error>> {
    const result = await this.storage.find<DelegationRecord>(
      this.delegationCollection,
      {
        fromAgentId,
        toAgentId,
        capabilityId,
      },
      { limit: 10 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const now = createTimestamp();
    const active = result.value.items.find((d) => {
      // Not revoked
      if (d.revokedAt !== null) return false;
      // Not expired
      if (d.expiresAt !== null && d.expiresAt < now) return false;
      return true;
    });

    if (active === undefined) {
      return ok(null);
    }

    return ok({
      id: active.id,
      fromAgentId: active.fromAgentId as AgentId,
      toAgentId: active.toAgentId as AgentId,
      capabilityId: active.capabilityId as CapabilityId,
      delegatedAt: active.delegatedAt,
      delegatedBy: active.delegatedBy as EntityId,
      ...(active.expiresAt !== null ? { expiresAt: active.expiresAt } : {}),
      ...(active.revokedAt !== null ? { revokedAt: active.revokedAt } : {}),
      ...(active.revokedBy !== null ? { revokedBy: active.revokedBy as EntityId } : {}),
    });
  }

  /**
   * Get all delegations from an agent
   */
  async getDelegationsFrom(agentId: AgentId): Promise<Result<readonly Delegation[], Error>> {
    const result = await this.storage.find<DelegationRecord>(
      this.delegationCollection,
      { fromAgentId: agentId },
      { limit: 100 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map(this.recordToDelegation));
  }

  /**
   * Get all delegations to an agent
   */
  async getDelegationsTo(agentId: AgentId): Promise<Result<readonly Delegation[], Error>> {
    const result = await this.storage.find<DelegationRecord>(
      this.delegationCollection,
      { toAgentId: agentId },
      { limit: 100 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map(this.recordToDelegation));
  }

  /**
   * Convert record to delegation
   */
  private recordToDelegation(record: DelegationRecord): Delegation {
    return {
      id: record.id,
      fromAgentId: record.fromAgentId as AgentId,
      toAgentId: record.toAgentId as AgentId,
      capabilityId: record.capabilityId as CapabilityId,
      delegatedAt: record.delegatedAt,
      delegatedBy: record.delegatedBy as EntityId,
      ...(record.expiresAt !== null ? { expiresAt: record.expiresAt } : {}),
      ...(record.revokedAt !== null ? { revokedAt: record.revokedAt } : {}),
      ...(record.revokedBy !== null ? { revokedBy: record.revokedBy as EntityId } : {}),
    };
  }

  // ==================== SUPERVISION ====================

  /**
   * Cascade suspend to all descendants
   */
  async cascadeSuspend(agentId: AgentId): Promise<Result<CascadeResult, Error>> {
    return this.cascadeOperation(agentId, 'suspend');
  }

  /**
   * Cascade revoke to all descendants
   */
  async cascadeRevoke(agentId: AgentId): Promise<Result<CascadeResult, Error>> {
    return this.cascadeOperation(agentId, 'revoke');
  }

  /**
   * Cascade reactivate to all descendants
   */
  async cascadeReactivate(agentId: AgentId): Promise<Result<CascadeResult, Error>> {
    return this.cascadeOperation(agentId, 'reactivate');
  }

  /**
   * Perform a cascade operation on an agent and its descendants
   */
  private async cascadeOperation(
    agentId: AgentId,
    operation: CascadeOperation
  ): Promise<Result<CascadeResult, Error>> {
    const affectedAgents: AgentId[] = [];
    const errors: { agentId: AgentId; error: string }[] = [];

    // Get all descendants
    const descendantsResult = await this.getDescendants(agentId);
    if (!descendantsResult.ok) {
      return err(descendantsResult.error);
    }

    // Include the root agent
    const rootResult = await this.registry.findById(agentId);
    if (!rootResult.ok) {
      return err(rootResult.error);
    }

    if (rootResult.value === null) {
      return err(new ValidationError('Agent not found', 'agentId'));
    }

    const allAgents = [rootResult.value, ...descendantsResult.value];

    // Apply operation to each agent
    for (const agent of allAgents) {
      let result: Result<Agent, Error>;

      switch (operation) {
        case 'suspend':
          result = agent.suspend();
          break;
        case 'revoke':
          result = agent.revoke();
          break;
        case 'reactivate':
          result = agent.reactivate();
          break;
      }

      if (result.ok) {
        const updateResult = await this.storage.upsert('agents', result.value.toRecord());
        if (updateResult.ok) {
          affectedAgents.push(agent.data.id);
        } else {
          errors.push({ agentId: agent.data.id, error: updateResult.error.message });
        }
      } else {
        errors.push({ agentId: agent.data.id, error: result.error.message });
      }
    }

    return ok({
      operation,
      affectedAgents,
      errors,
    });
  }

  /**
   * Check if a parent agent needs to approve a child's action
   * This checks the parent's capabilities for the 'approve' action
   */
  async requiresParentApproval(
    childAgentId: AgentId,
    _action: string,
    _resourceType: string
  ): Promise<Result<boolean, Error>> {
    const childResult = await this.registry.findById(childAgentId);
    if (!childResult.ok) {
      return err(childResult.error);
    }

    if (childResult.value === null) {
      return err(new ValidationError('Agent not found', 'childAgentId'));
    }

    // If no parent, no approval needed
    if (childResult.value.data.parentAgentId === undefined) {
      return ok(false);
    }

    const parentResult = await this.registry.findById(childResult.value.data.parentAgentId);
    if (!parentResult.ok) {
      return err(parentResult.error);
    }

    if (parentResult.value === null || !parentResult.value.isActive()) {
      return ok(false);
    }

    // Check if parent has approval authority for this action type
    // Parent must have 'admin' category capability to require approval
    const parentCapabilities = parentResult.value.getActiveCapabilities();
    const hasApprovalAuthority = parentCapabilities.some((cap) => {
      // In a real system, we'd check the capability definition
      // For now, check if parent has admin or delegate capability
      return cap.capabilityId === ('cap_admin' as CapabilityId) ||
             cap.capabilityId === ('cap_delegate' as CapabilityId);
    });

    return ok(hasApprovalAuthority);
  }

  /**
   * Get the agent registry
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}
