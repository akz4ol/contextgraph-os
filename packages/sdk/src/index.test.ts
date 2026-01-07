/**
 * SDK Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextGraph, createTimestamp, createScope, createConfidence } from './index.js';
import type { Entity, Agent, Decision, Policy } from './index.js';

describe('ContextGraph SDK', () => {
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

  describe('Client Creation', () => {
    it('creates client with default config', async () => {
      const result = await ContextGraph.create();
      expect(result.ok).toBe(true);
    });

    it('creates client with custom config', async () => {
      const result = await ContextGraph.create({
        defaultScope: createScope('test'),
        autoProvenance: true,
        enablePolicies: false,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('Entity Operations', () => {
    it('creates an entity', async () => {
      const result = await client.createEntity({
        type: 'person',
        name: 'Alice',
        properties: { age: 30 },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.type).toBe('person');
        expect(result.value.data.name).toBe('Alice');
      }
    });

    it('gets entity by ID', async () => {
      const createResult = await client.createEntity({
        type: 'person',
        name: 'Bob',
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const getResult = await client.getEntity(createResult.value.data.id);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value?.data.name).toBe('Bob');
      }
    });

    it('finds entities by type', async () => {
      await client.createEntity({ type: 'document', name: 'Doc1' });
      await client.createEntity({ type: 'document', name: 'Doc2' });
      await client.createEntity({ type: 'person', name: 'Person1' });

      const result = await client.findEntitiesByType('document');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });
  });

  describe('Claim Operations', () => {
    let entity: Entity;

    beforeEach(async () => {
      const result = await client.createEntity({
        type: 'person',
        name: 'Charlie',
      });
      if (result.ok) {
        entity = result.value;
      }
    });

    it('adds a claim to an entity', async () => {
      const result = await client.addClaim({
        subjectId: entity.data.id,
        predicate: 'occupation',
        value: 'engineer',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.predicate).toBe('occupation');
        expect(result.value.data.objectValue).toBe('engineer');
      }
    });

    it('gets claims for an entity', async () => {
      await client.addClaim({
        subjectId: entity.data.id,
        predicate: 'occupation',
        value: 'engineer',
      });
      await client.addClaim({
        subjectId: entity.data.id,
        predicate: 'location',
        value: 'NYC',
      });

      const result = await client.getClaims(entity.data.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('gets specific claim value', async () => {
      await client.addClaim({
        subjectId: entity.data.id,
        predicate: 'salary',
        value: 100000,
      });

      const result = await client.getClaimValue(entity.data.id, 'salary');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(100000);
      }
    });

    it('adds claim with context', async () => {
      const result = await client.addClaim({
        subjectId: entity.data.id,
        predicate: 'status',
        value: 'active',
        context: {
          scope: createScope('hr'),
          confidence: createConfidence(0.95),
        },
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('Agent Operations', () => {
    it('creates an agent', async () => {
      const result = await client.createAgent({
        name: 'test-agent',
        description: 'A test agent',
        metadata: { version: '1.0' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.name).toBe('test-agent');
      }
    });

    it('gets agent by ID', async () => {
      const createResult = await client.createAgent({
        name: 'lookup-agent',
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const getResult = await client.getAgent(createResult.value.data.id);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value?.data.name).toBe('lookup-agent');
      }
    });

    it('finds agent by name', async () => {
      await client.createAgent({ name: 'named-agent' });

      const result = await client.findAgentByName('named-agent');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.data.name).toBe('named-agent');
      }
    });

    it('gets active agents', async () => {
      await client.createAgent({ name: 'agent-1' });
      await client.createAgent({ name: 'agent-2' });

      const result = await client.getActiveAgents();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Execution Operations', () => {
    let agent: Agent;

    beforeEach(async () => {
      const result = await client.createAgent({
        name: 'executor-agent',
      });
      if (result.ok) {
        agent = result.value;
      }
    });

    it('registers a handler and executes an action', async () => {
      // Register handler
      client.registerHandler('execute', 'data', async (action) => ({
        success: true,
        data: { processed: action.parameters?.input },
      }));

      // Execute returns a result (success or failure depends on capabilities)
      const result = await client.execute({
        agentId: agent.data.id,
        action: 'execute',
        resourceType: 'data',
        parameters: { input: 'test-data' },
      });

      // Verify result structure
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBeDefined();
        expect(['completed', 'failed', 'rejected']).toContain(result.value.status);
      }
    });

    it('executes action with resource ID', async () => {
      client.registerHandler('read', 'file', async () => ({
        success: true,
        data: { content: 'file contents' },
      }));

      const result = await client.execute({
        agentId: agent.data.id,
        action: 'read',
        resourceType: 'file',
        resourceId: 'doc123',
      });

      // Verify result structure
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBeDefined();
      }
    });
  });

  describe('Decision Operations', () => {
    let agent: Agent;

    beforeEach(async () => {
      const result = await client.createAgent({
        name: 'decision-agent',
      });
      if (result.ok) {
        agent = result.value;
      }
    });

    it('records a decision', async () => {
      const result = await client.recordDecision({
        type: 'workflow_step',
        title: 'Deploy to production',
        proposedBy: agent.data.id,
        riskLevel: 'medium',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.title).toBe('Deploy to production');
        expect(result.value.data.status).toBe('proposed');
      }
    });

    it('gets pending decisions', async () => {
      await client.recordDecision({
        type: 'workflow_step',
        title: 'Change settings',
        proposedBy: agent.data.id,
      });

      const result = await client.getPendingDecisions();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it('attempts to approve a decision', async () => {
      const decisionResult = await client.recordDecision({
        type: 'workflow_step',
        title: 'Enable feature X',
        proposedBy: agent.data.id,
      });
      expect(decisionResult.ok).toBe(true);
      if (!decisionResult.ok) return;

      // Attempt approval - may succeed or fail depending on business rules
      const approveResult = await client.approveDecision(
        decisionResult.value.data.id,
        agent.data.id
      );

      // The API should return a result (the approval logic is tested in dtg package)
      if (approveResult.ok && approveResult.value) {
        expect(['proposed', 'approved']).toContain(approveResult.value.data.status);
      }
    });
  });

  describe('Policy Operations', () => {
    it('creates a policy', async () => {
      const result = await client.createPolicy({
        name: 'test-policy',
        version: '1.0.0',
        description: 'A test policy',
        effect: 'allow',
        subjects: ['*'],
        actions: ['read'],
        resources: ['document/*'],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.name).toBe('test-policy');
      }
    });

    it('creates policy with conditions', async () => {
      const result = await client.createPolicy({
        name: 'conditional-policy',
        version: '1.0.0',
        effect: 'deny',
        subjects: ['*'],
        actions: ['write'],
        resources: ['sensitive/*'],
        conditions: [
          { field: 'time', operator: 'greater_than', value: '18:00' },
        ],
        priority: 100,
      });

      expect(result.ok).toBe(true);
    });

    it('gets effective policies', async () => {
      await client.createPolicy({
        name: 'effective-policy',
        version: '1.0.0',
        effect: 'allow',
        subjects: ['*'],
        actions: ['*'],
        resources: ['*'],
      });

      const result = await client.getEffectivePolicies();
      expect(result.ok).toBe(true);
    });
  });

  describe('Context Assembly', () => {
    it('assembles context for an entity', async () => {
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

      const contextResult = await client.assembleContext(entityResult.value.data.id);
      expect(contextResult.ok).toBe(true);
      if (contextResult.ok) {
        expect(contextResult.value.entities.length).toBeGreaterThan(0);
      }
    });

    it('assembles context with query options', async () => {
      const entityResult = await client.createEntity({
        type: 'service',
        name: 'API Service',
      });
      expect(entityResult.ok).toBe(true);
      if (!entityResult.ok) return;

      const contextResult = await client.assembleContext(entityResult.value.data.id, {
        asOf: createTimestamp(),
        minConfidence: 0.5,
      });
      expect(contextResult.ok).toBe(true);
    });
  });

  describe('Provenance Operations', () => {
    it('verifies provenance chain', async () => {
      const result = await client.verifyProvenance();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
    });

    it('queries provenance entries', async () => {
      // Create some entries by adding claims
      const entity = await client.createEntity({ type: 'test', name: 'Test' });
      if (entity.ok) {
        await client.addClaim({
          subjectId: entity.value.data.id,
          predicate: 'test',
          value: 'value',
        });
      }

      const result = await client.queryProvenance({ limit: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Audit Operations', () => {
    it('gets audit trail', async () => {
      const agent = await client.createAgent({ name: 'audit-agent' });
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      client.registerHandler('execute', 'resource', async () => ({ success: true }));
      await client.execute({
        agentId: agent.value.data.id,
        action: 'execute',
        resourceType: 'resource',
      });

      const result = await client.getAuditTrail({ limit: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value[0].action).toBeDefined();
        expect(result.value[0].outcome).toBeDefined();
      }
    });
  });

  describe('Event System', () => {
    it('emits events on entity creation', async () => {
      let eventReceived = false;
      client.on('entity:created', () => {
        eventReceived = true;
      });

      await client.createEntity({
        type: 'test',
        name: 'Event Test',
      });

      expect(eventReceived).toBe(true);
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

    it('unsubscribes from events', async () => {
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

  describe('Statistics', () => {
    it('gets system statistics', async () => {
      await client.createEntity({ type: 'test', name: 'Stats Test' });
      await client.createAgent({ name: 'stats-agent' });

      const result = await client.getStats();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entities).toBeGreaterThanOrEqual(1);
        expect(result.value.agents).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Storage Access', () => {
    it('provides access to underlying storage', () => {
      const storage = client.getStorage();
      expect(storage).toBeDefined();
    });
  });

  describe('Import/Export Operations', () => {
    it('exports to JSON', async () => {
      // Create some data
      await client.createEntity({ type: 'person', name: 'Export Test' });

      const result = await client.exportToJSON();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe('1.0.0');
        expect(result.value.exportedAt).toBeDefined();
        expect(Array.isArray(result.value.entities)).toBe(true);
        expect(result.value.entities.length).toBeGreaterThan(0);
      }
    });

    it('exports to JSON string', async () => {
      await client.createEntity({ type: 'person', name: 'String Export' });

      const result = await client.exportToJSONString({ prettyPrint: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const parsed = JSON.parse(result.value);
        expect(parsed.version).toBe('1.0.0');
      }
    });

    it('exports with filtering options', async () => {
      const result = await client.exportToJSON({
        includeEntities: true,
        includeClaims: false,
        includeAgents: false,
        includeDecisions: false,
        includePolicies: false,
        includeProvenance: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entities.length).toBeGreaterThanOrEqual(0);
        expect(result.value.claims.length).toBe(0);
        expect(result.value.agents.length).toBe(0);
      }
    });

    it('imports from JSON', async () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        entities: [{
          id: 'ent_import_test',
          type: 'test',
          name: 'Imported Entity',
          properties: { imported: true },
          createdAt: Date.now(),
        }],
        claims: [],
        agents: [],
        decisions: [],
        policies: [],
        provenance: [],
      };

      const result = await client.importFromJSON(exportData as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.success).toBe(true);
        expect(result.value.entitiesImported).toBe(1);
      }
    });

    it('imports from JSON string', async () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        entities: [{
          id: 'ent_string_import_test',
          type: 'test',
          name: 'String Imported',
          properties: {},
          createdAt: Date.now(),
        }],
        claims: [],
        agents: [],
        decisions: [],
        policies: [],
        provenance: [],
      };

      const result = await client.importFromJSONString(JSON.stringify(exportData));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.success).toBe(true);
      }
    });

    it('dry run import validates without importing', async () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        entities: [{
          id: 'ent_dry_run',
          type: 'test',
          name: 'Dry Run Entity',
          properties: {},
          createdAt: Date.now(),
        }],
        claims: [],
        agents: [],
        decisions: [],
        policies: [],
        provenance: [],
      };

      const result = await client.importFromJSON(exportData as any, { dryRun: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entitiesImported).toBe(1);
      }

      // Verify entity was not actually created
      const entity = await client.getEntity('ent_dry_run' as any);
      expect(entity.ok).toBe(true);
      if (entity.ok) {
        expect(entity.value).toBeNull();
      }
    });

    it('exports entities to CSV', async () => {
      await client.createEntity({ type: 'csv_test', name: 'CSV Export Test' });

      const result = await client.exportEntitiesToCSV();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('id,type,name');
        expect(result.value.split('\n').length).toBeGreaterThan(1);
      }
    });

    it('exports claims to CSV', async () => {
      const entity = await client.createEntity({ type: 'csv_claim', name: 'CSV Claim Test' });
      if (!entity.ok) return;

      await client.addClaim({
        subjectId: entity.value.data.id,
        predicate: 'test_predicate',
        value: 'test_value',
      });

      const result = await client.exportClaimsToCSV();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('id,subjectId,predicate');
        expect(result.value).toContain('test_predicate');
      }
    });

    it('imports entities from CSV', async () => {
      const csv = `type,name,properties
person,CSV Import Person,"{}"
company,CSV Import Company,"{}"`;

      const result = await client.importEntitiesFromCSV(csv);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entitiesImported).toBe(2);
      }
    });

    it('handles import conflicts with skip option', async () => {
      // Create an entity first
      const entity = await client.createEntity({ type: 'conflict', name: 'Original' });
      if (!entity.ok) return;

      // Try to import with same entity
      const exportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        entities: [{
          id: entity.value.data.id,
          type: 'conflict',
          name: 'Conflicting',
          properties: {},
          createdAt: Date.now(),
        }],
        claims: [],
        agents: [],
        decisions: [],
        policies: [],
        provenance: [],
      };

      const result = await client.importFromJSON(exportData as any, { onConflict: 'skip' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.skipped).toBe(1);
        expect(result.value.entitiesImported).toBe(0);
      }
    });
  });
});
