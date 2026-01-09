# Temporal Queries

Master point-in-time queries and temporal data management.

## What You'll Learn

- Query data at any point in time
- Handle temporal validity periods
- Track changes over time
- Build temporal reports

## Setup

```typescript
import {
  ContextGraph,
  createTimestamp,
  createScope,
  createConfidence,
} from '@contextgraph/sdk';

const client = await ContextGraph.create().then(r => r.value);
```

## Creating Temporal Data

### Claims with Validity Periods

```typescript
// Current position
await client.addClaim({
  subjectId: aliceId,
  predicate: 'position',
  value: 'Senior Engineer',
  context: {
    validFrom: createTimestamp('2024-01-01'),
    validUntil: null, // Still valid
  },
});

// Previous position
await client.addClaim({
  subjectId: aliceId,
  predicate: 'position',
  value: 'Engineer',
  context: {
    validFrom: createTimestamp('2022-01-01'),
    validUntil: createTimestamp('2023-12-31'),
  },
});
```

## Point-in-Time Queries

### Query Current State

```typescript
const currentClaims = await client.getClaims(aliceId);
// Returns: 'Senior Engineer'
```

### Query Historical State

```typescript
const march2023Claims = await client.getClaims(aliceId, {
  asOf: createTimestamp('2023-03-15'),
  predicate: 'position',
});
// Returns: 'Engineer'
```

### Query Future State

```typescript
// Scheduled change
await client.addClaim({
  subjectId: aliceId,
  predicate: 'position',
  value: 'Principal Engineer',
  context: {
    validFrom: createTimestamp('2025-01-01'),
    validUntil: null,
  },
});

const futureState = await client.getClaims(aliceId, {
  asOf: createTimestamp('2025-06-01'),
  predicate: 'position',
});
// Returns: 'Principal Engineer'
```

## Time Range Queries

### Claims Valid During Period

```typescript
const q2_2024_claims = await ckg.query({
  subjectId: aliceId,
  validDuring: {
    from: createTimestamp('2024-04-01'),
    to: createTimestamp('2024-06-30'),
  },
});
```

### All Historical Values

```typescript
const allPositions = await ckg.query({
  subjectId: aliceId,
  predicate: 'position',
  includeExpired: true,
});

for (const claim of allPositions) {
  console.log(`${claim.data.value}: ${claim.data.validFrom} - ${claim.data.validUntil}`);
}
// Output:
// Engineer: 2022-01-01 - 2023-12-31
// Senior Engineer: 2024-01-01 - null
// Principal Engineer: 2025-01-01 - null
```

## Tracking Changes

### Change History

```typescript
async function getChangeHistory(entityId: EntityId, predicate: string) {
  const claims = await ckg.query({
    subjectId: entityId,
    predicate,
    includeExpired: true,
    sortBy: 'validFrom',
  });

  return claims.map(c => ({
    value: c.data.value,
    from: c.data.validFrom,
    to: c.data.validUntil,
    status: c.data.status,
  }));
}

const history = await getChangeHistory(aliceId, 'position');
```

### When Did Value Change?

```typescript
async function whenDidValueChange(
  entityId: EntityId,
  predicate: string,
  targetValue: unknown
) {
  const claims = await ckg.query({
    subjectId: entityId,
    predicate,
    includeExpired: true,
  });

  const match = claims.find(c => c.data.value === targetValue);
  return match?.data.validFrom;
}

const promotionDate = await whenDidValueChange(
  aliceId,
  'position',
  'Senior Engineer'
);
```

## Temporal Reports

### Snapshot Report

```typescript
async function generateSnapshotReport(asOf: Timestamp) {
  const entities = await ckg.findEntitiesByType('employee', { limit: 1000 });

  const report = [];
  for (const entity of entities.value) {
    const claims = await client.getClaims(entity.data.id, { asOf });
    report.push({
      id: entity.data.id,
      name: entity.data.name,
      claims: claims.value.map(c => ({
        predicate: c.data.predicate,
        value: c.data.value,
      })),
    });
  }

  return report;
}

// Snapshot from last year
const lastYearReport = await generateSnapshotReport(
  createTimestamp('2023-12-31')
);
```

### Change Report

```typescript
async function generateChangeReport(from: Timestamp, to: Timestamp) {
  const provenance = await ledger.query({
    type: ['claim_created', 'claim_revoked'],
    from,
    to,
  });

  return provenance.value.map(entry => ({
    type: entry.data.type,
    timestamp: entry.data.timestamp,
    subject: entry.data.subjectId,
    data: entry.data.data,
  }));
}
```

## Best Practices

1. **Always specify validity** - Don't rely on defaults
2. **Use appropriate granularity** - Day vs. millisecond precision
3. **Handle null validUntil** - Means "currently valid"
4. **Index temporal fields** - For query performance
5. **Audit temporal changes** - Track who changed what when

## Next Steps

- [Temporal Data Concepts](../concepts/temporal.md)
- [Context Filtering](../concepts/context.md)
