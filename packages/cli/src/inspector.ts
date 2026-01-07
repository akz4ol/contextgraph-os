/**
 * Graph Inspector
 *
 * Tools for inspecting and querying the ContextGraph.
 */

import type { EntityId, Result } from '@contextgraph/core';
import type { ContextGraph, Entity, Claim, Agent, Decision, Policy, AuditEntry } from '@contextgraph/sdk';
import {
  formatEntity,
  formatEntityTable,
  formatClaim,
  formatClaimTable,
  formatAgent,
  formatDecision,
  formatPolicy,
  formatProvenance,
  formatAuditTrail,
  formatStats,
  type FormatOptions,
} from './formatters.js';

/**
 * Inspector configuration
 */
export interface InspectorConfig {
  readonly formatOptions?: FormatOptions;
}

/**
 * Query result with formatted output
 */
export interface InspectorResult {
  readonly success: boolean;
  readonly output: string;
  readonly data?: unknown;
}

/**
 * Graph Inspector
 *
 * Provides inspection and query capabilities for ContextGraph.
 */
export class GraphInspector {
  private readonly formatOptions: FormatOptions;

  constructor(
    private readonly client: ContextGraph,
    config: InspectorConfig = {}
  ) {
    this.formatOptions = config.formatOptions ?? { colors: true };
  }

  /**
   * Inspect an entity by ID
   */
  async inspectEntity(id: string): Promise<InspectorResult> {
    const result = await this.client.getEntity(id as EntityId);
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    if (result.value === null) {
      return { success: false, output: `Entity not found: ${id}` };
    }

    return {
      success: true,
      output: formatEntity(result.value, this.formatOptions),
      data: result.value,
    };
  }

  /**
   * Inspect an entity with its claims
   */
  async inspectEntityWithClaims(id: string): Promise<InspectorResult> {
    const entityResult = await this.client.getEntity(id as EntityId);
    if (!entityResult.ok) {
      return { success: false, output: `Error: ${entityResult.error.message}` };
    }

    if (entityResult.value === null) {
      return { success: false, output: `Entity not found: ${id}` };
    }

    const claimsResult = await this.client.getClaims(id as EntityId);
    if (!claimsResult.ok) {
      return { success: false, output: `Error getting claims: ${claimsResult.error.message}` };
    }

    const lines: string[] = [];
    lines.push(formatEntity(entityResult.value, this.formatOptions));
    lines.push('');
    lines.push('Claims:');
    lines.push(formatClaimTable(claimsResult.value, this.formatOptions));

    return {
      success: true,
      output: lines.join('\n'),
      data: { entity: entityResult.value, claims: claimsResult.value },
    };
  }

  /**
   * List entities by type
   */
  async listEntities(type?: string, limit: number = 100): Promise<InspectorResult> {
    let result: Result<readonly Entity[], Error>;

    if (type !== undefined) {
      result = await this.client.findEntitiesByType(type, { limit });
    } else {
      // Get all entities - use storage directly
      const storage = this.client.getStorage();
      const queryResult = await storage.find('entities', {}, { limit });
      if (!queryResult.ok) {
        return { success: false, output: `Error: ${queryResult.error.message}` };
      }

      // Fetch full entities
      const entities: Entity[] = [];
      for (const record of queryResult.value.items) {
        const entity = await this.client.getEntity(record.id as EntityId);
        if (entity.ok && entity.value !== null) {
          entities.push(entity.value);
        }
      }

      return {
        success: true,
        output: formatEntityTable(entities, this.formatOptions),
        data: entities,
      };
    }

    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    return {
      success: true,
      output: formatEntityTable(result.value, this.formatOptions),
      data: result.value,
    };
  }

  /**
   * Inspect an agent by ID or name
   */
  async inspectAgent(idOrName: string): Promise<InspectorResult> {
    // Try by ID first
    let result = await this.client.getAgent(idOrName);
    if (result.ok && result.value === null) {
      // Try by name
      result = await this.client.findAgentByName(idOrName);
    }

    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    if (result.value === null) {
      return { success: false, output: `Agent not found: ${idOrName}` };
    }

    return {
      success: true,
      output: formatAgent(result.value, this.formatOptions),
      data: result.value,
    };
  }

  /**
   * List all active agents
   */
  async listAgents(): Promise<InspectorResult> {
    const result = await this.client.getActiveAgents();
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    if (result.value.length === 0) {
      return { success: true, output: 'No active agents found.', data: [] };
    }

    const lines: string[] = [];
    for (const agent of result.value) {
      lines.push(formatAgent(agent, this.formatOptions));
      lines.push('');
    }

    return {
      success: true,
      output: lines.join('\n'),
      data: result.value,
    };
  }

