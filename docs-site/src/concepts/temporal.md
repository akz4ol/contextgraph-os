# Temporal Data

Time is a first-class citizen in ContextGraph OS. All data is temporally qualified, allowing you to query the state of your knowledge graph at any point in time.

## Why Temporal Data?

Traditional databases answer: "What is the current state?"

ContextGraph answers:
- "What is the current state?"
- "What was the state on June 15, 2024?"
- "When did this value change?"
- "What will be the state next month?" (for claims with future validity)

## Temporal Concepts

### Timestamps

All times in ContextGraph use branded timestamps:

```typescript
import { createTimestamp, Timestamp } from '@contextgraph/core';

// Create a timestamp
const now = createTimestamp();
const specific = createTimestamp('2024-06-15T10:30:00Z');

// Timestamps are ISO 8601 strings with branding
type Timestamp = string & { readonly __brand: 'Timestamp' };
```

### Validity Periods

Claims have explicit validity periods:

```typescript
interface TemporalContext {
  validFrom: Timestamp;      // When this becomes true
  validUntil: Timestamp | null;  // When this stops being true (null = forever)
  observedAt: Timestamp;     // When this was recorded
}
```

### Example: Employee Role Changes

```typescript
// Alice joins as Junior Developer on Jan 1
await client.addClaim({
  subjectId: aliceId,
  predicate: 'role',
  value: 'Junior Developer',
  context: {
    validFrom: createTimestamp('2024-01-01'),
    validUntil: createTimestamp('2024-06-30'),
  }
});

// Alice becomes Senior Developer on July 1
await client.addClaim({
  subjectId: aliceId,
  predicate: 'role',
  value: 'Senior Developer',
  context: {
    validFrom: createTimestamp('2024-07-01'),
    validUntil: null, // Current role
  }
});
```

## Point-in-Time Queries

Query the knowledge graph as it was at any point:

```typescript
// What was Alice's role in March 2024?
const marchClaims = await client.getClaims(aliceId, {
  asOf: createTimestamp('2024-03-15'),
  predicate: 'role'
});
// Returns: 'Junior Developer'

// What is Alice's role now?
const currentClaims = await client.getClaims(aliceId, {
  predicate: 'role'
});
// Returns: 'Senior Developer'
```

## Temporal Query Operators

### As Of (Point in Time)

```typescript
// State at a specific moment
const claims = await ckg.query({
  subjectId: entityId,
  asOf: createTimestamp('2024-06-15T12:00:00Z')
});
```

### Between (Time Range)

```typescript
// All claims that were valid during Q2 2024
const q2Claims = await ckg.query({
  subjectId: entityId,
  validDuring: {
    from: createTimestamp('2024-04-01'),
    to: createTimestamp('2024-06-30')
  }
});
```

### Active Only

```typescript
// Only claims currently valid
const activeClaims = await ckg.query({
  subjectId: entityId,
  activeOnly: true
});
```

## Temporal Patterns

### Superseding Claims

When new information supersedes old:

```typescript
// Original claim
const original = await client.addClaim({
  subjectId: productId,
  predicate: 'price',
  value: 99.99,
  context: {
    validFrom: createTimestamp('2024-01-01'),
    validUntil: null
  }
});

// Update: new price takes effect
await client.addClaim({
  subjectId: productId,
  predicate: 'price',
  value: 89.99,
  context: {
    validFrom: createTimestamp('2024-06-01'),
    validUntil: null
  }
});

// Mark old claim as ended
await client.updateClaimValidity(original.value.data.id, {
  validUntil: createTimestamp('2024-05-31')
});
```

### Scheduled Changes

Claims that become valid in the future:

```typescript
// Price change scheduled for next month
await client.addClaim({
  subjectId: productId,
  predicate: 'price',
  value: 79.99,
  context: {
    validFrom: createTimestamp('2024-07-01'),  // Future date
    validUntil: null
  }
});

// Query for July will return the scheduled price
const julyClaims = await client.getClaims(productId, {
  asOf: createTimestamp('2024-07-15'),
  predicate: 'price'
});
// Returns: 79.99
```

### Retroactive Corrections

When you discover past data was wrong:

```typescript
// We discovered the Q1 data was incorrect
// Record the correction with proper timestamps
await client.addClaim({
  subjectId: reportId,
  predicate: 'revenue',
  value: 1500000,  // Corrected value
  context: {
    validFrom: createTimestamp('2024-01-01'),
    validUntil: createTimestamp('2024-03-31'),
    // observedAt will be now, showing when we learned this
  }
});

// The original claim stays in provenance for audit
```

## Time Utilities

### Comparing Timestamps

```typescript
import { isAfter, isBefore, isBetween } from '@contextgraph/core';

if (isAfter(timestamp1, timestamp2)) {
  // timestamp1 is later
}

if (isBetween(check, start, end)) {
  // check is within the range
}
```

### Duration Calculations

```typescript
import { duration, addDuration } from '@contextgraph/core';

// Calculate duration
const age = duration(startTime, endTime);
console.log(`${age.days} days, ${age.hours} hours`);

// Add duration to timestamp
const futureTime = addDuration(now, { days: 30 });
```

## Temporal Indexes

For efficient temporal queries, ContextGraph maintains temporal indexes:

```typescript
// These queries are optimized:

// Point-in-time lookup
await ckg.query({ subjectId, asOf: timestamp });

// Range query
await ckg.query({ validFrom: start, validTo: end });

// Active claims
await ckg.query({ activeOnly: true });
```

## Best Practices

### 1. Always Specify Validity

```typescript
// Good - explicit validity
await client.addClaim({
  subjectId: id,
  predicate: 'status',
  value: 'active',
  context: {
    validFrom: createTimestamp(),
    validUntil: null
  }
});

// Avoid - relying on defaults
await client.addClaim({
  subjectId: id,
  predicate: 'status',
  value: 'active'
});
```

### 2. Use Appropriate Granularity

```typescript
// For daily values, use date precision
const dailyTimestamp = createTimestamp('2024-06-15');

// For real-time data, use full precision
const preciseTimestamp = createTimestamp(); // Includes milliseconds
```

### 3. Handle Time Zones Properly

```typescript
// Always use UTC for storage
const utcTime = createTimestamp('2024-06-15T10:00:00Z');

// Convert for display in user's timezone
const userTime = formatInTimezone(utcTime, 'America/New_York');
```

## Next Steps

- [Decisions as Data](./decisions.md) - Decision lifecycle
- [Context Filtering](./context.md) - Advanced filtering
- [Temporal Queries Tutorial](../tutorials/temporal-queries.md) - Hands-on examples
