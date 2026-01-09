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
│  API & Interface Layer                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  REST API   │  │     CLI     │  │    Demos    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  SDK Layer                                                      │
│  ┌─────────────────────────────────────────────────┐           │
│  │                      SDK                         │           │
│  └─────────────────────────────────────────────────┘           │
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
| `@contextgraph/webhooks` | Webhook management with delivery queue and retry logic |
| `@contextgraph/rbac` | Role-Based Access Control with built-in roles and permission checking |
| `@contextgraph/compliance` | Compliance reporting (audit, access, decisions) and GDPR features |
| `@contextgraph/telemetry` | OpenTelemetry-compatible tracing, metrics, and structured logging |
| `@contextgraph/sdk` | Unified high-level SDK for ContextGraph OS |
| `@contextgraph/api` | REST API server with Express, authentication, and rate limiting |
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
| `export` | Export graph data (JSON or CSV) |
| `import <file>` | Import graph data (JSON or CSV) |
| `repl` | Start interactive REPL |

### Using the REST API

Start the API server:

```bash
# Start the server (default port 3000)
npx contextgraph-api

# Or with custom configuration
PORT=8080 API_KEY=your-secret-key npx contextgraph-api
```

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/stats` | GET | System statistics |
| `/api/v1/entities` | GET, POST | List/create entities |
| `/api/v1/entities/:id` | GET, PUT, DELETE | Entity CRUD |
| `/api/v1/entities/:id/claims` | GET, POST | Entity claims |
| `/api/v1/agents` | GET, POST | List/create agents |
| `/api/v1/agents/:id` | GET | Get agent by ID or name |
| `/api/v1/agents/:id/execute` | POST | Execute agent action |
| `/api/v1/decisions` | GET, POST | List/create decisions |
| `/api/v1/decisions/:id/approve` | POST | Approve decision |
| `/api/v1/decisions/:id/reject` | POST | Reject decision |
| `/api/v1/policies` | GET, POST | List/create policies |
| `/api/v1/audit` | GET | Query audit trail |
| `/api/v1/provenance` | GET | Query provenance |
| `/api/v1/provenance/verify` | POST | Verify chain integrity |

**Example API Usage:**

```bash
# Create an entity
curl -X POST http://localhost:3000/api/v1/entities \
  -H "Content-Type: application/json" \
  -d '{"type": "person", "name": "Alice", "properties": {"role": "engineer"}}'

# List entities
curl http://localhost:3000/api/v1/entities?type=person&limit=10

# Add a claim
curl -X POST http://localhost:3000/api/v1/entities/ent_xxx/claims \
  -H "Content-Type: application/json" \
  -d '{"predicate": "has_skill", "value": "TypeScript"}'

# Check system health
curl http://localhost:3000/api/v1/health

# Verify provenance chain
curl -X POST http://localhost:3000/api/v1/provenance/verify
```

**Authentication:**

Set the `API_KEY` environment variable to enable API key authentication:

```bash
API_KEY=your-secret-key npx contextgraph-api
```

Then include the key in requests:
```bash
curl -H "X-API-Key: your-secret-key" http://localhost:3000/api/v1/entities
```

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

### Import/Export

Export and import graph data for backup or migration:

```typescript
// Export full graph to JSON
const exportResult = await client.exportToJSON();
const jsonString = await client.exportToJSONString({ prettyPrint: true });

// Export to CSV
const entitiesCSV = await client.exportEntitiesToCSV();
const claimsCSV = await client.exportClaimsToCSV();

// Import from JSON
await client.importFromJSON(exportData, {
  dryRun: true,        // Validate without importing
  merge: true,         // Merge with existing data
  onConflict: 'skip',  // skip | overwrite | error
});

// Import from CSV
await client.importEntitiesFromCSV(csvString, { dryRun: false });
await client.importClaimsFromCSV(csvString);
```

**CLI Export/Import:**

```bash
# Export full graph to JSON
npx contextgraph export --format json --output backup.json --pretty

# Export entities to CSV
npx contextgraph export --format csv --type entities --output entities.csv

# Import from JSON
npx contextgraph import backup.json

# Import entities from CSV (dry run first)
npx contextgraph import entities.csv --format csv --type entities --dry-run

# Import with merge and conflict handling
npx contextgraph import backup.json --merge --on-conflict skip
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

## Running Demos

ContextGraph OS includes two interactive demos that showcase the system's capabilities:

### Basic Usage Demo

Demonstrates entity creation, claims with provenance, and knowledge graph querying:

```bash
cd packages/demos
pnpm demo:basic
```

