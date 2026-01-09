# @contextgraph/agent

Agent registry, capabilities, and hierarchies.

## Installation

```bash
pnpm add @contextgraph/agent
```

## Overview

The agent package manages:

- Agent registration and lifecycle
- Capability definitions
- Agent hierarchies and delegation
- Problem-space graphs

## Creating Agents

```typescript
import { AgentRegistry } from '@contextgraph/agent';

const registry = new AgentRegistry(storage);
await registry.initialize();

const agent = await registry.create({
  name: 'data-processor',
  description: 'Processes incoming data files',
  capabilities: ['read', 'transform', 'write'],
  metadata: {
    version: '1.0.0',
    maintainer: 'team@example.com',
  },
});
```

## Agent Lifecycle

```typescript
// Suspend an agent
await registry.suspend(agentId, 'Maintenance');

// Reactivate
await registry.reactivate(agentId);

// Revoke permanently
await registry.revoke(agentId, 'Security concern');
```

## Agent Status

| Status | Description |
|--------|-------------|
| `active` | Agent is operational |
| `suspended` | Temporarily disabled |
| `revoked` | Permanently disabled |

## Capabilities

```typescript
// Define capabilities
const capabilities = [
  'read:documents',
  'write:reports',
  'execute:workflows',
  'admin:users',
];

// Check capability
const hasCapability = await registry.hasCapability(agentId, 'read:documents');
```

## Agent Hierarchies

```typescript
import { AgentHierarchyManager } from '@contextgraph/agent';

const hierarchy = new AgentHierarchyManager(storage);

// Set parent-child relationship
await hierarchy.setParent(childAgentId, parentAgentId);

// Get children
const children = await hierarchy.getChildren(parentAgentId);

// Check if descendant
const isDescendant = await hierarchy.isDescendant(agentId, ancestorId);
```

## Capability Delegation

```typescript
// Delegate capabilities from parent to child
await hierarchy.delegate(parentId, childId, ['read:documents']);

// Get effective capabilities (inherited + own)
const effective = await hierarchy.getEffectiveCapabilities(agentId);
```

## Agent Interface

```typescript
interface Agent {
  id: AgentId;
  name: string;
  description?: string;
  status: AgentStatus;
  capabilities: string[];
  metadata?: Record<string, unknown>;
  parentId?: AgentId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Querying Agents

```typescript
// Get by ID
const agent = await registry.get(agentId);

// Get by name
const agent = await registry.getByName('data-processor');

// List all active agents
const agents = await registry.list({ status: 'active' });
```
