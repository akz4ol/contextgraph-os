/**
 * CLI Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextGraph } from '@contextgraph/sdk';
import {
  GraphInspector,
  ContextGraphRepl,
  formatEntity,
  formatEntityTable,
  formatClaim,
  formatClaimTable,
  formatAgent,
  formatDecision,
  formatPolicy,
  formatStats,
  formatTimestamp,
  formatJSON,
} from './index.js';

describe('CLI Formatters', () => {
  describe('formatTimestamp', () => {
    it('formats a timestamp as ISO string', () => {
      const timestamp = 1704067200000; // 2024-01-01T00:00:00.000Z
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('formatJSON', () => {
    it('formats JSON with pretty printing', () => {
      const data = { foo: 'bar', num: 42 };
      const formatted = formatJSON(data);
      expect(formatted).toContain('foo');
      expect(formatted).toContain('\n');
    });

    it('formats JSON without pretty printing', () => {
      const data = { foo: 'bar' };
      const formatted = formatJSON(data, false);
      expect(formatted).toBe('{"foo":"bar"}');
    });
  });

  describe('formatStats', () => {
    it('formats statistics', () => {
      const stats = {
        entities: 100,
        claims: 500,
        agents: 5,
        decisions: 20,
        policies: 3,
      };
      const formatted = formatStats(stats, { colors: false });
      expect(formatted).toContain('Entities:');
      expect(formatted).toContain('100');
      expect(formatted).toContain('Claims:');
      expect(formatted).toContain('500');
    });
  });
});

describe('GraphInspector', () => {
  let client: ContextGraph;
  let inspector: GraphInspector;

  beforeEach(async () => {
    const result = await ContextGraph.create({
      enablePolicies: false,
      enableCapabilities: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      client = result.value;
      inspector = new GraphInspector(client, { formatOptions: { colors: false } });
    }
  });

  describe('getStats', () => {
    it('returns system statistics', async () => {
      const result = await inspector.getStats();
      expect(result.success).toBe(true);
      expect(result.output).toContain('Statistics');
    });
  });

  describe('listEntities', () => {
    it('returns empty list when no entities', async () => {
      const result = await inspector.listEntities();
      expect(result.success).toBe(true);
      expect(result.output).toContain('No entities found');
    });

    it('lists created entities', async () => {
      await client.createEntity({ type: 'test', name: 'Entity1' });
      await client.createEntity({ type: 'test', name: 'Entity2' });

      const result = await inspector.listEntities('test');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('inspectEntity', () => {
    it('returns error for non-existent entity', async () => {
      const result = await inspector.inspectEntity('non-existent');
      expect(result.success).toBe(false);
      expect(result.output).toContain('not found');
    });

    it('inspects existing entity', async () => {
      const entityResult = await client.createEntity({
        type: 'person',
        name: 'Alice',
      });
      expect(entityResult.ok).toBe(true);
      if (!entityResult.ok) return;

      const result = await inspector.inspectEntity(entityResult.value.data.id);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Alice');
      expect(result.output).toContain('person');
    });
  });

  describe('inspectEntityWithClaims', () => {
    it('inspects entity with its claims', async () => {
      const entityResult = await client.createEntity({
        type: 'product',
        name: 'Widget',
      });
      expect(entityResult.ok).toBe(true);
      if (!entityResult.ok) return;

      await client.addClaim({
        subjectId: entityResult.value.data.id,
        predicate: 'price',
        value: 29.99,
      });

      const result = await inspector.inspectEntityWithClaims(entityResult.value.data.id);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Widget');
      expect(result.output).toContain('Claims');
    });
  });

  describe('listAgents', () => {
    it('returns empty when no agents', async () => {
      const result = await inspector.listAgents();
      expect(result.success).toBe(true);
      expect(result.output).toContain('No active agents');
    });

    it('lists created agents', async () => {
      await client.createAgent({ name: 'agent-1' });
      await client.createAgent({ name: 'agent-2' });

      const result = await inspector.listAgents();
      expect(result.success).toBe(true);
      expect(result.output).toContain('agent-1');
      expect(result.output).toContain('agent-2');
    });
  });

  describe('inspectAgent', () => {
    it('inspects agent by name', async () => {
      await client.createAgent({ name: 'my-agent', description: 'Test agent' });

      const result = await inspector.inspectAgent('my-agent');
      expect(result.success).toBe(true);
      expect(result.output).toContain('my-agent');
    });
  });

  describe('listPendingDecisions', () => {
    it('returns empty when no decisions', async () => {
      const result = await inspector.listPendingDecisions();
      expect(result.success).toBe(true);
      expect(result.output).toContain('No pending decisions');
    });

    it('lists pending decisions', async () => {
      const agent = await client.createAgent({ name: 'decision-maker' });
      if (!agent.ok) return;

      await client.recordDecision({
        type: 'workflow_step',
        title: 'Deploy feature',
        proposedBy: agent.value.data.id,
      });

      const result = await inspector.listPendingDecisions();
      expect(result.success).toBe(true);
      expect(result.output).toContain('Deploy feature');
    });
  });

  describe('verifyProvenance', () => {
    it('verifies empty provenance chain', async () => {
      const result = await inspector.verifyProvenance();
      expect(result.success).toBe(true);
      expect(result.output).toContain('VALID');
    });
  });

  describe('getAuditTrail', () => {
    it('returns audit trail', async () => {
      const agent = await client.createAgent({ name: 'audit-agent' });
      if (!agent.ok) return;

      client.registerHandler('execute', 'test', async () => ({ success: true }));
      await client.execute({
        agentId: agent.value.data.id,
        action: 'execute',
        resourceType: 'test',
      });

      const result = await inspector.getAuditTrail(5);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Audit Trail');
    });
  });

  describe('inspectContext', () => {
    it('assembles context for entity', async () => {
      const entity = await client.createEntity({ type: 'service', name: 'API' });
      if (!entity.ok) return;

      const result = await inspector.inspectContext(entity.value.data.id);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Context ID');
    });
  });
});

describe('ContextGraphRepl', () => {
  let client: ContextGraph;
  let repl: ContextGraphRepl;
  let output: string[];

  beforeEach(async () => {
    const result = await ContextGraph.create({
      enablePolicies: false,
      enableCapabilities: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      client = result.value;
      repl = new ContextGraphRepl(client, { colors: false });
      output = [];
      // Capture output
      repl.print = (msg: string) => { output.push(msg); };
      repl.printError = (msg: string) => { output.push(`Error: ${msg}`); };
    }
  });

  describe('execute', () => {
    it('ignores empty input', async () => {
      await repl.execute('');
      expect(output).toHaveLength(0);
    });

    it('ignores comments', async () => {
      await repl.execute('# this is a comment');
      expect(output).toHaveLength(0);
    });

    it('handles unknown commands', async () => {
      await repl.execute('unknown-command');
      expect(output.some(o => o.includes('Unknown command'))).toBe(true);
    });

    it('executes help command', async () => {
      await repl.execute('help');
      expect(output.some(o => o.includes('Available commands'))).toBe(true);
    });

    it('executes stats command', async () => {
      await repl.execute('stats');
      expect(output.some(o => o.includes('Statistics'))).toBe(true);
    });

    it('executes entities command', async () => {
      await repl.execute('entities');
      expect(output.some(o => o.includes('entities') || o.includes('No entities'))).toBe(true);
    });

    it('toggles JSON output', async () => {
      await repl.execute('json on');
      expect(output.some(o => o.includes('enabled'))).toBe(true);

      output = [];
      await repl.execute('json off');
      expect(output.some(o => o.includes('disabled'))).toBe(true);
    });
  });

  describe('getCommands', () => {
    it('returns all registered commands', () => {
      const commands = repl.getCommands();
      expect(commands.length).toBeGreaterThan(0);

      const names = commands.map(c => c.name);
      expect(names).toContain('help');
      expect(names).toContain('stats');
      expect(names).toContain('entities');
      expect(names).toContain('agent');
    });
  });

  describe('registerCommand', () => {
    it('registers custom commands', async () => {
      repl.registerCommand({
        name: 'custom',
        description: 'Custom command',
        usage: 'custom',
        execute: async (_args, r) => {
          r.print('Custom output');
        },
      });

      await repl.execute('custom');
      expect(output).toContain('Custom output');
    });
  });
});
