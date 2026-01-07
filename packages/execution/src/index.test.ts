/**
 * Execution Package Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Execution,
  Executor,
  type ExecutionRequest,
  type ActionDefinition,
  type ActionHandler,
} from './index.js';
import { ok, err, createTimestamp } from '@contextgraph/core';
import { InMemoryStorage } from '@contextgraph/storage';
import { AgentRegistry, CapabilityRegistry, BUILTIN_CAPABILITIES } from '@contextgraph/agent';
import { PolicyLedger } from '@contextgraph/policy';
import { DecisionTraceGraph } from '@contextgraph/dtg';
import { ProvenanceLedger } from '@contextgraph/provenance';
import type { AgentId } from '@contextgraph/agent';
import type { EntityId } from '@contextgraph/core';

describe('Execution', () => {
  const validAction: ActionDefinition = {
    type: 'read',
    resourceType: 'document',
    resourceId: 'doc_123',
    description: 'Read a document',
  };

  describe('create', () => {
    it('should create a new execution', () => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: validAction,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.id).toMatch(/^exec_/);
        expect(result.value.data.agentId).toBe('agent_001');
        expect(result.value.data.action).toEqual(validAction);
        expect(result.value.data.status).toBe('pending');
      }
    });

    it('should include optional fields', () => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: validAction,
        contextId: 'ctx_123',
        requestedBy: 'user_001' as EntityId,
        metadata: { source: 'test' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.contextId).toBe('ctx_123');
        expect(result.value.data.requestedBy).toBe('user_001');
        expect(result.value.data.metadata).toEqual({ source: 'test' });
      }
    });

    it('should reject missing action type', () => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: { type: '' as any, resourceType: 'document' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('type');
      }
    });

    it('should reject missing resource type', () => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: { type: 'read', resourceType: '' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Resource type');
      }
    });
  });

  describe('lifecycle transitions', () => {
    let execution: Execution;

    beforeEach(() => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: validAction,
      });
      if (!result.ok) throw new Error('Failed to create execution');
      execution = result.value;
    });

    describe('start', () => {
      it('should transition from pending to executing', () => {
        const result = execution.start();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('executing');
          expect(result.value.data.startedAt).toBeDefined();
        }
      });

      it('should transition from approved to executing', () => {
        const approved = execution.approve('approver_001' as EntityId);
        if (!approved.ok) throw new Error('Failed to approve');

        const result = approved.value.start();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('executing');
        }
      });

      it('should include decision ID if provided', () => {
        const result = execution.start('dec_123' as any);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.decisionId).toBe('dec_123');
        }
      });

      it('should reject start from completed state', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const completed = started.value.complete();
        if (!completed.ok) throw new Error('Failed to complete');

        const result = completed.value.start();
        expect(result.ok).toBe(false);
      });
    });

    describe('complete', () => {
      it('should transition from executing to completed', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const result = started.value.complete({ result: 'success' });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('completed');
          expect(result.value.data.output).toEqual({ result: 'success' });
          expect(result.value.data.completedAt).toBeDefined();
        }
      });

      it('should complete without output', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const result = started.value.complete();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.output).toBeUndefined();
        }
      });

      it('should reject complete from pending state', () => {
        const result = execution.complete();
        expect(result.ok).toBe(false);
      });
    });

    describe('fail', () => {
      it('should transition from executing to failed', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const result = started.value.fail('Something went wrong');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('failed');
          expect(result.value.data.error).toBe('Something went wrong');
          expect(result.value.data.completedAt).toBeDefined();
        }
      });

      it('should reject fail from pending state', () => {
        const result = execution.fail('error');
        expect(result.ok).toBe(false);
      });
    });

    describe('approve', () => {
      it('should transition from pending to approved', () => {
        const result = execution.approve('approver_001' as EntityId);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('approved');
          expect(result.value.data.approvedBy).toBe('approver_001');
        }
      });

      it('should reject approve from executing state', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const result = started.value.approve('approver_001' as EntityId);
        expect(result.ok).toBe(false);
      });
    });

    describe('reject', () => {
      it('should transition from pending to rejected', () => {
        const result = execution.reject('Not allowed');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('rejected');
          expect(result.value.data.error).toBe('Not allowed');
        }
      });

      it('should reject rejection from executing state', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const result = started.value.reject('reason');
        expect(result.ok).toBe(false);
      });
    });

    describe('cancel', () => {
      it('should cancel pending execution', () => {
        const result = execution.cancel();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('cancelled');
        }
      });

      it('should cancel executing execution', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const result = started.value.cancel();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.data.status).toBe('cancelled');
        }
      });

      it('should reject cancel of completed execution', () => {
        const started = execution.start();
        if (!started.ok) throw new Error('Failed to start');

        const completed = started.value.complete();
        if (!completed.ok) throw new Error('Failed to complete');

        const result = completed.value.cancel();
        expect(result.ok).toBe(false);
      });
    });
  });

  describe('status helpers', () => {
    it('should identify terminal states', () => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: validAction,
      });
      if (!result.ok) throw new Error('Failed to create');

      expect(result.value.isTerminal()).toBe(false);

      const started = result.value.start();
      if (!started.ok) throw new Error('Failed to start');

      const completed = started.value.complete();
      if (!completed.ok) throw new Error('Failed to complete');

      expect(completed.value.isTerminal()).toBe(true);
    });

    it('should calculate duration', () => {
      const result = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: validAction,
      });
      if (!result.ok) throw new Error('Failed to create');

      expect(result.value.getDurationMs()).toBeUndefined();

      const started = result.value.start();
      if (!started.ok) throw new Error('Failed to start');

      const completed = started.value.complete();
      if (!completed.ok) throw new Error('Failed to complete');

      expect(completed.value.getDurationMs()).toBeDefined();
      expect(completed.value.getDurationMs()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('serialization', () => {
    it('should round-trip through record', () => {
      const createResult = Execution.create({
        agentId: 'agent_001' as AgentId,
        action: validAction,
        contextId: 'ctx_123',
        requestedBy: 'user_001' as EntityId,
        metadata: { key: 'value' },
      });
      if (!createResult.ok) throw new Error('Failed to create');

      const record = createResult.value.toRecord();
      const restored = Execution.fromRecord(record);

      expect(restored.data.id).toBe(createResult.value.data.id);
      expect(restored.data.agentId).toBe(createResult.value.data.agentId);
      expect(restored.data.action).toEqual(createResult.value.data.action);
      expect(restored.data.status).toBe(createResult.value.data.status);
      expect(restored.data.contextId).toBe(createResult.value.data.contextId);
      expect(restored.data.requestedBy).toBe(createResult.value.data.requestedBy);
      expect(restored.data.metadata).toEqual(createResult.value.data.metadata);
    });
  });
});

describe('Executor', () => {
  let storage: InMemoryStorage;
  let agentRegistry: AgentRegistry;
  let capabilityRegistry: CapabilityRegistry;
  let policyLedger: PolicyLedger;
  let decisionGraph: DecisionTraceGraph;
  let provenanceLedger: ProvenanceLedger;
  let executor: Executor;
  let testAgentId: AgentId;
  let readCapId: string;
  let writeCapId: string;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();

    agentRegistry = new AgentRegistry(storage);
    capabilityRegistry = new CapabilityRegistry();
    policyLedger = new PolicyLedger(storage);
    provenanceLedger = new ProvenanceLedger(storage);
    await provenanceLedger.initialize();
    decisionGraph = new DecisionTraceGraph(storage, provenanceLedger);

    // Register built-in capabilities and get their IDs
    const readCapResult = capabilityRegistry.register(BUILTIN_CAPABILITIES.READ_DATA);
    const writeCapResult = capabilityRegistry.register(BUILTIN_CAPABILITIES.WRITE_DATA);
    if (!readCapResult.ok || !writeCapResult.ok) throw new Error('Failed to register capabilities');
    readCapId = readCapResult.value.id;
    writeCapId = writeCapResult.value.id;

    // Create test agent
    const agentResult = await agentRegistry.create({
      name: 'Test Agent',
      type: 'assistant',
    });
    if (!agentResult.ok) throw new Error('Failed to create agent');
    testAgentId = agentResult.value.data.id;

    // Create executor with capability check disabled (for simplicity in basic tests)
    // The capability checking tests explicitly test this functionality
    executor = new Executor({
      storage,
      agentRegistry,
      capabilityRegistry,
      policyLedger,
      decisionGraph,
      provenanceLedger,
      requireCapabilityCheck: false,
    });
  });

  describe('execute', () => {
    it('should execute a valid action', async () => {
      const request: ExecutionRequest = {
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'document',
          resourceId: 'doc_123',
        },
      };

      const result = await executor.execute(request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('completed');
        expect(result.value.executionId).toMatch(/^exec_/);
      }
    });

    it('should execute with registered handler', async () => {
      const handler: ActionHandler = async (action, context) => {
        return ok({ read: action.resourceId, by: context.agentId });
      };

      executor.registerHandler('read', 'document', handler);

      const request: ExecutionRequest = {
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'document',
          resourceId: 'doc_123',
        },
      };

      const result = await executor.execute(request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('completed');
        expect(result.value.output).toEqual({
          read: 'doc_123',
          by: testAgentId,
        });
      }
    });

    it('should handle handler errors', async () => {
      const handler: ActionHandler = async () => {
        return err(new Error('Handler failed'));
      };

      executor.registerHandler('read', 'document', handler);

      const request: ExecutionRequest = {
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'document',
          resourceId: 'doc_123',
        },
      };

      const result = await executor.execute(request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('failed');
        expect(result.value.error).toBe('Handler failed');
      }
    });

    it('should handle handler exceptions', async () => {
      const handler: ActionHandler = async () => {
        throw new Error('Unexpected error');
      };

      executor.registerHandler('read', 'document', handler);

      const request: ExecutionRequest = {
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'document',
          resourceId: 'doc_123',
        },
      };

      const result = await executor.execute(request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('failed');
        expect(result.value.error).toBe('Unexpected error');
      }
    });

    it('should reject unknown agent', async () => {
      const request: ExecutionRequest = {
        agentId: 'unknown_agent' as AgentId,
        action: {
          type: 'read',
          resourceType: 'document',
        },
      };

      const result = await executor.execute(request);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Agent not found');
      }
    });
  });

  describe('capability checking', () => {
    it('should reject action without matching capability', async () => {
      // Create an executor with capability check enabled
      const capCheckExecutor = new Executor({
        storage,
        agentRegistry,
        capabilityRegistry,
        policyLedger,
        decisionGraph,
        provenanceLedger,
        requireCapabilityCheck: true,
      });

      // Create agent without any capabilities
      const limitedAgentResult = await agentRegistry.create({
        name: 'Read Only Agent',
        type: 'assistant',
      });
      if (!limitedAgentResult.ok) throw new Error('Failed to create');
      const limitedAgent = limitedAgentResult.value;

      // Try to use any action (agent has no capabilities)
      const request: ExecutionRequest = {
        agentId: limitedAgent.data.id,
        action: {
          type: 'execute',
          resourceType: 'document',
        },
      };

      const result = await capCheckExecutor.execute(request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('rejected');
        expect(result.value.error).toContain('capability');
      }
    });

    it('should skip capability check when disabled', async () => {
      const noCapCheckExecutor = new Executor({
        storage,
        agentRegistry,
        capabilityRegistry,
        policyLedger,
        decisionGraph,
        provenanceLedger,
        requireCapabilityCheck: false,
      });

      const limitedAgentResult = await agentRegistry.create({
        name: 'No Caps Agent',
        type: 'assistant',
        capabilities: [],
      });
      if (!limitedAgentResult.ok) throw new Error('Failed to create');
      const limitedAgent = limitedAgentResult.value;

      const request: ExecutionRequest = {
        agentId: limitedAgent.data.id,
        action: {
          type: 'execute',
          resourceType: 'document',
        },
      };

      const result = await noCapCheckExecutor.execute(request);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('completed');
      }
    });
  });

  describe('query', () => {
    it('should query executions by agent', async () => {
      // Execute a few actions
      for (let i = 0; i < 3; i++) {
        await executor.execute({
          agentId: testAgentId,
          action: {
            type: 'read',
            resourceType: 'document',
            resourceId: `doc_${i}`,
          },
        });
      }

      const result = await executor.query({ agentId: testAgentId });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
      }
    });

    it('should query executions with limit', async () => {
      for (let i = 0; i < 5; i++) {
        await executor.execute({
          agentId: testAgentId,
          action: {
            type: 'read',
            resourceType: 'document',
          },
        });
      }

      const result = await executor.query({ limit: 2 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });
  });

  describe('findById', () => {
    it('should find execution by ID', async () => {
      const execResult = await executor.execute({
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'document',
        },
      });

      if (!execResult.ok) throw new Error('Failed to execute');

      const findResult = await executor.findById(execResult.value.executionId);
      expect(findResult.ok).toBe(true);
      if (findResult.ok) {
        expect(findResult.value).not.toBeNull();
        expect(findResult.value?.data.id).toBe(execResult.value.executionId);
      }
    });

    it('should return null for non-existent execution', async () => {
      const result = await executor.findById('exec_nonexistent' as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('wildcard handlers', () => {
    it('should use wildcard handler when specific not found', async () => {
      const handler: ActionHandler = async (action) => {
        return ok({ handled: action.resourceType });
      };

      executor.registerHandler('read', '*', handler);

      const result = await executor.execute({
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'any_resource',
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('completed');
        expect(result.value.output).toEqual({ handled: 'any_resource' });
      }
    });

    it('should prefer specific handler over wildcard', async () => {
      const specificHandler: ActionHandler = async () => ok({ specific: true });
      const wildcardHandler: ActionHandler = async () => ok({ wildcard: true });

      executor.registerHandler('read', 'document', specificHandler);
      executor.registerHandler('read', '*', wildcardHandler);

      const result = await executor.execute({
        agentId: testAgentId,
        action: {
          type: 'read',
          resourceType: 'document',
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.output).toEqual({ specific: true });
      }
    });
  });
});
