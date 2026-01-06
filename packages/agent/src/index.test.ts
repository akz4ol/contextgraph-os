/**
 * Agent Package Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import {
  Agent,
  AgentRegistry,
  CapabilityRegistry,
  ProblemSpaceManager,
  BUILTIN_CAPABILITIES,
  initializeBuiltinCapabilities,
  type CapabilityId,
  type ProblemSpaceId,
} from './index.js';
import type { EntityId } from '@contextgraph/core';

describe('Agent', () => {
  it('creates agent with valid input', () => {
    const result = Agent.create({
      name: 'Test Agent',
      description: 'A test agent',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.name).toBe('Test Agent');
      expect(result.value.data.status).toBe('active');
      expect(result.value.data.capabilities).toHaveLength(0);
    }
  });

  it('rejects empty name', () => {
    const result = Agent.create({ name: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('name is required');
    }
  });

  it('suspends active agent', () => {
    const result = Agent.create({ name: 'Test Agent' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const suspendResult = result.value.suspend();
    expect(suspendResult.ok).toBe(true);
    if (suspendResult.ok) {
      expect(suspendResult.value.data.status).toBe('suspended');
    }
  });

  it('reactivates suspended agent', () => {
    const result = Agent.create({ name: 'Test Agent' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const suspended = result.value.suspend();
    expect(suspended.ok).toBe(true);
    if (!suspended.ok) return;

    const reactivated = suspended.value.reactivate();
    expect(reactivated.ok).toBe(true);
    if (reactivated.ok) {
      expect(reactivated.value.data.status).toBe('active');
    }
  });

  it('revokes agent', () => {
    const result = Agent.create({ name: 'Test Agent' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const revoked = result.value.revoke();
    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      expect(revoked.value.data.status).toBe('revoked');
    }
  });

  it('serializes and deserializes correctly', () => {
    const result = Agent.create({
      name: 'Test Agent',
      description: 'A test agent',
      metadata: { version: '1.0' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const record = result.value.toRecord();
    const restored = Agent.fromRecord(record);

    expect(restored.data.name).toBe('Test Agent');
    expect(restored.data.description).toBe('A test agent');
    expect(restored.data.metadata).toEqual({ version: '1.0' });
  });
});

describe('Agent Capabilities', () => {
  let registry: CapabilityRegistry;
  let capabilityId: CapabilityId;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    const result = registry.register({
      name: 'test_capability',
      category: 'read',
      actions: ['read', 'list'],
      resourceTypes: ['document', 'file'],
    });
    if (result.ok) {
      capabilityId = result.value.id;
    }
  });

  it('grants capability to agent', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const grantResult = agentResult.value.grantCapability({
      capabilityId,
      grantedBy: 'user_123' as EntityId,
    });

    expect(grantResult.ok).toBe(true);
    if (grantResult.ok) {
      expect(grantResult.value.hasCapability(capabilityId)).toBe(true);
    }
  });

  it('revokes capability from agent', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const grantResult = agentResult.value.grantCapability({
      capabilityId,
      grantedBy: 'user_123' as EntityId,
    });
    expect(grantResult.ok).toBe(true);
    if (!grantResult.ok) return;

    const revokeResult = grantResult.value.revokeCapability(capabilityId);
    expect(revokeResult.ok).toBe(true);
    if (revokeResult.ok) {
      expect(revokeResult.value.hasCapability(capabilityId)).toBe(false);
    }
  });

  it('checks capability for action', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const grantResult = agentResult.value.grantCapability({
      capabilityId,
      grantedBy: 'user_123' as EntityId,
    });
    expect(grantResult.ok).toBe(true);
    if (!grantResult.ok) return;

    const checkResult = grantResult.value.checkCapability(
      { action: 'read', resourceType: 'document' },
      registry
    );

    expect(checkResult.allowed).toBe(true);
  });

  it('rejects unauthorized action', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const grantResult = agentResult.value.grantCapability({
      capabilityId,
      grantedBy: 'user_123' as EntityId,
    });
    expect(grantResult.ok).toBe(true);
    if (!grantResult.ok) return;

    const checkResult = grantResult.value.checkCapability(
      { action: 'delete', resourceType: 'document' },
      registry
    );

    expect(checkResult.allowed).toBe(false);
  });
});

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  it('registers capability', () => {
    const result = registry.register({
      name: 'test_cap',
      category: 'read',
      actions: ['read'],
      resourceTypes: ['document'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('test_cap');
      expect(result.value.category).toBe('read');
    }
  });

  it('rejects duplicate name', () => {
    registry.register({
      name: 'test_cap',
      category: 'read',
      actions: ['read'],
      resourceTypes: ['document'],
    });

    const duplicate = registry.register({
      name: 'test_cap',
      category: 'write',
      actions: ['write'],
      resourceTypes: ['document'],
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.message).toContain('already exists');
    }
  });

  it('finds capability by name', () => {
    registry.register({
      name: 'test_cap',
      category: 'read',
      actions: ['read'],
      resourceTypes: ['document'],
    });

    const found = registry.findByName('test_cap');
    expect(found).toBeDefined();
    expect(found?.name).toBe('test_cap');
  });

  it('finds capabilities by category', () => {
    registry.register({
      name: 'read_cap',
      category: 'read',
      actions: ['read'],
      resourceTypes: ['document'],
    });

    registry.register({
      name: 'write_cap',
      category: 'write',
      actions: ['write'],
      resourceTypes: ['document'],
    });

    const readCaps = registry.findByCategory('read');
    expect(readCaps).toHaveLength(1);
    expect(readCaps[0]!.name).toBe('read_cap');
  });

  it('checks action permission', () => {
    const result = registry.register({
      name: 'test_cap',
      category: 'read',
      actions: ['read', 'list'],
      resourceTypes: ['document', 'file'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(registry.checkAction(result.value.id, 'read', 'document')).toBe(true);
    expect(registry.checkAction(result.value.id, 'delete', 'document')).toBe(false);
    expect(registry.checkAction(result.value.id, 'read', 'database')).toBe(false);
  });

  it('initializes builtin capabilities', () => {
    initializeBuiltinCapabilities(registry);

    expect(registry.count()).toBe(Object.keys(BUILTIN_CAPABILITIES).length);
    expect(registry.findByName('read_data')).toBeDefined();
    expect(registry.findByName('execute_code')).toBeDefined();
  });
});

describe('ProblemSpaceManager', () => {
  let manager: ProblemSpaceManager;

  beforeEach(() => {
    manager = new ProblemSpaceManager();
  });

  it('creates problem space', () => {
    const result = manager.create({
      name: 'Data Processing',
      description: 'Data processing domain',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Data Processing');
    }
  });

  it('rejects duplicate name', () => {
    manager.create({ name: 'Test Space' });

    const duplicate = manager.create({ name: 'Test Space' });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.message).toContain('already exists');
    }
  });

  it('adds nodes to problem space', () => {
    const spaceResult = manager.create({ name: 'Test Space' });
    expect(spaceResult.ok).toBe(true);
    if (!spaceResult.ok) return;

    const nodeResult = manager.addNode(spaceResult.value.id, {
      id: 'node-1',
      type: 'domain',
      name: 'Main Domain',
    });

    expect(nodeResult.ok).toBe(true);
    if (nodeResult.ok) {
      expect(nodeResult.value.nodes).toHaveLength(1);
      expect(nodeResult.value.rootNodeIds).toContain('node-1');
    }
  });

  it('adds child nodes', () => {
    const spaceResult = manager.create({ name: 'Test Space' });
    expect(spaceResult.ok).toBe(true);
    if (!spaceResult.ok) return;

    manager.addNode(spaceResult.value.id, {
      id: 'parent',
      type: 'domain',
      name: 'Parent Domain',
    });

    const childResult = manager.addNode(spaceResult.value.id, {
      id: 'child',
      type: 'task',
      name: 'Child Task',
      parentId: 'parent',
    });

    expect(childResult.ok).toBe(true);
    if (childResult.ok) {
      expect(childResult.value.nodes).toHaveLength(2);
      expect(childResult.value.rootNodeIds).not.toContain('child');
    }
  });

  it('gets children of a node', () => {
    const spaceResult = manager.create({ name: 'Test Space' });
    expect(spaceResult.ok).toBe(true);
    if (!spaceResult.ok) return;

    manager.addNode(spaceResult.value.id, {
      id: 'parent',
      type: 'domain',
      name: 'Parent',
    });

    manager.addNode(spaceResult.value.id, {
      id: 'child1',
      type: 'task',
      name: 'Child 1',
      parentId: 'parent',
    });

    manager.addNode(spaceResult.value.id, {
      id: 'child2',
      type: 'task',
      name: 'Child 2',
      parentId: 'parent',
    });

    const children = manager.getChildren(spaceResult.value.id, 'parent');
    expect(children).toHaveLength(2);
  });

  it('gets ancestors of a node', () => {
    const spaceResult = manager.create({ name: 'Test Space' });
    expect(spaceResult.ok).toBe(true);
    if (!spaceResult.ok) return;

    manager.addNode(spaceResult.value.id, {
      id: 'grandparent',
      type: 'domain',
      name: 'Grandparent',
    });

    manager.addNode(spaceResult.value.id, {
      id: 'parent',
      type: 'domain',
      name: 'Parent',
      parentId: 'grandparent',
    });

    manager.addNode(spaceResult.value.id, {
      id: 'child',
      type: 'task',
      name: 'Child',
      parentId: 'parent',
    });

    const ancestors = manager.getAncestors(spaceResult.value.id, 'child');
    expect(ancestors).toHaveLength(2);
    expect(ancestors[0]!.id).toBe('parent');
    expect(ancestors[1]!.id).toBe('grandparent');
  });

  it('removes nodes', () => {
    const spaceResult = manager.create({ name: 'Test Space' });
    expect(spaceResult.ok).toBe(true);
    if (!spaceResult.ok) return;

    manager.addNode(spaceResult.value.id, {
      id: 'node-1',
      type: 'domain',
      name: 'Node 1',
    });

    const removeResult = manager.removeNode(spaceResult.value.id, 'node-1');
    expect(removeResult.ok).toBe(true);
    if (removeResult.ok) {
      expect(removeResult.value.nodes).toHaveLength(0);
    }
  });

  it('prevents removing node with children', () => {
    const spaceResult = manager.create({ name: 'Test Space' });
    expect(spaceResult.ok).toBe(true);
    if (!spaceResult.ok) return;

    manager.addNode(spaceResult.value.id, {
      id: 'parent',
      type: 'domain',
      name: 'Parent',
    });

    manager.addNode(spaceResult.value.id, {
      id: 'child',
      type: 'task',
      name: 'Child',
      parentId: 'parent',
    });

    const removeResult = manager.removeNode(spaceResult.value.id, 'parent');
    expect(removeResult.ok).toBe(false);
    if (!removeResult.ok) {
      expect(removeResult.error.message).toContain('children');
    }
  });
});

describe('Agent Problem Space Binding', () => {
  let manager: ProblemSpaceManager;
  let spaceId: ProblemSpaceId;

  beforeEach(() => {
    manager = new ProblemSpaceManager();
    const result = manager.create({ name: 'Test Space' });
    if (result.ok) {
      spaceId = result.value.id;
      manager.addNode(spaceId, { id: 'node-1', type: 'task', name: 'Task 1' });
      manager.addNode(spaceId, { id: 'node-2', type: 'task', name: 'Task 2' });
    }
  });

  it('binds agent to problem space', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindProblemSpace(
      spaceId,
      ['node-1', 'node-2']
    );

    expect(bindResult.ok).toBe(true);
    if (bindResult.ok) {
      expect(bindResult.value.data.problemSpaceBindings).toHaveLength(1);
    }
  });

  it('checks node operation permission', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindProblemSpace(
      spaceId,
      ['node-1'],
      ['node-2']
    );

    expect(bindResult.ok).toBe(true);
    if (!bindResult.ok) return;

    expect(bindResult.value.canOperateOnNode(spaceId, 'node-1')).toBe(true);
    expect(bindResult.value.canOperateOnNode(spaceId, 'node-2')).toBe(false);
  });

  it('supports wildcard access', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindProblemSpace(
      spaceId,
      ['*']
    );

    expect(bindResult.ok).toBe(true);
    if (!bindResult.ok) return;

    expect(bindResult.value.canOperateOnNode(spaceId, 'node-1')).toBe(true);
    expect(bindResult.value.canOperateOnNode(spaceId, 'node-2')).toBe(true);
    expect(bindResult.value.canOperateOnNode(spaceId, 'any-node')).toBe(true);
  });

  it('unbinds agent from problem space', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindProblemSpace(
      spaceId,
      ['node-1']
    );
    expect(bindResult.ok).toBe(true);
    if (!bindResult.ok) return;

    const unbindResult = bindResult.value.unbindProblemSpace(spaceId);
    expect(unbindResult.ok).toBe(true);
    if (unbindResult.ok) {
      expect(unbindResult.value.data.problemSpaceBindings).toHaveLength(0);
    }
  });
});

describe('Agent Policy Binding', () => {
  it('binds agent to policy', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindPolicy('policy_123');

    expect(bindResult.ok).toBe(true);
    if (bindResult.ok) {
      expect(bindResult.value.data.policyIds).toContain('policy_123');
    }
  });

  it('prevents duplicate policy binding', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindPolicy('policy_123');
    expect(bindResult.ok).toBe(true);
    if (!bindResult.ok) return;

    const duplicateResult = bindResult.value.bindPolicy('policy_123');
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.error.message).toContain('already bound');
    }
  });

  it('unbinds agent from policy', () => {
    const agentResult = Agent.create({ name: 'Test Agent' });
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;

    const bindResult = agentResult.value.bindPolicy('policy_123');
    expect(bindResult.ok).toBe(true);
    if (!bindResult.ok) return;

    const unbindResult = bindResult.value.unbindPolicy('policy_123');
    expect(unbindResult.ok).toBe(true);
    if (unbindResult.ok) {
      expect(unbindResult.value.data.policyIds).not.toContain('policy_123');
    }
  });
});

describe('AgentRegistry', () => {
  let storage: InMemoryStorage;
  let registry: AgentRegistry;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    registry = new AgentRegistry(storage);
  });

  it('creates and retrieves agent', async () => {
    const createResult = await registry.create({
      name: 'Test Agent',
      description: 'A test agent',
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = await registry.findById(createResult.value.data.id);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;

    expect(getResult.value).not.toBeNull();
    expect(getResult.value!.data.name).toBe('Test Agent');
  });

  it('prevents duplicate name', async () => {
    await registry.create({ name: 'Test Agent' });

    const duplicate = await registry.create({ name: 'Test Agent' });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.message).toContain('already exists');
    }
  });

  it('finds agent by name', async () => {
    await registry.create({ name: 'Test Agent' });

    const result = await registry.findByName('Test Agent');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).not.toBeNull();
    expect(result.value!.data.name).toBe('Test Agent');
  });

  it('finds active agents', async () => {
    await registry.create({ name: 'Agent 1' });
    await registry.create({ name: 'Agent 2' });

    const result = await registry.findActive();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
  });

  it('counts agents by status', async () => {
    await registry.create({ name: 'Agent 1' });
    await registry.create({ name: 'Agent 2' });

    const result = await registry.countByStatus('active');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBe(2);
  });

  it('gets agent statistics', async () => {
    await registry.create({ name: 'Agent 1' });
    await registry.create({ name: 'Agent 2' });

    const result = await registry.getStats();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.total).toBe(2);
    expect(result.value.active).toBe(2);
    expect(result.value.suspended).toBe(0);
    expect(result.value.revoked).toBe(0);
  });
});
