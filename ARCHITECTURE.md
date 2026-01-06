# ContextGraph OS Architecture

## Overview

ContextGraph OS is a provenance-first, time-aware, decision-trace substrate for auditable AI agents with governed autonomy.

## Core Principles

1. **Provenance First**: All data must trace to its source
2. **Time is First Class**: All claims are temporally qualified
3. **No Hidden Reasoning**: Decision traces are explicit and inspectable
4. **Decisions are Data**: Decisions are first-class graph objects
5. **Agents are Constrained**: Navigation bounded by problem-space graphs
6. **Auditability Required**: All operations must be traceable

## Package Architecture

```
packages/
├── core/           # Core types, utilities, branded types
├── ontology/       # Schema definitions and validation
├── storage/        # Backend-agnostic persistence layer
├── ckg/            # Contextual Knowledge Graph (claims, entities)
├── provenance/     # Provenance and lineage tracking
├── dtg/            # Decision Trace Graph
├── exceptions/     # Exception and override handling
├── policy/         # Policy DSL and enforcement
├── agent/          # Agent framework and constraints
├── retrieval/      # Context assembly and ranking
└── api/            # External API layer
```

## Architectural Invariants

### 1. Immutability Contract
- All claims are immutable after creation
- Provenance records are append-only
- Decisions can transition states but never be deleted

### 2. Provenance Contract
- Every claim MUST have a provenance reference
- Provenance chain MUST be unbroken
- Hash integrity MUST be verified on read

### 3. Temporal Contract
- All claims MUST have temporal context
- Overlapping claims are supported
- Time queries must be deterministic

### 4. Ontology Contract
- All entities must conform to registered ontology
- Invalid relations are rejected at write time
- Ontology version must be explicit in all operations

### 5. Decision Contract
- Decisions must reference evidence (claims)
- State transitions must be logged
- Precedents are linked, not copied

## Data Flow

```
External Source → Provenance Record → Claim → Entity Resolution
                       ↓
                 Decision Proposal → Policy Check → Approval Flow
                       ↓
                 Execution → Outcome Recording → Audit Trail
```

## Storage Layer

The storage layer provides backend-agnostic persistence:

```typescript
interface StorageInterface {
  insert<T>(collection: string, record: T): Promise<Result<T, Error>>
  findById<T>(collection: string, id: string): Promise<Result<T | null, Error>>
  find<T>(collection: string, criteria: object, options?: QueryOptions): Promise<Result<PaginatedResult<T>, Error>>
  // ... transactions, stats, etc.
}
```

Implementations:
- `SQLiteStorage`: Production SQLite with sql.js (pure JS)
- `InMemoryStorage`: Testing and prototyping

## Type Safety

All identifiers use branded types to prevent mixing:

```typescript
type EntityId = Brand<string, 'EntityId'>
type ClaimId = Brand<string, 'ClaimId'>
type DecisionId = Brand<string, 'DecisionId'>
type ProvenanceId = Brand<string, 'ProvenanceId'>
```

## Error Handling

All operations return `Result<T, E>`:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

## Module Dependencies

```
core ← ontology ← ckg ← provenance ← dtg ← policy ← agent ← api
       ↑          ↑      ↑            ↑      ↑
       storage ───┴──────┴────────────┴──────┘
```

## Security Boundaries

- All external input validated against ontology
- Policy enforcement at decision execution
- Rate limiting at API layer
- Audit logging for all mutations

## Runtime Requirements

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Pure JavaScript (no native dependencies)

## Configuration

Environment-based configuration with validation:

```typescript
interface Config {
  storage: {
    type: 'sqlite' | 'memory'
    path?: string
  }
  api: {
    port: number
    cors: boolean
  }
}
```