  /**
   * List pending decisions
   */
  async listPendingDecisions(): Promise<InspectorResult> {
    const result = await this.client.getPendingDecisions();
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    if (result.value.length === 0) {
      return { success: true, output: 'No pending decisions.', data: [] };
    }

    const lines: string[] = [];
    for (const decision of result.value) {
      lines.push(formatDecision(decision, this.formatOptions));
      lines.push('');
    }

    return {
      success: true,
      output: lines.join('\n'),
      data: result.value,
    };
  }

  /**
   * List effective policies
   */
  async listPolicies(): Promise<InspectorResult> {
    const result = await this.client.getEffectivePolicies();
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    if (result.value.length === 0) {
      return { success: true, output: 'No effective policies.', data: [] };
    }

    const lines: string[] = [];
    for (const policy of result.value) {
      lines.push(formatPolicy(policy, this.formatOptions));
      lines.push('');
    }

    return {
      success: true,
      output: lines.join('\n'),
      data: result.value,
    };
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(limit: number = 20): Promise<InspectorResult> {
    const result = await this.client.getAuditTrail({ limit });
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    return {
      success: true,
      output: formatAuditTrail(result.value, this.formatOptions),
      data: result.value,
    };
  }

  /**
   * Verify provenance chain
   */
  async verifyProvenance(): Promise<InspectorResult> {
    const result = await this.client.verifyProvenance();
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    const lines: string[] = [];
    if (result.value.valid) {
      lines.push('Provenance chain: VALID');
    } else {
      lines.push('Provenance chain: INVALID');

      if (result.value.brokenLinks.length > 0) {
        lines.push(`  Broken links: ${result.value.brokenLinks.length}`);
      }
      if (result.value.invalidHashes.length > 0) {
        lines.push(`  Invalid hashes: ${result.value.invalidHashes.length}`);
      }
    }

    lines.push(`  Entries verified: ${result.value.entriesVerified}`);

    return {
      success: true,
      output: lines.join('\n'),
      data: result.value,
    };
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<InspectorResult> {
    const result = await this.client.getStats();
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    return {
      success: true,
      output: formatStats(result.value, this.formatOptions),
      data: result.value,
    };
  }

  /**
   * Assemble and display context for an entity
   */
  async inspectContext(entityId: string): Promise<InspectorResult> {
    const result = await this.client.assembleContext(entityId as EntityId);
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    const ctx = result.value;
    const lines: string[] = [];

    lines.push(`Context ID: ${ctx.id}`);
    lines.push(`Assembled at: ${new Date(ctx.assembledAt).toISOString()}`);
    lines.push('');
    lines.push(`Entities: ${ctx.stats.totalEntities}`);
    lines.push(`Claims: ${ctx.stats.totalClaims}`);
    lines.push(`Provenance entries: ${ctx.stats.totalProvenance}`);
    lines.push(`Retrieval time: ${ctx.stats.retrievalTimeMs}ms`);

    if (ctx.entities.length > 0) {
      lines.push('');
      lines.push('Entities:');
      for (const { entity, relevance } of ctx.entities) {
        lines.push(`  - ${entity.data.name ?? entity.data.id} (relevance: ${(relevance.score * 100).toFixed(0)}%)`);
      }
    }

    if (ctx.claims.length > 0) {
      lines.push('');
      lines.push('Claims:');
      for (const { claim, relevance } of ctx.claims) {
        lines.push(`  - ${claim.data.predicate}: ${JSON.stringify(claim.data.objectValue)} (relevance: ${(relevance.score * 100).toFixed(0)}%)`);
      }
    }

    return {
      success: true,
      output: lines.join('\n'),
      data: ctx,
    };
  }

  /**
   * Query provenance entries
   */
  async queryProvenance(limit: number = 10): Promise<InspectorResult> {
    const result = await this.client.queryProvenance({ limit });
    if (!result.ok) {
      return { success: false, output: `Error: ${result.error.message}` };
    }

    if (result.value.length === 0) {
      return { success: true, output: 'No provenance entries found.', data: [] };
    }

    const lines: string[] = [];
    for (const entry of result.value) {
      lines.push(formatProvenance(entry, this.formatOptions));
      lines.push('');
    }

    return {
      success: true,
      output: lines.join('\n'),
      data: result.value,
    };
  }
}
