# @contextgraph/retrieval

Context assembly with temporal and scope filtering.

## Installation

```bash
pnpm add @contextgraph/retrieval
```

## Overview

The retrieval package assembles context for entities by:

- Gathering relevant claims
- Filtering by temporal context
- Filtering by jurisdiction and scope
- Traversing relationships

## Context Assembly

```typescript
import { ContextAssembler } from '@contextgraph/retrieval';

const assembler = new ContextAssembler(ckg, provenance, storage);

const context = await assembler.assemble(entityId, {
  asOf: createTimestamp('2024-06-15'),
  jurisdiction: 'EU',
  scope: 'work',
  minConfidence: 0.8,
  depth: 2,
  includeProvenance: true,
});
```

## Assembly Options

```typescript
interface AssemblyOptions {
  // Temporal filter
  asOf?: Timestamp;

  // Jurisdictional filter
  jurisdiction?: string;

  // Scope filter
  scope?: string;

  // Confidence threshold
  minConfidence?: number;

  // Relationship traversal depth
  depth?: number;

  // Include provenance records
  includeProvenance?: boolean;

  // Include specific predicates only
  predicates?: string[];

  // Exclude specific predicates
  excludePredicates?: string[];

  // Maximum claims per entity
  maxClaims?: number;
}
```

## Context Result

```typescript
interface AssembledContext {
  // Primary entity
  entity: Entity;

  // Claims about the entity
  claims: Claim[];

  // Related entities (up to depth)
  relatedEntities: Map<EntityId, Entity>;

  // Claims about related entities
  relatedClaims: Map<EntityId, Claim[]>;

  // Provenance records (if requested)
  provenance?: ProvenanceEntry[];

  // Applied filters
  filters: {
    asOf?: Timestamp;
    jurisdiction?: string;
    scope?: string;
    minConfidence?: number;
  };

  // Assembly statistics
  stats: {
    claimCount: number;
    relatedEntityCount: number;
    maxDepthReached: number;
  };
}
```

## Filtering Examples

### Temporal

```typescript
// Get context as of last quarter
const q3Context = await assembler.assemble(entityId, {
  asOf: createTimestamp('2024-09-30'),
});
```

### Jurisdictional

```typescript
// Get EU-compliant context
const euContext = await assembler.assemble(entityId, {
  jurisdiction: 'EU',
});
```

### Confidence

```typescript
// Get only high-confidence claims
const highConfidence = await assembler.assemble(entityId, {
  minConfidence: 0.9,
});
```

## Relationship Traversal

```typescript
// Traverse 3 levels of relationships
const deepContext = await assembler.assemble(entityId, {
  depth: 3,
});

// Access related entities
for (const [id, entity] of context.relatedEntities) {
  console.log(`Related: ${entity.name}`);
}
```
