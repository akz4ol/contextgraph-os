# @contextgraph/demos

Demo examples and integration tests for ContextGraph OS.

## Overview

This package contains interactive demonstrations of ContextGraph OS capabilities:

| Demo | Description |
|------|-------------|
| **basic-usage** | Entity creation, claims, provenance, and querying |
| **agent-workflow** | Agent execution, handlers, decisions, and audit trails |

## Prerequisites

Before running demos, ensure you've built all packages:

```bash
# From the repository root
pnpm install
pnpm -r build
```

## Running Demos

### Basic Usage Demo

Demonstrates the core knowledge graph functionality:

```bash
pnpm demo:basic
```

**What it shows:**
- Creating a ContextGraph client
- Creating entities (person, project)
- Adding claims with provenance tracking
- Querying claims by entity
- Verifying provenance chain integrity
- Viewing system statistics

### Agent Workflow Demo

Demonstrates the agent execution framework:

```bash
pnpm demo:agent
```

**What it shows:**
- Creating multiple agents (orchestrator, worker)
- Registering custom action handlers
- Recording workflow decisions with risk levels
- Executing actions through handlers
- Viewing audit trails
- Multi-agent coordination patterns

## Running Tests

The demos package includes integration tests that verify end-to-end functionality:

```bash
pnpm test
```

**Test coverage:**
- End-to-end workflow tests
- CLI integration tests (inspector, REPL)
- Event system tests
- Data integrity tests
- Statistics accuracy tests

## Code Structure

```
src/
├── basic-usage.ts      # Basic CKG demo
├── agent-workflow.ts   # Agent execution demo
├── index.ts            # Package exports
└── index.test.ts       # Integration tests (13 tests)
```

## Extending Demos

### Creating a Custom Demo

```typescript
import { ContextGraph, ok } from '@contextgraph/sdk';

export async function runMyDemo(): Promise<void> {
  // Create client
  const result = await ContextGraph.create({
    enablePolicies: false,      // Set true to enable policy checking
    enableCapabilities: false,  // Set true to enable capability checking
  });

  if (!result.ok) {
    console.error('Failed:', result.error);
    return;
  }

  const client = result.value;

  // Your demo code here...

  // Create entities
  const entity = await client.createEntity({
    type: 'my_type',
    name: 'My Entity',
    properties: { custom: 'data' },
  });

  // Add claims
  await client.addClaim({
    subjectId: entity.value.data.id,
    predicate: 'has_property',
    value: 'some value',
  });

  // Register handlers
  client.registerHandler('my_action', 'my_resource', async (action) => {
    console.log('Handling:', action);
    return ok({ success: true });
  });

  // Execute actions
  const agent = await client.createAgent({ name: 'my-agent' });
  await client.execute({
    agentId: agent.value.data.id,
    action: 'my_action',
    resourceType: 'my_resource',
  });
}
```

### Adding to package.json

```json
{
  "scripts": {
    "demo:my-demo": "node --loader ts-node/esm src/my-demo.ts"
  }
}
```

## Key Concepts Illustrated

### Provenance Tracking

Every claim automatically gets provenance:

```typescript
const claim = await client.addClaim({
  subjectId: entityId,
  predicate: 'status',
  value: 'active',
});

// claim.value.data.provenanceId is automatically set
```

### Event-Driven Architecture

Subscribe to system events:

```typescript
client.on('entity:created', (event) => {
  console.log('New entity:', event.data);
});

client.on('execution:completed', (event) => {
  console.log('Action completed:', event.data);
});
```

### Audit Trail

Every action is recorded:

```typescript
const audit = await client.getAuditTrail({ limit: 10 });
for (const entry of audit.value) {
  console.log(`${entry.action} on ${entry.resource}: ${entry.outcome}`);
}
```

## Troubleshooting

### "Cannot find module" errors

Ensure all packages are built:

```bash
pnpm -r build
```

### Demo hangs or doesn't output

Check that you're in the correct directory:

```bash
cd packages/demos
pnpm demo:basic
```

### TypeScript errors

Ensure ts-node is installed:

```bash
pnpm install
```

## Related Documentation

- [Main README](../../README.md) - Project overview and quick start
- [DEVELOPMENT.md](../../DEVELOPMENT.md) - Development setup guide
- [LICENSING.md](../../LICENSING.md) - License information
