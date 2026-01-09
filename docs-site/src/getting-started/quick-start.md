# Quick Start

Get up and running with ContextGraph OS in 5 minutes.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

## Installation

```bash
# Clone the repository
git clone https://github.com/akz4ol/contextgraph-os.git
cd contextgraph-os

# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Run tests to verify
pnpm -r test
```

## Your First ContextGraph Application

Create a new file `demo.ts`:

```typescript
import { ContextGraph, createScope, createConfidence } from '@contextgraph/sdk';
import { ok } from '@contextgraph/core';

async function main() {
  // 1. Create the ContextGraph client
  const result = await ContextGraph.create();
  if (!result.ok) {
    console.error('Failed to create client:', result.error);
    return;
  }
  const client = result.value;

  console.log('ContextGraph client created!');

  // 2. Create an entity
  const personResult = await client.createEntity({
    type: 'person',
    name: 'Alice',
    properties: {
      department: 'Engineering',
      level: 'senior'
    },
  });

  if (!personResult.ok) {
    console.error('Failed to create entity:', personResult.error);
    return;
  }

  const person = personResult.value;
  console.log(`Created person: ${person.data.name} (${person.data.id})`);

  // 3. Add claims with context
  await client.addClaim({
    subjectId: person.data.id,
    predicate: 'has_skill',
    value: 'TypeScript',
    context: {
      scope: createScope('professional'),
      confidence: createConfidence(0.95),
    },
  });

  await client.addClaim({
    subjectId: person.data.id,
    predicate: 'has_skill',
    value: 'Python',
    context: {
      scope: createScope('professional'),
      confidence: createConfidence(0.85),
    },
  });

  console.log('Added skill claims');

  // 4. Query claims
  const claimsResult = await client.getClaims(person.data.id);
  if (claimsResult.ok) {
    console.log('\nClaims for Alice:');
    for (const claim of claimsResult.value) {
      console.log(`  - ${claim.data.predicate}: ${claim.data.value}`);
    }
  }

  // 5. Create an agent
  const agentResult = await client.createAgent({
    name: 'assistant',
    description: 'A helpful research assistant',
  });

  if (!agentResult.ok) {
    console.error('Failed to create agent:', agentResult.error);
    return;
  }

  const agent = agentResult.value;
  console.log(`\nCreated agent: ${agent.data.name}`);

  // 6. Register an action handler
  client.registerHandler('analyze', 'document', async (action) => {
    console.log(`  [Handler] Analyzing document: ${action.resourceId}`);
    return ok({
      analyzed: true,
      wordCount: 1500,
      sentiment: 'positive'
    });
  });

  // 7. Execute an action
  const execResult = await client.execute({
    agentId: agent.data.id,
    action: 'analyze',
    resourceType: 'document',
    resourceId: 'doc_quarterly_report',
    parameters: { depth: 'full' },
  });

  if (execResult.ok) {
    console.log('\nAction executed successfully!');
  }

  // 8. Record a decision
  const decisionResult = await client.recordDecision({
    type: 'analysis_review',
    title: 'Review quarterly report analysis',
    proposedBy: agent.data.id,
    riskLevel: 'low',
  });

  if (decisionResult.ok) {
    console.log(`\nDecision recorded: ${decisionResult.value.data.title}`);
  }

  // 9. Verify provenance chain
  const verifyResult = await client.verifyProvenance();
  if (verifyResult.ok) {
    console.log(`\nProvenance chain valid: ${verifyResult.value.valid}`);
    console.log(`Entries verified: ${verifyResult.value.entriesVerified}`);
  }

  // 10. Get system statistics
  const stats = await client.getStats();
  if (stats.ok) {
    console.log('\nSystem Statistics:');
    console.log(`  Entities: ${stats.value.entities}`);
    console.log(`  Claims: ${stats.value.claims}`);
    console.log(`  Agents: ${stats.value.agents}`);
    console.log(`  Decisions: ${stats.value.decisions}`);
  }
}

main().catch(console.error);
```

## Run the Demo

```bash
# Using ts-node
npx ts-node demo.ts

# Or compile and run
npx tsc demo.ts && node demo.js
```

## Expected Output

```
ContextGraph client created!
Created person: Alice (ent_abc123...)
Added skill claims

Claims for Alice:
  - has_skill: TypeScript
  - has_skill: Python

Created agent: assistant
  [Handler] Analyzing document: doc_quarterly_report

Action executed successfully!

Decision recorded: Review quarterly report analysis

Provenance chain valid: true
Entries verified: 5

System Statistics:
  Entities: 1
  Claims: 2
  Agents: 1
  Decisions: 1
```

## Using the CLI

ContextGraph includes a powerful CLI for exploration:

```bash
# View system statistics
npx contextgraph stats

# List entities
npx contextgraph entities

# Inspect an entity
npx contextgraph entity <entity-id> --with-claims

# Start interactive REPL
npx contextgraph repl
```

## Using the REST API

Start the API server:

```bash
npx contextgraph-api
```

Then use it via HTTP:

```bash
# Create an entity
curl -X POST http://localhost:3000/api/v1/entities \
  -H "Content-Type: application/json" \
  -d '{"type": "person", "name": "Bob"}'

# List entities
curl http://localhost:3000/api/v1/entities

# Get statistics
curl http://localhost:3000/api/v1/stats
```

## Next Steps

- [Installation](./installation.md) - Detailed installation options
- [First Steps](./first-steps.md) - Deeper walkthrough
- [Architecture](./architecture.md) - System design
- [SDK Documentation](../packages/sdk.md) - Full SDK reference