**Expected output:**
```
============================================================
ContextGraph OS - Basic Usage Demo
============================================================

Creating ContextGraph client...
Client created successfully.

Creating entities...
  Created: Alice (ent_xxx)
  Created: ContextGraph OS (ent_xxx)

Adding claims with provenance...
  Added: Alice works_on ContextGraph OS
  Added: Alice has_skill TypeScript
  Added: ContextGraph OS uses_technology TypeScript

Querying the knowledge graph...
  Claims for Alice:
    - works_on: ContextGraph OS
    - has_skill: TypeScript

Verifying provenance chain...
  Chain valid: true
  Entries verified: 5

System statistics:
  Entities: 2
  Claims: 3
  Agents: 0
  Decisions: 0
  Policies: 0

============================================================
Demo completed successfully!
============================================================
```

### Agent Workflow Demo

Demonstrates agent creation, action handlers, workflow execution, and audit trails:

```bash
cd packages/demos
pnpm demo:agent
```

**Expected output:**
```
============================================================
ContextGraph OS - Agent Workflow Demo
============================================================

Creating ContextGraph client...
Client created successfully.

Creating agents...
  Created: orchestrator (agt_xxx)
  Created: worker (agt_xxx)

Registering action handlers...
  Handlers registered: data_processing, configuration, report

Recording workflow decision...
  Decision recorded: Execute data processing pipeline
  Status: proposed
  Risk Level: medium

Executing workflow actions...
  [Handler] Reading configuration: pipeline-config
  Read config: Success
  [Handler] Processing data: {"inputPath":"/data/input","outputPath":"/data/output"}
  Process data: Success
  [Handler] Writing report: {"title":"Processing Summary","format":"json"}
  Write report: Success

Audit trail:
  [HH:MM:SS] read       configuration/pipeline-co... allowed
  [HH:MM:SS] execute    data_processing             allowed
  [HH:MM:SS] write      report                      allowed

Active agents:
  - orchestrator: Main workflow orchestrator agent
  - worker: Task execution worker agent

Provenance verification:
  Chain integrity: VALID
  Total entries: 8

============================================================
Demo completed successfully!
============================================================
```

## CLI Interactive REPL

The CLI includes a powerful interactive REPL for exploring and managing your graph:

```bash
# Start the REPL
npx contextgraph repl
```

**REPL Session Example:**
```
ContextGraph OS REPL v0.1.0
Type 'help' for available commands, 'exit' to quit.

contextgraph> help
Available commands:
  help              Show this help message
  stats             Show system statistics
  entities [type]   List entities (optionally filter by type)
  entity <id>       Inspect an entity
  agents            List active agents
  agent <id|name>   Inspect an agent
  decisions         List pending decisions
  policies          List effective policies
  audit             Show audit trail
  prov, provenance  Query provenance entries
  verify            Verify provenance chain
  ctx, context <id> Assemble context for entity
  json              Toggle JSON output mode
  exit, quit        Exit the REPL

contextgraph> stats
╔═══════════════════════════════════════╗
║         System Statistics             ║
╠═══════════════════════════════════════╣
║  Entities:    42                      ║
║  Claims:      156                     ║
║  Agents:      3                       ║
║  Decisions:   12                      ║
║  Policies:    5                       ║
╚═══════════════════════════════════════╝

contextgraph> entities person --limit 5
┌──────────────────┬─────────┬───────────────────────┐
│ ID               │ Type    │ Name                  │
├──────────────────┼─────────┼───────────────────────┤
│ ent_abc123...    │ person  │ Alice                 │
│ ent_def456...    │ person  │ Bob                   │
│ ent_ghi789...    │ person  │ Charlie               │
└──────────────────┴─────────┴───────────────────────┘

contextgraph> verify
Provenance Chain Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ✓ VALID
Entries verified: 203
Broken links: 0
Invalid hashes: 0

contextgraph> exit
Goodbye!
```

## Testing

The project includes comprehensive tests for all packages:

```bash
# Run all tests
pnpm -r test

# Run tests for a specific package
pnpm --filter @contextgraph/sdk test

# Run integration tests (demos)
pnpm --filter @contextgraph/demos test
```

**Test Coverage:** 646 tests across 19 packages

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
| E14 | ✅ | REST API layer |
| E14b | ✅ | Webhook support |
| E14c | ✅ | Import/Export functionality |
| E15a | ✅ | Role-Based Access Control (RBAC) |
| E15b | ✅ | Compliance Reports & GDPR |
| E15c | ✅ | Policy Templates & Simulation |
| E15d | ✅ | Agent Hierarchies & Delegation |
| E16a | ✅ | OpenTelemetry Integration |

## License

This project is dual-licensed:

- **AGPL-3.0** - Free for open source use (requires source disclosure for modifications and network services)
- **Commercial License** - Available for proprietary use without AGPL obligations

See [LICENSING.md](./LICENSING.md) for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
