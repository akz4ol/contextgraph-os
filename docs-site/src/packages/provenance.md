# @contextgraph/provenance

Immutable provenance ledger with hash chain verification.

## Installation

```bash
pnpm add @contextgraph/provenance
```

## Overview

The provenance ledger tracks the origin of all data in ContextGraph:

- Every mutation creates a provenance entry
- Entries are hash-chained for integrity
- The chain can be verified at any time

## Creating the Ledger

```typescript
import { ProvenanceLedger } from '@contextgraph/provenance';

const ledger = new ProvenanceLedger(storage);
await ledger.initialize();
```

## Recording Provenance

### Basic Record

```typescript
const entry = await ledger.record({
  type: 'claim_created',
  subjectId: entityId,
  data: { predicate: 'status', value: 'active' },
  source: {
    type: 'agent',
    id: agentId,
    method: 'api_call',
  },
});
```

### Entry Types

| Type | Description |
|------|-------------|
| `claim_created` | New claim added |
| `claim_revoked` | Claim revoked |
| `entity_created` | New entity created |
| `entity_updated` | Entity properties updated |
| `decision_recorded` | Decision recorded |
| `decision_approved` | Decision approved |
| `decision_rejected` | Decision rejected |
| `execution_logged` | Action executed |
| `policy_created` | Policy created |

### Source Types

```typescript
// Agent source
{ type: 'agent', id: 'agt_123', method: 'process_data' }

// User source
{ type: 'user', id: 'user_456', method: 'manual_entry' }

// System source
{ type: 'system', id: 'scheduler', method: 'batch_job' }

// External source
{ type: 'external', id: 'weather_api', method: 'sync' }

// Inference source
{ type: 'inference', id: 'reasoner', method: 'transitive_closure' }
```

## Querying Provenance

### Get by ID

```typescript
const entry = await ledger.get(provenanceId);
```

### Query by Subject

```typescript
const entries = await ledger.query({
  subjectId: entityId,
  limit: 100,
});
```

### Query by Type

```typescript
const claimEntries = await ledger.query({
  type: 'claim_created',
  from: startTime,
  to: endTime,
});
```

### Query by Agent

```typescript
const agentActions = await ledger.query({
  agentId: agentId,
  limit: 50,
});
```

## Chain Verification

### Verify Entire Chain

```typescript
const result = await ledger.verify();

console.log(`Valid: ${result.valid}`);
console.log(`Entries verified: ${result.entriesVerified}`);
console.log(`Broken links: ${result.brokenLinks}`);
console.log(`Invalid hashes: ${result.invalidHashes}`);
```

### Verify Specific Range

```typescript
const result = await ledger.verify({
  from: startId,
  to: endId,
});
```

## Entry Structure

```typescript
interface ProvenanceEntry {
  id: ProvenanceId;
  hash: string;              // SHA-256 hash
  previousHash: string | null; // Link to previous
  type: ProvenanceType;
  subjectId: string;
  data: unknown;
  source: ProvenanceSource;
  timestamp: Timestamp;
  agentId?: AgentId;
}
```

## Hash Calculation

The hash includes:

```typescript
const hashData = {
  previousHash,
  type,
  subjectId,
  data,
  source,
  timestamp,
};

const hash = sha256(JSON.stringify(hashData));
```

## Statistics

```typescript
const stats = await ledger.getStats();

console.log(`Total entries: ${stats.totalEntries}`);
console.log(`First entry: ${stats.firstEntryId}`);
console.log(`Last entry: ${stats.lastEntryId}`);
```

## Integrity Monitoring

```typescript
// Periodic verification
setInterval(async () => {
  const result = await ledger.verify();
  if (!result.valid) {
    alertOps('Provenance chain integrity failure');
  }
}, 60 * 60 * 1000); // Hourly
```
