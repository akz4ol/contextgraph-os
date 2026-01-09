# @contextgraph/core

The foundational package providing branded types, Result pattern, time utilities, and error types used throughout ContextGraph OS.

## Installation

```bash
pnpm add @contextgraph/core
```

## Branded Types

All identifiers use branded types for compile-time safety:

```typescript
// Branded type definitions
type EntityId = string & { readonly __brand: 'EntityId' };
type ClaimId = string & { readonly __brand: 'ClaimId' };
type AgentId = string & { readonly __brand: 'AgentId' };
type DecisionId = string & { readonly __brand: 'DecisionId' };
type PolicyId = string & { readonly __brand: 'PolicyId' };
type ProvenanceId = string & { readonly __brand: 'ProvenanceId' };
type Timestamp = string & { readonly __brand: 'Timestamp' };
```

### Creating IDs

```typescript
import {
  createEntityId,
  createClaimId,
  createAgentId,
  createTimestamp,
} from '@contextgraph/core';

const entityId = createEntityId();      // ent_abc123...
const claimId = createClaimId();        // clm_def456...
const agentId = createAgentId();        // agt_ghi789...
const timestamp = createTimestamp();    // 2024-01-15T10:30:00.000Z
```

## Result Pattern

All operations return `Result<T, Error>` instead of throwing exceptions:

```typescript
import { ok, err, type Result } from '@contextgraph/core';

// Creating results
function divide(a: number, b: number): Result<number> {
  if (b === 0) {
    return err(new Error('Division by zero'));
  }
  return ok(a / b);
}

// Using results
const result = divide(10, 2);

if (result.ok) {
  console.log(result.value); // 5
} else {
  console.error(result.error.message);
}
```

### Result Utilities

```typescript
import { isOk, isErr, unwrapOr, map, flatMap } from '@contextgraph/core';

// Type guards
if (isOk(result)) {
  console.log(result.value);
}

// Default value
const value = unwrapOr(result, 0);

// Transform success value
const mapped = map(result, x => x * 2);

// Chain operations
const chained = flatMap(result1, val =>
  otherOperation(val)
);
```

## Time Utilities

### Creating Timestamps

```typescript
import { createTimestamp } from '@contextgraph/core';

// Current time
const now = createTimestamp();

// Specific time
const specific = createTimestamp('2024-06-15T10:30:00Z');

// From Date
const fromDate = createTimestamp(new Date());
```

### Time Comparisons

```typescript
import { isAfter, isBefore, isBetween } from '@contextgraph/core';

if (isAfter(timestamp1, timestamp2)) {
  // timestamp1 is later than timestamp2
}

if (isBetween(check, start, end)) {
  // check is within [start, end]
}
```

### Duration Utilities

```typescript
import { duration, addDuration, subtractDuration } from '@contextgraph/core';

// Calculate duration
const elapsed = duration(start, end);
// { days: 5, hours: 2, minutes: 30, seconds: 0, ms: 0 }

// Add duration
const future = addDuration(now, { days: 7 });

// Subtract duration
const past = subtractDuration(now, { hours: 24 });
```

## Context Types

### Scope

```typescript
import { createScope, type Scope } from '@contextgraph/core';

const workScope = createScope('work');
const personalScope = createScope('personal');
const scope = createScope('work:hr:benefits'); // Hierarchical
```

### Jurisdiction

```typescript
import { createJurisdiction, type Jurisdiction } from '@contextgraph/core';

const usJurisdiction = createJurisdiction('US');
const euJurisdiction = createJurisdiction('EU');
const stateJurisdiction = createJurisdiction('US-CA');
```

### Confidence

```typescript
import { createConfidence, type Confidence } from '@contextgraph/core';

const highConfidence = createConfidence(0.95);  // 95%
const mediumConfidence = createConfidence(0.7);
const lowConfidence = createConfidence(0.5);

// Confidence must be between 0 and 1
createConfidence(1.5); // Throws error
```

## Error Types

### ContextGraphError

```typescript
import { ContextGraphError, ErrorCode } from '@contextgraph/core';

throw new ContextGraphError(
  ErrorCode.NOT_FOUND,
  'Entity not found',
  { entityId }
);
```

### Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not found |
| `ALREADY_EXISTS` | Resource already exists |
| `VALIDATION_ERROR` | Validation failed |
| `PERMISSION_DENIED` | Insufficient permissions |
| `POLICY_DENIED` | Policy blocked the operation |
| `STORAGE_ERROR` | Storage operation failed |
| `INTEGRITY_ERROR` | Data integrity violation |
| `TIMEOUT` | Operation timed out |

## Type Guards

```typescript
import {
  isEntityId,
  isClaimId,
  isAgentId,
  isTimestamp,
} from '@contextgraph/core';

if (isEntityId(value)) {
  // TypeScript knows value is EntityId
}
```

## Constants

```typescript
import {
  MAX_STRING_LENGTH,
  MAX_PROPERTIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@contextgraph/core';
```

## Type Exports

```typescript
export type {
  EntityId,
  ClaimId,
  AgentId,
  DecisionId,
  PolicyId,
  ProvenanceId,
  Timestamp,
  Scope,
  Jurisdiction,
  Confidence,
  Result,
};
```
