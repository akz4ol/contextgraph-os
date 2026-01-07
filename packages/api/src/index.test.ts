/**
 * API Tests
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { ContextGraph } from '@contextgraph/sdk';
import { createApp } from './server.js';

describe('ContextGraph API', () => {
  let app: Express;
  let client: ContextGraph;

  beforeAll(async () => {
    const result = await ContextGraph.create({
      enablePolicies: false,
      enableCapabilities: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      client = result.value;
    }
  });

  beforeEach(async () => {
    app = await createApp(client, { logging: false });
  });

  describe('System Endpoints', () => {
    it('GET /api/v1/health returns healthy status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('GET /api/v1/stats returns statistics', async () => {
      const res = await request(app).get('/api/v1/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('entities');
      expect(res.body.data).toHaveProperty('claims');
      expect(res.body.data).toHaveProperty('agents');
    });

    it('GET /api/v1/audit returns audit trail', async () => {
      const res = await request(app).get('/api/v1/audit');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/provenance returns provenance entries', async () => {
      const res = await request(app).get('/api/v1/provenance');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/provenance/verify verifies chain', async () => {
      const res = await request(app).post('/api/v1/provenance/verify');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('valid');
    });
  });

  describe('Entity Endpoints', () => {
    it('POST /api/v1/entities creates entity', async () => {
      const res = await request(app)
        .post('/api/v1/entities')
        .send({
          type: 'test',
          name: 'Test Entity',
          properties: { foo: 'bar' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('test');
      expect(res.body.data.name).toBe('Test Entity');
    });

    it('GET /api/v1/entities lists entities', async () => {
      const res = await request(app).get('/api/v1/entities');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/entities?type=test filters by type', async () => {
      // Create a test entity first
      await request(app)
        .post('/api/v1/entities')
        .send({ type: 'filter_test', name: 'Filter Test' });

      const res = await request(app).get('/api/v1/entities?type=filter_test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/entities/:id returns entity', async () => {
      // Create entity first
      const createRes = await request(app)
        .post('/api/v1/entities')
        .send({ type: 'test', name: 'Get Test' });

      const id = createRes.body.data.id;
      const res = await request(app).get(`/api/v1/entities/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(id);
    });

    it('GET /api/v1/entities/:id returns 404 for unknown', async () => {
      const res = await request(app).get('/api/v1/entities/unknown_id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/v1/entities/:id/claims adds claim', async () => {
      // Create entity first
      const createRes = await request(app)
        .post('/api/v1/entities')
        .send({ type: 'test', name: 'Claim Test' });

      const id = createRes.body.data.id;

      const res = await request(app)
        .post(`/api/v1/entities/${id}/claims`)
        .send({
          predicate: 'has_property',
          value: 'test_value',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.predicate).toBe('has_property');
    });

    it('GET /api/v1/entities/:id/claims returns claims', async () => {
      // Create entity and claim
      const createRes = await request(app)
        .post('/api/v1/entities')
        .send({ type: 'test', name: 'Claims List Test' });

      const id = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/entities/${id}/claims`)
        .send({ predicate: 'test_pred', value: 'test_val' });

      const res = await request(app).get(`/api/v1/entities/${id}/claims`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Endpoints', () => {
    it('POST /api/v1/agents creates agent', async () => {
      const res = await request(app)
        .post('/api/v1/agents')
        .send({
          name: 'test-agent',
          description: 'Test agent',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('test-agent');
    });

    it('GET /api/v1/agents lists agents', async () => {
      const res = await request(app).get('/api/v1/agents');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/agents/:id returns agent by ID', async () => {
      // Create agent first
      const createRes = await request(app)
        .post('/api/v1/agents')
        .send({ name: 'get-test-agent' });

      const id = createRes.body.data.id;
      const res = await request(app).get(`/api/v1/agents/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(id);
    });

    it('GET /api/v1/agents/:name returns agent by name', async () => {
      // Create agent with unique name
      const name = `name-lookup-${Date.now()}`;
      await request(app)
        .post('/api/v1/agents')
        .send({ name });

      const res = await request(app).get(`/api/v1/agents/${name}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(name);
    });
  });

  describe('Decision Endpoints', () => {
    it('POST /api/v1/decisions creates decision', async () => {
      // Create agent first
      const agentRes = await request(app)
        .post('/api/v1/agents')
        .send({ name: 'decision-proposer' });

      const res = await request(app)
        .post('/api/v1/decisions')
        .send({
          type: 'workflow_step',
          title: 'Test Decision',
          proposedBy: agentRes.body.data.id,
          riskLevel: 'low',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Decision');
      expect(res.body.data.status).toBe('proposed');
    });

    it('GET /api/v1/decisions lists decisions', async () => {
      const res = await request(app).get('/api/v1/decisions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/decisions/:id/approve approves decision', async () => {
      // Create proposer agent
      const proposerName = `proposer-${Date.now()}`;
      const proposerRes = await request(app)
        .post('/api/v1/agents')
        .send({ name: proposerName });

      // Create approver agent (different from proposer)
      const approverName = `approver-${Date.now()}`;
      const approverRes = await request(app)
        .post('/api/v1/agents')
        .send({ name: approverName });

      const decisionRes = await request(app)
        .post('/api/v1/decisions')
        .send({
          type: 'workflow_step',
          title: 'Approve Test',
          proposedBy: proposerRes.body.data.id,
        });

      const res = await request(app)
        .post(`/api/v1/decisions/${decisionRes.body.data.id}/approve`)
        .send({ approverId: approverRes.body.data.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
    });
  });

  describe('Policy Endpoints', () => {
    it('POST /api/v1/policies creates policy', async () => {
      const res = await request(app)
        .post('/api/v1/policies')
        .send({
          name: 'test-policy',
          version: '1.0.0',
          description: 'Test policy',
          effect: 'allow',
          subjects: ['*'],
          actions: ['read'],
          resources: ['*'],
          priority: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('test-policy');
    });

    it('GET /api/v1/policies lists policies', async () => {
      const res = await request(app).get('/api/v1/policies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('supports limit and offset on entities', async () => {
      const res = await request(app).get('/api/v1/entities?limit=5&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.offset).toBe(0);
    });

    it('supports limit and offset on audit', async () => {
      const res = await request(app).get('/api/v1/audit?limit=10&offset=5');

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(5);
    });
  });

  describe('Validation', () => {
    it('rejects invalid entity creation', async () => {
      const res = await request(app)
        .post('/api/v1/entities')
        .send({ type: '' }); // Empty type

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects invalid decision type', async () => {
      const res = await request(app)
        .post('/api/v1/decisions')
        .send({
          type: 'invalid_type',
          title: 'Test',
          proposedBy: 'agent_123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('returns 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/v1/unknown');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
