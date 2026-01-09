# @contextgraph/ckg

Contextual Knowledge Graph - entities and claims with full temporal context.

## Installation

```bash
pnpm add @contextgraph/ckg
```

## Overview

The CKG (Contextual Knowledge Graph) stores:

- **Entities**: Objects with types and properties
- **Claims**: Statements about entities with temporal validity

## Creating a CKG

```typescript
import { CKG } from '@contextgraph/ckg';

const ckg = new CKG(storage, provenanceLedger);
await ckg.initialize();
```

## Entity Operations

### Create Entity

```typescript
const result = await ckg.createEntity({
  type: 'person',
  name: 'Alice',
  properties: {
    email: 'alice@example.com',
    department: 'Engineering',
  },
});

const entity = result.value;
// { id: 'ent_abc123', type: 'person', name: 'Alice', ... }
```

### Get Entity

```typescript
const entity = await ckg.getEntity(entityId);
```

### Update Entity

```typescript
await ckg.updateEntity(entityId, {
  properties: {
    department: 'Product',
  },
});
```

### Find Entities

```typescript
const entities = await ckg.findEntitiesByType('person', {
  limit: 100,
  offset: 0,
});
```

## Claim Operations

### Add Claim

```typescript
const claim = await ckg.addClaim({
  subjectId: entityId,
  predicate: 'works_on',
  objectValue: projectId,
  context: {
    scope: createScope('work'),
    confidence: createConfidence(1.0),
    validFrom: createTimestamp(),
    validUntil: null,
  },
});
```

### Get Claims for Subject

```typescript
const claims = await ckg.getClaimsForSubject(entityId);
```

### Get Specific Claim

```typescript
const claim = await ckg.getClaim(claimId);
```

### Revoke Claim

```typescript
await ckg.revokeClaim(claimId, 'Information superseded');
```

## Temporal Queries

### Point-in-Time

```typescript
// Get claims valid at specific time
const claims = await ckg.getClaimsForSubject(entityId, {
  asOf: createTimestamp('2024-06-15'),
});
```

### Time Range

```typescript
const claims = await ckg.query({
  subjectId: entityId,
  validFrom: startTimestamp,
  validTo: endTimestamp,
});
```

### Active Only

```typescript
const activeClaims = await ckg.getClaimsForSubject(entityId, {
  activeOnly: true,
});
```

## Context Filtering

```typescript
// Filter by jurisdiction
const euClaims = await ckg.query({
  subjectId: entityId,
  jurisdiction: 'EU',
});

// Filter by scope
const workClaims = await ckg.query({
  subjectId: entityId,
  scope: 'work',
});

// Filter by confidence
const highConfidenceClaims = await ckg.query({
  subjectId: entityId,
  minConfidence: 0.9,
});
```

## Claim Types

Claims can have different value types:

```typescript
// String value
{ predicate: 'name', objectValue: 'Alice' }

// Number value
{ predicate: 'age', objectValue: 30 }

// Boolean value
{ predicate: 'isActive', objectValue: true }

// Reference to another entity
{ predicate: 'manages', objectId: otherEntityId }
```

## Entity Interface

```typescript
interface Entity {
  id: EntityId;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Claim Interface

```typescript
interface Claim {
  id: ClaimId;
  subjectId: EntityId;
  predicate: string;
  objectValue?: unknown;
  objectId?: EntityId;
  context: ClaimContext;
  status: 'active' | 'revoked';
  createdAt: Timestamp;
  revokedAt?: Timestamp;
  revokedReason?: string;
}

interface ClaimContext {
  scope?: Scope;
  jurisdiction?: Jurisdiction;
  confidence?: Confidence;
  validFrom?: Timestamp;
  validUntil?: Timestamp | null;
}
```

## Statistics

```typescript
const stats = await ckg.getStats();

console.log(`Entities: ${stats.entityCount}`);
console.log(`Claims: ${stats.claimCount}`);
console.log(`Active claims: ${stats.activeClaimCount}`);
```
