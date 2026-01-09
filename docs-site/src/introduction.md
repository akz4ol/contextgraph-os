# ContextGraph OS

A provenance-first, time-aware, decision-trace substrate for auditable AI agents.

## What is ContextGraph OS?

ContextGraph OS provides the foundational infrastructure for building AI agent systems where **every action, decision, and piece of knowledge is fully traceable and auditable**. It's designed for organizations that need:

- **Complete audit trails** for AI agent decisions
- **Provenance tracking** for all data and claims
- **Temporal awareness** with explicit validity periods
- **Policy enforcement** with deny-takes-precedence semantics
- **Compliance support** for regulatory requirements (GDPR, SOC2, etc.)

## Core Principles

### 1. Provenance First

Every claim in the system requires a source. No orphan data. This ensures you can always trace back to where information came from.

```typescript
// Every claim has provenance
await client.addClaim({
  subjectId: entityId,
  predicate: 'status',
  value: 'active',
  // Provenance is automatically tracked
});

// Verify the chain
const verification = await client.verifyProvenance();
console.log(`Chain valid: ${verification.value.valid}`);
```

### 2. Time as First-Class Citizen

All data is temporally qualified with explicit validity periods. Query data as it was at any point in time.

```typescript
await client.addClaim({
  subjectId: entityId,
  predicate: 'temperature',
  value: 72,
  context: {
    validFrom: createTimestamp('2024-01-01'),
    validUntil: createTimestamp('2024-12-31'),
  },
});
```

### 3. Decisions as Data

Agent decisions are tracked with full lifecycle and audit trails. Every decision goes through a defined state machine.

```typescript
// Record a decision
const decision = await client.recordDecision({
  type: 'workflow_step',
  title: 'Deploy to production',
  proposedBy: agentId,
  riskLevel: 'high',
});

// Approve it
await client.approveDecision(decision.value.data.id, approverId);
```

### 4. Context Filtering

Query data by time, jurisdiction, scope, and confidence level.

```typescript
const context = await client.assembleContext(entityId, {
  asOf: createTimestamp('2024-06-15'),
  jurisdiction: 'EU',
  minConfidence: 0.8,
});
```

### 5. Policy Enforcement

Deny-takes-precedence evaluation with approval workflows.

```typescript
await client.createPolicy({
  name: 'Restrict PII Access',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read'],
  resources: ['pii/*'],
  priority: 100,
});
```

## Package Overview

ContextGraph OS is organized into layered packages:

| Layer | Packages | Purpose |
|-------|----------|---------|
| **Foundation** | core, storage, ontology | Types, storage, schemas |
| **Knowledge** | ckg, provenance, retrieval | Knowledge graph, provenance, context |
| **Governance** | dtg, policy, exceptions, rbac, compliance | Decisions, policies, access control |
| **Agent** | agent, execution | Agent registry, action execution |
| **Advanced** | viz, reasoning, recommendations, telemetry | Visualization, inference, insights |
| **Integration** | sdk, api, cli, webhooks | APIs, CLI tools |

## Quick Example

```typescript
import { ContextGraph } from '@contextgraph/sdk';

// Create a client
const result = await ContextGraph.create();
const client = result.value;

// Create an entity
const person = await client.createEntity({
  type: 'person',
  name: 'Alice',
  properties: { department: 'Engineering' },
});

// Add claims with provenance
await client.addClaim({
  subjectId: person.value.data.id,
  predicate: 'has_skill',
  value: 'TypeScript',
});

// Create an agent
const agent = await client.createAgent({
  name: 'assistant',
  description: 'Research assistant',
});

// Execute actions with audit trail
await client.execute({
  agentId: agent.value.data.id,
  action: 'read',
  resourceType: 'document',
  resourceId: 'doc_123',
});

// Get audit trail
const audit = await client.getAuditTrail({ limit: 10 });
```

## Next Steps

- [Quick Start](./getting-started/quick-start.md) - Get up and running in 5 minutes
- [Installation](./getting-started/installation.md) - Detailed installation guide
- [Architecture](./getting-started/architecture.md) - Understand the system design
- [Core Concepts](./concepts/provenance.md) - Deep dive into principles
