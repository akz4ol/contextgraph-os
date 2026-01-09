# Architecture Overview

ContextGraph OS is designed as a layered architecture where each layer builds upon the capabilities of the layers below it.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ContextGraph OS                          │
├─────────────────────────────────────────────────────────────────┤
│  Interface Layer                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  REST API   │  │     CLI     │  │  Webhooks   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  SDK Layer                                                      │
│  ┌─────────────────────────────────────────────────┐           │
│  │                      SDK                         │           │
│  │  (Unified API for all ContextGraph operations)  │           │
│  └─────────────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Advanced Capabilities Layer                                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐ ┌───────────┐  │
│  │    Viz    │ │ Reasoning │ │Recommendations│ │ Telemetry │  │
│  └───────────┘ └───────────┘ └───────────────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Execution Layer                                                │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │  Executor   │  │  Handlers   │                              │
│  └─────────────┘  └─────────────┘                              │
├─────────────────────────────────────────────────────────────────┤
│  Agent Layer                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Agents    │  │ Capabilities│  │ Hierarchies │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Governance Layer                                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐│
│  │  Policy   │ │Exceptions │ │   RBAC    │ │   Compliance    ││
│  └───────────┘ └───────────┘ └───────────┘ └─────────────────┘│
│  ┌─────────────────────────────────────────────────┐           │
│  │              Decision Trace Graph               │           │
│  └─────────────────────────────────────────────────┘           │
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

## Layer Descriptions

### Foundation Layer

The base layer providing essential primitives:

| Package | Purpose |
|---------|---------|
| **core** | Branded types, Result pattern, time utilities, error types |
| **storage** | Abstract storage interface with SQLite and in-memory implementations |
| **ontology** | Schema definitions, versioning, validation, code generation |

### Knowledge Layer

Manages all knowledge and provenance:

| Package | Purpose |
|---------|---------|
| **ckg** | Contextual Knowledge Graph - entities and claims with temporal context |
| **provenance** | Immutable ledger tracking all data origins with hash chain verification |
| **retrieval** | Context assembly with temporal, scope, and confidence filtering |

### Governance Layer

Handles policies, decisions, and access control:

| Package | Purpose |
|---------|---------|
| **dtg** | Decision Trace Graph - tracks decisions through their lifecycle |
| **policy** | Policy ledger with deny-takes-precedence evaluation |
| **exceptions** | Exception requests and approvals for policy overrides |
| **rbac** | Role-based access control with permission inheritance |
| **compliance** | Audit reports, GDPR features, compliance tracking |

### Agent Layer

Manages autonomous agents and their capabilities:

| Package | Purpose |
|---------|---------|
| **agent** | Agent registry, capabilities, and problem-space graphs |
| **execution** | Action execution framework with policy enforcement |

### Advanced Capabilities Layer

Specialized features for analysis and insight:

| Package | Purpose |
|---------|---------|
| **viz** | Visualization in DOT, Mermaid, D3.js, and SVG formats |
| **reasoning** | Semantic reasoning, inference rules, contradiction detection |
| **recommendations** | Decision recommendations based on precedents |
| **telemetry** | OpenTelemetry-compatible tracing, metrics, logging |

### Interface Layer

External interfaces for system access:

| Package | Purpose |
|---------|---------|
| **sdk** | Unified TypeScript SDK for all operations |
| **api** | REST API with authentication and rate limiting |
| **cli** | Command-line tools and interactive REPL |
| **webhooks** | Event notifications via HTTP callbacks |

## Data Flow

### Claim Creation Flow

```
User/Agent Request
       │
       ▼
   ┌───────┐
   │  SDK  │
   └───┬───┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Policy    │────▶│   Enforce   │
│  Evaluation │     │  Decision   │
└─────────────┘     └──────┬──────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│     CKG     │                         │ Provenance  │
│ Store Claim │                         │   Record    │
└─────────────┘                         └─────────────┘
       │                                       │
       └───────────────────┬───────────────────┘
                           ▼
                    ┌─────────────┐
                    │   Storage   │
                    └─────────────┘
```

### Decision Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PROPOSED │────▶│ APPROVED │────▶│ EXECUTED │────▶│COMPLETED │
└──────────┘     └────┬─────┘     └──────────┘     └──────────┘
      │               │
      │               ▼
      │          ┌──────────┐
      └─────────▶│ REJECTED │
                 └──────────┘
```

## Key Design Patterns

### 1. Branded Types

All identifiers are branded types for type safety:

```typescript
type EntityId = string & { readonly __brand: 'EntityId' };
type ClaimId = string & { readonly __brand: 'ClaimId' };
type AgentId = string & { readonly __brand: 'AgentId' };
```

### 2. Result Pattern

All operations return `Result<T, Error>` instead of throwing:

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### 3. Temporal Context

All data includes temporal qualifications:

```typescript
interface TemporalContext {
  validFrom: Timestamp;
  validUntil: Timestamp | null;
  observedAt: Timestamp;
}
```

### 4. Provenance Chain

Every data mutation creates a provenance entry with hash linking:

```typescript
interface ProvenanceEntry {
  id: ProvenanceId;
  hash: string;
  previousHash: string | null;
  type: ProvenanceType;
  data: unknown;
  timestamp: Timestamp;
}
```

## Storage Architecture

### Abstract Interface

```typescript
interface StorageInterface {
  get<T>(key: string): Promise<Result<T | null>>;
  set<T>(key: string, value: T): Promise<Result<void>>;
  delete(key: string): Promise<Result<void>>;
  list<T>(prefix: string): Promise<Result<T[]>>;
  query<T>(query: Query): Promise<Result<T[]>>;
}
```

### Implementations

- **InMemoryStorage**: Fast, ephemeral, great for testing
- **SQLiteStorage**: Persistent, ACID-compliant, production-ready

## Extension Points

### Custom Storage

Implement `StorageInterface` for custom backends:

```typescript
class RedisStorage implements StorageInterface {
  // Implementation
}
```

### Custom Action Handlers

Register handlers for any action type:

```typescript
client.registerHandler('custom', 'resource', async (action) => {
  // Handle the action
  return ok(result);
});
```

### Custom Policy Conditions

Extend policy conditions:

```typescript
{
  field: 'custom.property',
  operator: 'custom_op',
  value: 'expected'
}
```

## Next Steps

- [Core Concepts](../concepts/provenance.md) - Understand the principles
- [Package Documentation](../packages/core.md) - Detailed package guides
- [Tutorials](../tutorials/auditable-agent.md) - Hands-on examples
