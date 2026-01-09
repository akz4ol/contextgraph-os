# @contextgraph/execution

Agent execution framework with policy enforcement.

## Installation

```bash
pnpm add @contextgraph/execution
```

## Overview

The execution package provides:

- Action execution framework
- Handler registration
- Policy enforcement
- Audit logging

## Creating the Executor

```typescript
import { ActionExecutor } from '@contextgraph/execution';

const executor = new ActionExecutor(
  agentRegistry,
  policyEvaluator,
  provenanceLedger,
  storage
);
await executor.initialize();
```

## Registering Handlers

```typescript
executor.registerHandler('read', 'document', async (action, context) => {
  const content = await readDocument(action.resourceId);
  return ok({ content, size: content.length });
});

executor.registerHandler('transform', 'csv', async (action, context) => {
  const data = await readCSV(action.resourceId);
  const transformed = await transform(data, action.parameters);
  return ok({ rowCount: transformed.length });
});
```

## Executing Actions

```typescript
const result = await executor.execute({
  agentId: agentId,
  action: 'read',
  resourceType: 'document',
  resourceId: 'reports/q4-2024.pdf',
  parameters: {
    format: 'text',
  },
});

if (result.ok) {
  console.log('Execution result:', result.value.output);
} else {
  console.error('Execution failed:', result.error);
}
```

## Action Structure

```typescript
interface ActionRequest {
  agentId: AgentId;
  action: string;
  resourceType: string;
  resourceId: string;
  parameters?: Record<string, unknown>;
}

interface ActionResult {
  executionId: string;
  status: 'allowed' | 'denied' | 'error';
  output?: unknown;
  error?: Error;
  duration: number;
  timestamp: Timestamp;
}
```

## Handler Context

```typescript
executor.registerHandler('process', 'data', async (action, context) => {
  // Access context
  const agent = context.agent;           // Executing agent
  const policies = context.policies;     // Matched policies
  const timestamp = context.timestamp;   // Execution time

  // Perform work
  return ok({ processed: true });
});
```

## Policy Enforcement

Actions are automatically checked against policies:

```typescript
// If policy denies, execution is blocked
const result = await executor.execute({
  agentId: agentId,
  action: 'delete',
  resourceType: 'pii',
  resourceId: 'user/123',
});

if (!result.ok && result.error.code === 'POLICY_DENIED') {
  console.log('Access denied by policy');
}
```

## Audit Logging

All executions are automatically logged to provenance:

```typescript
// Query execution history
const history = await provenanceLedger.query({
  type: 'execution_logged',
  agentId: agentId,
  limit: 100,
});
```

## Workflows

Chain multiple actions:

```typescript
async function processWorkflow(agentId: AgentId) {
  // Step 1: Read data
  const readResult = await executor.execute({
    agentId,
    action: 'read',
    resourceType: 'csv',
    resourceId: 'input.csv',
  });

  if (!readResult.ok) return readResult;

  // Step 2: Transform
  const transformResult = await executor.execute({
    agentId,
    action: 'transform',
    resourceType: 'data',
    resourceId: 'temp',
    parameters: { data: readResult.value.output },
  });

  if (!transformResult.ok) return transformResult;

  // Step 3: Write output
  return executor.execute({
    agentId,
    action: 'write',
    resourceType: 'json',
    resourceId: 'output.json',
    parameters: { data: transformResult.value.output },
  });
}
```
