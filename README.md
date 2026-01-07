# ContextGraph OS

A provenance-first, time-aware, decision-trace substrate for auditable AI agents.

## Overview

ContextGraph OS provides the foundational infrastructure for building AI agent systems where every action, decision, and piece of knowledge is fully traceable and auditable. It treats **time as a first-class citizen**, **decisions as data**, and enforces **provenance-first** principles throughout.

## Core Principles

- **Provenance First**: Every claim requires a source. No orphan data.
- **Time as First-Class Citizen**: All data is temporally qualified with explicit validity periods.
- **Decisions as Data**: Agent decisions are tracked with full lifecycle and audit trails.
- **Context Filtering**: Query data by time, jurisdiction, scope, and confidence.
- **Policy Enforcement**: Deny-takes-precedence evaluation with approval workflows.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ContextGraph OS                          │
├─────────────────────────────────────────────────────────────────┤
│  SDK & CLI Layer                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │     SDK     │  │     CLI     │  │    Demos    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Execution Layer                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Executor   │  │  Handlers   │  │  Workflows  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Agent Layer                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Agents    │  │ Capabilities│  │Problem Space│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Policy & Governance Layer                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Policy    │  │ Exceptions  │  │    DTG      │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Knowledge Layer                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │     CKG     │  │ Provenance  │  │  Retrieval  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Foundation Layer                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Core     │  │   Storage   │  │  Ontology   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@contextgraph/core` | Branded types, Result pattern, time utilities, error types |
| `@contextgraph/storage` | Storage abstraction with SQLite and in-memory implementations |
| `@contextgraph/ontology` | Schema definitions, versioning, validation |
| `@contextgraph/ckg` | Contextual Knowledge Graph - entities and claims with temporal context |
| `@contextgraph/provenance` | Immutable provenance ledger with hash chain verification |
| `@contextgraph/dtg` | Decision Trace Graph - tracks decisions with full audit trails |
| `@contextgraph/policy` | Policy ledger with rule evaluation and deny-takes-precedence |
| `@contextgraph/exceptions` | Exception requests and approvals for policy overrides |
| `@contextgraph/agent` | Agent registry, capabilities, and problem-space graphs |
| `@contextgraph/retrieval` | Context assembly with temporal and scope filtering |
| `@contextgraph/execution` | Agent execution framework with policy enforcement |
| `@contextgraph/sdk` | Unified high-level SDK for ContextGraph OS |
| `@contextgraph/cli` | CLI tools, formatters, inspector, and interactive REPL |
| `@contextgraph/demos` | Demo examples and integration tests |

## Installation

```bash
# Clone the repository
git clone https://github.com/akz4ol/contextgraph-os.git
cd contextgraph-os

# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Run tests
pnpm -r test
```

## Quick Start

### Using the SDK (Recommended)

```typescript
import { ContextGraph, createScope, createConfidence } from '@contextgraph/sdk';

// Create a client
const result = await ContextGraph.create();
if (!result.ok) throw result.error;
const client = result.value;

// Create an entity
const person = await client.createEntity({
  type: 'person',
  name: 'Alice',
  properties: { department: 'Engineering' },
});

// Add claims with provenance (automatically tracked)
await client.addClaim({
  subjectId: person.value.data.id,
  predicate: 'has_skill',
  value: 'TypeScript',
  context: {
    scope: createScope('work'),
    confidence: createConfidence(0.95),
  },
});

// Query claims
const claims = await client.getClaims(person.value.data.id);

// Create an agent
const agent = await client.createAgent({
  name: 'assistant',
  description: 'Research assistant agent',
});

// Register action handlers
client.registerHandler('read', 'document', async (action) => {
  return ok({ content: 'document content' });
});

// Execute actions
const execution = await client.execute({
  agentId: agent.value.data.id,
  action: 'read',
  resourceType: 'document',
  resourceId: 'doc_123',
});

// Record decisions with audit trail
const decision = await client.recordDecision({
  type: 'workflow_step',
  title: 'Deploy to production',
  proposedBy: agent.value.data.id,
  riskLevel: 'medium',
});

// Verify provenance chain integrity
const verification = await client.verifyProvenance();
console.log(`Chain valid: ${verification.value.valid}`);

// Get system statistics
const stats = await client.getStats();
console.log(`Entities: ${stats.value.entities}, Claims: ${stats.value.claims}`);
```

### Using the CLI

```bash
# Start interactive REPL
npx contextgraph repl

