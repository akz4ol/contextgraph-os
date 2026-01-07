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

```typescript
import { InMemoryStorage } from '@contextgraph/storage';
import { CKG } from '@contextgraph/ckg';
import { ProvenanceLedger } from '@contextgraph/provenance';
import { AgentRegistry } from '@contextgraph/agent';
import { Executor } from '@contextgraph/execution';

// Initialize storage
const storage = new InMemoryStorage();
await storage.initialize();

// Create core components
const provenance = new ProvenanceLedger(storage);
await provenance.initialize();

const ckg = new CKG(storage, provenance);
const agentRegistry = new AgentRegistry(storage);

// Create an agent
const agent = await agentRegistry.create({
  name: 'Research Assistant',
  type: 'assistant',
});

// Create an entity in the knowledge graph
const entity = await ckg.createEntity({
  type: 'document',
  name: 'Project Report',
  sourceType: 'user',
  sourceId: 'user_123',
});

// Add a claim with provenance
const claim = await ckg.addClaim({
  subjectId: entity.value.data.id,
  predicate: 'status',
  value: 'draft',
  sourceType: 'agent',
  sourceId: agent.value.data.id,
});
```

## Key Concepts

### Contextual Knowledge Graph (CKG)

The CKG stores entities and claims with full temporal context:

```typescript
// Claims have temporal validity
const claim = await ckg.addClaim({
  subjectId: entityId,
  predicate: 'temperature',
  value: 72,
  sourceType: 'sensor',
  sourceId: 'sensor_001',
  context: {
    temporal: { start: now, end: null },
    jurisdiction: 'us-east',
    confidence: 0.95,
  },
});
```

### Decision Trace Graph (DTG)

Track every decision with full audit trail:

```typescript
const decision = await dtg.recordDecision({
  type: 'claim_creation',
  title: 'Create user profile',
  proposedBy: agentId,
  riskLevel: 'low',
});

// Approve and execute
await dtg.approveDecision(decision.data.id, approverId);
await dtg.executeDecision(decision.data.id, outcome);
```

### Policy Enforcement

Define policies with deny-takes-precedence semantics:

```typescript
await policyLedger.create({
  name: 'Restrict PII Access',
  version: '1.0.0',
  rules: [{
    effect: 'deny',
    conditions: [{
      field: 'resource.type',
      operator: 'equals',
      value: 'pii',
    }],
  }],
  priority: 100,
});
```

### Agent Execution

Execute actions with full policy and capability enforcement:

```typescript
const executor = new Executor({
  storage,
  agentRegistry,
  capabilityRegistry,
  policyLedger,
  decisionGraph,
  provenanceLedger,
});

const result = await executor.execute({
  agentId: agent.data.id,
  action: {
    type: 'read',
    resourceType: 'document',
    resourceId: 'doc_123',
  },
});
```

## Testing

The project includes comprehensive tests for all packages:

```bash
# Run all tests
pnpm -r test

# Run tests for a specific package
cd packages/execution && pnpm test
```

**Test Coverage**: 286 tests across 11 packages

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
| E10 | 🔲 | APIs and SDKs |
| E11 | 🔲 | UI and inspection tools |
| E12-13 | 🔲 | Demos and testing |

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
