/**
 * Agent Registry
 *
 * Manages agent storage and retrieval.
 */

import {
  type Result,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import type {
  AgentId,
  AgentRecord,
  CreateAgentInput,
  AgentStatus,
  CapabilityId,
} from './types.js';
import { Agent } from './agent.js';

/**
 * Agent query options
 */
export interface AgentQueryOptions {
  readonly status?: AgentStatus;
  readonly parentAgentId?: AgentId;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Agent Registry
 *
 * Stores and manages agents.
 */
export class AgentRegistry {
  private readonly collection = 'agents';

  constructor(private readonly storage: StorageInterface) {}

  /**
   * Create a new agent
   */
  async create(input: CreateAgentInput): Promise<Result<Agent, Error>> {
    // Check for existing agent with same name
    const existingResult = await this.findByName(input.name);
    if (existingResult.ok && existingResult.value !== null) {
      return err(new ValidationError(
        `Agent "${input.name}" already exists`,
        'name'
      ));
    }

    const agentResult = Agent.create(input);
    if (!agentResult.ok) {
      return agentResult;
    }

    const agent = agentResult.value;
    const insertResult = await this.storage.insert(this.collection, agent.toRecord());
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    return ok(agent);
  }

  /**
   * Get agent by ID
   */
  async findById(id: AgentId): Promise<Result<Agent | null, Error>> {
    const result = await this.storage.findById<AgentRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(Agent.fromRecord(result.value));
  }

  /**
   * Find agent by name
   */
  async findByName(name: string): Promise<Result<Agent | null, Error>> {
    const result = await this.storage.find<AgentRecord>(
      this.collection,
      { name },
      { limit: 1 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.items.length === 0) {
      return ok(null);
    }

    return ok(Agent.fromRecord(result.value.items[0]!));
  }

  /**
   * Query agents
   */
  async query(options: AgentQueryOptions): Promise<Result<readonly Agent[], Error>> {
    const criteria: Record<string, unknown> = {};

    if (options.status !== undefined) {
      criteria['status'] = options.status;
    }

    if (options.parentAgentId !== undefined) {
      criteria['parentAgentId'] = options.parentAgentId;
    }

    const queryOptions: { limit?: number; offset?: number } = {};
    if (options.limit !== undefined) {
      queryOptions.limit = options.limit;
    }
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<AgentRecord>(this.collection, criteria, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => Agent.fromRecord(record)));
  }

  /**
   * Find active agents
   */
  async findActive(): Promise<Result<readonly Agent[], Error>> {
    return this.query({ status: 'active' });
  }

  /**
   * Find child agents
   */
  async findChildren(parentId: AgentId): Promise<Result<readonly Agent[], Error>> {
    return this.query({ parentAgentId: parentId });
  }

  /**
   * Find agents with a specific capability
   */
  async findByCapability(capabilityId: CapabilityId): Promise<Result<readonly Agent[], Error>> {
    const allResult = await this.query({});
    if (!allResult.ok) {
      return allResult;
    }

    const agents = allResult.value.filter((agent) => agent.hasCapability(capabilityId));
    return ok(agents);
  }

  /**
   * Count agents by status
   */
  async countByStatus(status: AgentStatus): Promise<Result<number, Error>> {
    return this.storage.count(this.collection, { status });
  }

  /**
   * Get agent statistics
   */
  async getStats(): Promise<Result<{
    total: number;
    active: number;
    suspended: number;
    revoked: number;
  }, Error>> {
    const statuses: AgentStatus[] = ['active', 'suspended', 'revoked'];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const result = await this.countByStatus(status);
      if (result.ok) {
        counts[status] = result.value;
      }
    }

    const totalResult = await this.storage.count(this.collection, {});
    if (!totalResult.ok) {
      return err(totalResult.error);
    }

    return ok({
      total: totalResult.value,
      active: counts['active'] ?? 0,
      suspended: counts['suspended'] ?? 0,
      revoked: counts['revoked'] ?? 0,
    });
  }
}