# Or use individual commands
npx contextgraph stats
npx contextgraph entities person --limit 10
npx contextgraph entity <id> --with-claims
npx contextgraph agents
npx contextgraph audit --json
npx contextgraph verify
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `stats` | Show system statistics |
| `entities [type]` | List entities |
| `entity <id>` | Inspect an entity |
| `agents` | List active agents |
| `agent <id\|name>` | Inspect an agent |
| `decisions` | List pending decisions |
| `policies` | List effective policies |
| `audit` | Show audit trail |
| `provenance` | Query provenance entries |
| `verify` | Verify provenance chain integrity |
| `context <id>` | Assemble context for an entity |
| `repl` | Start interactive REPL |

## Key Concepts

### Contextual Knowledge Graph (CKG)

The CKG stores entities and claims with full temporal context:

```typescript
// Claims have temporal validity and provenance
const claim = await client.addClaim({
  subjectId: entityId,
  predicate: 'temperature',
  value: 72,
  context: {
    scope: createScope('building-a'),
    jurisdiction: createJurisdiction('us-east'),
    confidence: createConfidence(0.95),
    validFrom: createTimestamp(),
    validUntil: null, // Currently valid
  },
});
```

### Decision Trace Graph (DTG)

Track every decision with full audit trail:

```typescript
// Record a decision
const decision = await client.recordDecision({
  type: 'claim_creation',
  title: 'Create user profile',
  proposedBy: agentId,
  riskLevel: 'low',
});

// Get pending decisions
const pending = await client.getPendingDecisions();

// Approve a decision
await client.approveDecision(decision.value.data.id, approverId);
```

### Policy Enforcement

Define policies with deny-takes-precedence semantics:

```typescript
await client.createPolicy({
  name: 'Restrict PII Access',
  version: '1.0.0',
  description: 'Deny access to PII data',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read', 'write'],
  resources: ['pii/*'],
  conditions: [{
    field: 'agent.clearance',
    operator: 'less_than',
    value: 'secret',
  }],
  priority: 100,
});
```

### Agent Execution

Execute actions with full policy and capability enforcement:

```typescript
// Register a custom handler
client.registerHandler('execute', 'data_processing', async (action, context) => {
  // Process data...
  return ok({ processed: true, count: 42 });
});

// Execute with audit trail
const result = await client.execute({
  agentId: agent.data.id,
  action: 'execute',
  resourceType: 'data_processing',
  parameters: { input: '/data/input.json' },
});

// Get audit trail
const audit = await client.getAuditTrail({ limit: 20 });
```

### Event System

Subscribe to SDK events:

```typescript
// Subscribe to events
client.on('entity:created', (event) => {
  console.log('Entity created:', event.data);
});

client.on('claim:added', (event) => {
  console.log('Claim added:', event.data);
});

client.on('decision:approved', (event) => {
  console.log('Decision approved:', event.data);
});

// Unsubscribe
client.off('entity:created', handler);
```

## Testing

The project includes comprehensive tests for all packages:

```bash
# Run all tests
pnpm -r test

# Run tests for a specific package
pnpm --filter @contextgraph/sdk test

# Run demos
pnpm --filter @contextgraph/demos test
```

**Test Coverage**: 318 tests across 14 packages

## Project Status

| Epic | Status | Description |
|------|--------|-------------|
| E0 | ✅ | Project setup and core types |
| E1 | ✅ | Storage abstraction |
| E2 | ✅ | Ontology and schema |
| E3 | ✅ | Contextual Knowledge Graph |
| E4 | ✅ | Provenance ledger |
| E5 | ✅ | Exceptions and overrides |
| E6 | ✅ | Policy and rights ledger |
| E7 | ✅ | Agent and problem-space graphs |
| E8 | ✅ | Retrieval and context assembly |
| E9 | ✅ | Agent execution framework |
| E10 | ✅ | APIs and SDKs |
| E11 | ✅ | CLI and inspection tools |
| E12-13 | ✅ | Demos and integration testing |

## License

This project is dual-licensed:

- **AGPL-3.0** - Free for open source use (requires source disclosure for modifications and network services)
- **Commercial License** - Available for proprietary use without AGPL obligations

See [LICENSING.md](./LICENSING.md) for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
