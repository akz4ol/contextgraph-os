# Building an Auditable Agent

This tutorial walks you through building a fully auditable AI agent using ContextGraph OS.

## What You'll Build

An agent that:
- Processes data with full audit trails
- Records decisions for review
- Respects policies
- Has verifiable provenance

## Prerequisites

```bash
pnpm add @contextgraph/sdk
```

## Step 1: Create the Client

```typescript
import { ContextGraph, ok } from '@contextgraph/sdk';

async function main() {
  const result = await ContextGraph.create();
  if (!result.ok) throw result.error;
  const client = result.value;
```

## Step 2: Create an Agent

```typescript
  const agentResult = await client.createAgent({
    name: 'data-processor',
    description: 'Processes incoming data files with full audit trail',
    capabilities: ['read', 'transform', 'write'],
  });

  if (!agentResult.ok) throw agentResult.error;
  const agent = agentResult.value;

  console.log(`Created agent: ${agent.data.name} (${agent.data.id})`);
```

## Step 3: Register Handlers

```typescript
  // Read handler
  client.registerHandler('read', 'csv', async (action) => {
    console.log(`[Handler] Reading: ${action.resourceId}`);
    // Simulate reading data
    const data = [
      { name: 'Alice', department: 'Engineering' },
      { name: 'Bob', department: 'Product' },
    ];
    return ok({ data, rowCount: data.length });
  });

  // Transform handler
  client.registerHandler('transform', 'data', async (action) => {
    console.log(`[Handler] Transforming data`);
    const input = action.parameters?.data as any[];
    const transformed = input.map(row => ({
      ...row,
      processedAt: new Date().toISOString(),
    }));
    return ok({ data: transformed, rowCount: transformed.length });
  });

  // Write handler
  client.registerHandler('write', 'json', async (action) => {
    console.log(`[Handler] Writing to: ${action.resourceId}`);
    // Simulate writing
    return ok({ written: true, path: action.resourceId });
  });
```

## Step 4: Record a Decision

Before processing, record the decision:

```typescript
  const decisionResult = await client.recordDecision({
    type: 'data_processing',
    title: 'Process employee data batch',
    description: 'Transform CSV to JSON with timestamp enrichment',
    proposedBy: agent.data.id,
    riskLevel: 'low',
  });

  if (!decisionResult.ok) throw decisionResult.error;
  const decision = decisionResult.value;

  console.log(`Decision recorded: ${decision.data.title}`);
```

## Step 5: Execute Workflow

```typescript
  // Step 1: Read
  const readResult = await client.execute({
    agentId: agent.data.id,
    action: 'read',
    resourceType: 'csv',
    resourceId: 'data/employees.csv',
  });

  if (!readResult.ok) {
    console.error('Read failed:', readResult.error);
    return;
  }

  console.log(`Read ${readResult.value.output.rowCount} rows`);

  // Step 2: Transform
  const transformResult = await client.execute({
    agentId: agent.data.id,
    action: 'transform',
    resourceType: 'data',
    resourceId: 'memory',
    parameters: { data: readResult.value.output.data },
  });

  if (!transformResult.ok) {
    console.error('Transform failed:', transformResult.error);
    return;
  }

  console.log(`Transformed ${transformResult.value.output.rowCount} rows`);

  // Step 3: Write
  const writeResult = await client.execute({
    agentId: agent.data.id,
    action: 'write',
    resourceType: 'json',
    resourceId: 'output/employees.json',
    parameters: { data: transformResult.value.output.data },
  });

  if (!writeResult.ok) {
    console.error('Write failed:', writeResult.error);
    return;
  }

  console.log(`Wrote output`);
```

## Step 6: Complete the Decision

```typescript
  await client.approveDecision(
    decision.data.id,
    agent.data.id,
    'Workflow completed successfully'
  );

  console.log('Decision completed');
```

## Step 7: Verify Audit Trail

```typescript
  // Verify provenance
  const verification = await client.verifyProvenance();
  console.log(`Provenance chain valid: ${verification.value.valid}`);

  // Get audit trail
  const audit = await client.getAuditTrail({ limit: 10 });
  console.log('\nAudit Trail:');
  for (const entry of audit.value) {
    console.log(`  ${entry.timestamp}: ${entry.action} ${entry.resourceType}`);
  }

  // Get statistics
  const stats = await client.getStats();
  console.log('\nStatistics:');
  console.log(`  Agents: ${stats.value.agents}`);
  console.log(`  Decisions: ${stats.value.decisions}`);
  console.log(`  Provenance entries: ${stats.value.provenanceEntries}`);
}

main().catch(console.error);
```

## Full Code

See the complete example at `packages/demos/src/agent-workflow.ts`.

## Key Takeaways

1. **Record decisions before acting** - Creates audit trail
2. **Use handlers for actions** - Standardized execution
3. **Verify provenance** - Ensure data integrity
4. **Check audit trail** - Review what happened

## Next Steps

- [Policy-Based Access Control](./policy-control.md)
- [Visualizing Decision Trees](./visualizing-decisions.md)
