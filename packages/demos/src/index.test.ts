/**
 * Demo Integration Tests
 *
 * Tests that verify the demos run successfully.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContextGraph,
  createScope,
  createConfidence,
  createTimestamp,
  ok,
} from '@contextgraph/sdk';
import { GraphInspector, ContextGraphRepl } from '@contextgraph/cli';

describe('Integration Tests', () => {
  let client: ContextGraph;

  beforeEach(async () => {
    const result = await ContextGraph.create({
      enablePolicies: false,
      enableCapabilities: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      client = result.value;
    }
  });

  describe('End-to-End Workflow', () => {
    it('creates entities, claims, and queries them', async () => {
      // Create a person
      const personResult = await client.createEntity({
        type: 'person',
        name: 'John Doe',
        properties: { email: 'john@example.com' },
      });
      expect(personResult.ok).toBe(true);
      if (!personResult.ok) return;

      // Create an organization
      const orgResult = await client.createEntity({
        type: 'organization',
        name: 'Acme Corp',
        properties: { industry: 'Technology' },
      });
      expect(orgResult.ok).toBe(true);
      if (!orgResult.ok) return;

      // Add claims
      await client.addClaim({
        subjectId: personResult.value.data.id,
        predicate: 'works_for',
        value: 'Acme Corp',
        objectId: orgResult.value.data.id,
        context: {
          scope: createScope('employment'),
          confidence: createConfidence(1.0),
        },
      });

      await client.addClaim({
        subjectId: personResult.value.data.id,
        predicate: 'job_title',
        value: 'Software Engineer',
      });

      // Query claims
      const claims = await client.getClaims(personResult.value.data.id);
      expect(claims.ok).toBe(true);
      if (claims.ok) {
        expect(claims.value.length).toBe(2);
        const predicates = claims.value.map((c) => c.data.predicate);
        expect(predicates).toContain('works_for');
        expect(predicates).toContain('job_title');
      }

      // Verify provenance
      const verify = await client.verifyProvenance();
      expect(verify.ok).toBe(true);
      if (verify.ok) {
        expect(verify.value.valid).toBe(true);
      }
    });

    it('creates agents and executes actions', async () => {
      // Create agent
      const agentResult = await client.createAgent({
        name: 'test-agent',
        description: 'Test agent for integration',
      });
      expect(agentResult.ok).toBe(true);
      if (!agentResult.ok) return;

      // Register handler
      let handlerCalled = false;
      client.registerHandler('execute', 'test_resource', async () => {
        handlerCalled = true;
        return ok({ result: 'ok' });
      });

      // Execute action
      const execResult = await client.execute({
        agentId: agentResult.value.data.id,
        action: 'execute',
        resourceType: 'test_resource',
        parameters: { foo: 'bar' },
      });

      expect(execResult.ok).toBe(true);
      expect(handlerCalled).toBe(true);

      // Check audit trail
      const audit = await client.getAuditTrail({ limit: 5 });
      expect(audit.ok).toBe(true);
      if (audit.ok) {
        expect(audit.value.length).toBeGreaterThan(0);
      }
    });

    it('records and retrieves decisions', async () => {
      // Create proposer agent
      const agent = await client.createAgent({ name: 'proposer' });
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      // Record decision
      const decision = await client.recordDecision({
        type: 'workflow_step',
        title: 'Deploy new feature',
        proposedBy: agent.value.data.id,
        description: 'Deploy the new dashboard feature',
        riskLevel: 'medium',
      });

      expect(decision.ok).toBe(true);
      if (!decision.ok) return;

      expect(decision.value.data.status).toBe('proposed');
      expect(decision.value.data.riskLevel).toBe('medium');

      // Get pending decisions
      const pending = await client.getPendingDecisions();
      expect(pending.ok).toBe(true);
      if (pending.ok) {
        expect(pending.value.some((d) => d.data.id === decision.value.data.id)).toBe(true);
      }
    });

    it('creates and retrieves policies', async () => {
      // Create policy
      const policy = await client.createPolicy({
        name: 'read-access',
        version: '1.0.0',
        description: 'Allow read access to documents',
        effect: 'allow',
        subjects: ['*'],
        actions: ['read'],
        resources: ['document/*'],
        priority: 10,
      });

      expect(policy.ok).toBe(true);
      if (!policy.ok) return;

      expect(policy.value.data.name).toBe('read-access');
      expect(policy.value.data.version).toBe('1.0.0');
    });

    it('assembles context for entities', async () => {
      // Create entity with claims
      const entity = await client.createEntity({
        type: 'product',
        name: 'Widget Pro',
      });
      expect(entity.ok).toBe(true);
      if (!entity.ok) return;

      await client.addClaim({
        subjectId: entity.value.data.id,
        predicate: 'price',
        value: 99.99,
      });

      await client.addClaim({
        subjectId: entity.value.data.id,
        predicate: 'category',
        value: 'electronics',
      });

      // Assemble context
      const context = await client.assembleContext(entity.value.data.id);
      expect(context.ok).toBe(true);
      if (context.ok) {
        expect(context.value.entities.length).toBeGreaterThan(0);
        expect(context.value.claims.length).toBe(2);
      }
    });
  });

  describe('CLI Integration', () => {
    it('inspector returns system stats', async () => {
      const inspector = new GraphInspector(client, {
        formatOptions: { colors: false },
      });

      const result = await inspector.getStats();
      expect(result.success).toBe(true);
      expect(result.output).toContain('Statistics');
    });

    it('REPL executes commands', async () => {
      const repl = new ContextGraphRepl(client, { colors: false });
      const output: string[] = [];
      repl.print = (msg: string) => { output.push(msg); };

      await repl.execute('stats');
      expect(output.some((o) => o.includes('Statistics'))).toBe(true);
    });
  });

  describe('Event System', () => {
    it('emits events on entity creation', async () => {
      const events: string[] = [];

      client.on('entity:created', () => {
        events.push('entity:created');
      });

      await client.createEntity({ type: 'test', name: 'Event Test' });

      expect(events).toContain('entity:created');
    });

    it('emits events on claim addition', async () => {
      const events: string[] = [];

      client.on('claim:added', () => {
        events.push('claim:added');
      });

      const entity = await client.createEntity({ type: 'test', name: 'E' });
      if (!entity.ok) return;

      await client.addClaim({
        subjectId: entity.value.data.id,
        predicate: 'test',
        value: 'value',
      });

      expect(events).toContain('claim:added');
    });

    it('supports event unsubscription', async () => {
      let count = 0;
      const handler = () => { count++; };

      client.on('entity:created', handler);
      await client.createEntity({ type: 'test', name: 'First' });
      expect(count).toBe(1);

      client.off('entity:created', handler);
      await client.createEntity({ type: 'test', name: 'Second' });
      expect(count).toBe(1);
    });
  });

  describe('Data Integrity', () => {
    it('maintains provenance chain integrity', async () => {
      // Create multiple entities and claims
      for (let i = 0; i < 5; i++) {
        const entity = await client.createEntity({
          type: 'test',
          name: `Entity ${i}`,
        });
        if (entity.ok) {
          await client.addClaim({
            subjectId: entity.value.data.id,
            predicate: 'index',
            value: i,
          });
        }
      }

      // Verify chain
      const verify = await client.verifyProvenance();
      expect(verify.ok).toBe(true);
      if (verify.ok) {
        expect(verify.value.valid).toBe(true);
        expect(verify.value.entriesVerified).toBeGreaterThan(0);
        expect(verify.value.brokenLinks).toHaveLength(0);
        expect(verify.value.invalidHashes).toHaveLength(0);
      }
    });

    it('tracks claim provenance', async () => {
      const entity = await client.createEntity({
        type: 'tracked',
        name: 'Tracked Entity',
      });
      expect(entity.ok).toBe(true);
      if (!entity.ok) return;

      const claim = await client.addClaim({
        subjectId: entity.value.data.id,
        predicate: 'tracked_value',
        value: 'test',
      });

      expect(claim.ok).toBe(true);
      if (!claim.ok) return;

      // Claim should have provenance ID
      expect(claim.value.data.provenanceId).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('returns accurate statistics', async () => {
      // Create some data
      await client.createEntity({ type: 'stats_test', name: 'E1' });
      await client.createEntity({ type: 'stats_test', name: 'E2' });
      await client.createAgent({ name: 'stats-agent' });

      const stats = await client.getStats();
      expect(stats.ok).toBe(true);
      if (stats.ok) {
        expect(stats.value.entities).toBeGreaterThanOrEqual(2);
        expect(stats.value.agents).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
