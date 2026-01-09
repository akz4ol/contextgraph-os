# First Steps

This guide walks you through the fundamental concepts of ContextGraph OS with hands-on examples.

## Understanding the Result Pattern

ContextGraph uses a Result pattern for error handling instead of exceptions:

```typescript
import { ok, err, type Result } from '@contextgraph/core';

// All operations return Result<T, Error>
const result = await client.createEntity({...});

if (result.ok) {
  // Success - access result.value
  console.log(result.value.data.id);
} else {
  // Error - access result.error
  console.error(result.error.message);
}

// Or use helper methods
const entity = result.unwrapOr(defaultEntity);
```

## Creating Entities

Entities are the fundamental data objects in ContextGraph:

```typescript
// Create a person entity
const person = await client.createEntity({
  type: 'person',
  name: 'Alice Smith',
  properties: {
    email: 'alice@example.com',
    department: 'Engineering',
  },
});

// Create a project entity
const project = await client.createEntity({
  type: 'project',
  name: 'ContextGraph OS',
  properties: {
    status: 'active',
    priority: 'high',
  },
});
```

## Adding Claims

Claims are statements about entities with temporal context:

```typescript
import { createScope, createConfidence, createTimestamp } from '@contextgraph/sdk';

// Basic claim
await client.addClaim({
  subjectId: person.data.id,
  predicate: 'works_on',
  value: project.data.id,
});

// Claim with full context
await client.addClaim({
  subjectId: person.data.id,
  predicate: 'role',
  value: 'Tech Lead',
  context: {
    scope: createScope('work'),
    confidence: createConfidence(1.0),
    validFrom: createTimestamp('2024-01-01'),
    validUntil: null, // Still valid
  },
});

// Claim about another claim (meta-claims)
await client.addClaim({
  subjectId: person.data.id,
  predicate: 'has_certification',
  value: 'AWS Solutions Architect',
  context: {
    scope: createScope('professional'),
    confidence: createConfidence(0.95),
    validFrom: createTimestamp('2023-06-15'),
    validUntil: createTimestamp('2026-06-15'),
  },
});
```

## Querying Data

### Get Claims for an Entity

```typescript
const claims = await client.getClaims(person.data.id);

if (claims.ok) {
  for (const claim of claims.value) {
    console.log(`${claim.data.predicate}: ${claim.data.value}`);
  }
}
```

### Filter by Context

```typescript
// Get claims valid at a specific time
const historicalClaims = await client.getClaims(person.data.id, {
  asOf: createTimestamp('2024-06-01'),
});

// Get claims with minimum confidence
const confidentClaims = await client.getClaims(person.data.id, {
  minConfidence: 0.9,
});
```

## Working with Agents

Agents represent autonomous actors in the system:

```typescript
// Create an agent
const agent = await client.createAgent({
  name: 'data-processor',
  description: 'Processes incoming data files',
  capabilities: ['read', 'transform', 'write'],
});

// Register action handlers
client.registerHandler('transform', 'csv', async (action) => {
  const { resourceId, parameters } = action;
  // Transform the CSV file
  return ok({
    transformed: true,
    rowCount: 1000
  });
});

// Execute actions
const result = await client.execute({
  agentId: agent.data.id,
  action: 'transform',
  resourceType: 'csv',
  resourceId: 'data/input.csv',
  parameters: {
    outputFormat: 'json',
    validate: true
  },
});
```

## Recording Decisions

Track important decisions with full audit trails:

```typescript
// Record a decision
const decision = await client.recordDecision({
  type: 'deployment',
  title: 'Deploy v2.0.0 to production',
  description: 'Release new version with performance improvements',
  proposedBy: agent.data.id,
  riskLevel: 'medium',
});

// Approve the decision
await client.approveDecision(
  decision.value.data.id,
  approverAgentId,
  'Approved after review'
);

// Or reject it
await client.rejectDecision(
  decision.value.data.id,
  approverAgentId,
  'Needs more testing'
);
```

## Creating Policies

Define access control policies:

```typescript
// Deny policy for sensitive data
await client.createPolicy({
  name: 'Protect PII',
  version: '1.0.0',
  description: 'Restrict access to personally identifiable information',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read', 'export'],
  resources: ['pii/*', 'sensitive/*'],
  conditions: [
    {
      field: 'agent.clearance',
      operator: 'less_than',
      value: 'confidential',
    },
  ],
  priority: 100, // Higher = evaluated first
});

// Allow policy for specific roles
await client.createPolicy({
  name: 'Admin Read Access',
  version: '1.0.0',
  effect: 'allow',
  subjects: ['role:admin'],
  actions: ['read'],
  resources: ['*'],
  priority: 50,
});
```

## Verifying Provenance

Ensure data integrity:

```typescript
// Verify the entire provenance chain
const verification = await client.verifyProvenance();

console.log(`Chain valid: ${verification.value.valid}`);
console.log(`Entries: ${verification.value.entriesVerified}`);
console.log(`Broken links: ${verification.value.brokenLinks}`);
console.log(`Invalid hashes: ${verification.value.invalidHashes}`);
```

## Event Handling

React to system events:

```typescript
// Subscribe to events
client.on('entity:created', (event) => {
  console.log('New entity:', event.data.name);
});

client.on('claim:added', (event) => {
  console.log('New claim:', event.data.predicate);
});

client.on('decision:approved', (event) => {
  console.log('Decision approved:', event.data.title);
});

client.on('execution:completed', (event) => {
  console.log('Action completed:', event.data.action);
});
```

## Getting Statistics

Monitor your system:

```typescript
const stats = await client.getStats();

console.log(`
System Statistics:
  Entities: ${stats.value.entities}
  Claims: ${stats.value.claims}
  Agents: ${stats.value.agents}
  Decisions: ${stats.value.decisions}
  Policies: ${stats.value.policies}
  Provenance entries: ${stats.value.provenanceEntries}
`);
```

## Next Steps

- [Architecture Overview](./architecture.md) - Understand system design
- [Core Concepts](../concepts/provenance.md) - Deep dive into principles
- [SDK Reference](../packages/sdk.md) - Complete API documentation
