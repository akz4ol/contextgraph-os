# Provenance First

Provenance is the cornerstone of ContextGraph OS. Every piece of data in the system has a traceable origin, ensuring complete auditability and trust.

## What is Provenance?

Provenance answers the question: **"Where did this data come from?"**

In ContextGraph, provenance tracking means:

- Every claim has a documented source
- Every change is recorded in an immutable ledger
- The entire history can be verified cryptographically
- No orphan data exists in the system

## The Provenance Ledger

The provenance ledger is an append-only, hash-chained log of all data mutations:

```typescript
interface ProvenanceEntry {
  id: ProvenanceId;
  hash: string;           // SHA-256 hash of this entry
  previousHash: string;   // Link to previous entry
  type: ProvenanceType;   // claim_created, entity_created, etc.
  subjectId: string;      // What this is about
  data: unknown;          // Entry-specific data
  source: ProvenanceSource;
  timestamp: Timestamp;
  agentId?: AgentId;      // Who created this
}

type ProvenanceType =
  | 'claim_created'
  | 'claim_revoked'
  | 'entity_created'
  | 'entity_updated'
  | 'decision_recorded'
  | 'policy_created'
  | 'execution_logged';
```

## Hash Chain Verification

Each entry contains a hash of its contents and a reference to the previous entry's hash, creating an unbreakable chain:

```
Entry 1          Entry 2          Entry 3
┌─────────┐      ┌─────────┐      ┌─────────┐
│ hash: A │◄─────│prevHash:A│◄─────│prevHash:B│
│ prev: ∅ │      │ hash: B │      │ hash: C │
│ data... │      │ data... │      │ data... │
└─────────┘      └─────────┘      └─────────┘
```

To verify integrity:

```typescript
const verification = await client.verifyProvenance();

if (verification.value.valid) {
  console.log('Chain integrity verified');
  console.log(`Entries: ${verification.value.entriesVerified}`);
} else {
  console.log('Chain corrupted!');
  console.log(`Broken links: ${verification.value.brokenLinks}`);
  console.log(`Invalid hashes: ${verification.value.invalidHashes}`);
}
```

## Provenance Sources

Every entry has a source describing its origin:

```typescript
interface ProvenanceSource {
  type: 'agent' | 'user' | 'system' | 'external' | 'inference';
  id: string;
  method?: string;
  metadata?: Record<string, unknown>;
}

// Example sources
const agentSource = {
  type: 'agent',
  id: 'agt_processor',
  method: 'data_extraction'
};

const externalSource = {
  type: 'external',
  id: 'weather_api',
  method: 'GET /current',
  metadata: { apiVersion: '2.0' }
};

const inferenceSource = {
  type: 'inference',
  id: 'reasoning_engine',
  method: 'transitive_closure',
  metadata: { confidence: 0.95 }
};
```

## Automatic Provenance Tracking

When using the SDK, provenance is tracked automatically:

```typescript
// When you add a claim...
await client.addClaim({
  subjectId: entityId,
  predicate: 'status',
  value: 'active',
});

// A provenance entry is automatically created:
// {
//   type: 'claim_created',
//   subjectId: entityId,
//   data: { predicate: 'status', value: 'active' },
//   source: { type: 'system', id: 'sdk' },
//   hash: '...',
//   previousHash: '...'
// }
```

## Querying Provenance

### Get Entry by ID

```typescript
const entry = await ledger.get(provenanceId);
```

### Query by Subject

```typescript
const entries = await ledger.query({
  subjectId: entityId,
  limit: 100
});
```

### Query by Type

```typescript
const claimEntries = await ledger.query({
  type: 'claim_created',
  from: startTimestamp,
  to: endTimestamp
});
```

### Query by Agent

```typescript
const agentActions = await ledger.query({
  agentId: agentId,
  limit: 50
});
```

## Provenance for Compliance

Provenance records support compliance requirements:

### Audit Trails

```typescript
// Get complete audit trail for an entity
const audit = await client.getAuditTrail({
  entityId: personId,
  format: 'detailed'
});

// Export for compliance review
const report = await compliance.generateAuditReport({
  from: '2024-01-01',
  to: '2024-12-31',
  format: 'pdf'
});
```

### GDPR Support

```typescript
// Find all data related to a person (data subject)
const subjectData = await compliance.getDataSubjectData(personId);

// Export for data portability
const exportData = await compliance.exportDataSubjectData(personId);

// Right to erasure (with provenance of deletion)
await compliance.deleteDataSubjectData(personId, {
  reason: 'GDPR Article 17 request',
  requestId: 'gdpr_req_123'
});
```

## Best Practices

### 1. Always Provide Source Context

```typescript
// Good - includes context
await ledger.record({
  type: 'claim_created',
  source: {
    type: 'external',
    id: 'crm_system',
    method: 'sync',
    metadata: { syncId: 'sync_456' }
  },
  // ...
});

// Avoid - missing context
await ledger.record({
  type: 'claim_created',
  source: { type: 'system', id: 'unknown' },
  // ...
});
```

### 2. Use Meaningful Agent IDs

```typescript
// Good - descriptive agent
const agent = await client.createAgent({
  name: 'invoice-processor',
  description: 'Processes incoming invoices from suppliers'
});

// Avoid - generic agent
const agent = await client.createAgent({
  name: 'agent1',
  description: 'Does stuff'
});
```

### 3. Verify Regularly

```typescript
// In your health checks
async function healthCheck() {
  const verification = await client.verifyProvenance();
  if (!verification.value.valid) {
    alertOps('Provenance chain integrity failure');
  }
}
```

## Next Steps

- [Temporal Data](./temporal.md) - Time-aware data management
- [Decisions as Data](./decisions.md) - Decision tracking
- [Provenance Package](../packages/provenance.md) - API reference
