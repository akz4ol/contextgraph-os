# @contextgraph/sdk

The unified high-level SDK providing a single entry point for all ContextGraph OS operations.

## Installation

```bash
pnpm add @contextgraph/sdk
```

## Quick Start

```typescript
import { ContextGraph } from '@contextgraph/sdk';

// Create a client
const result = await ContextGraph.create();
if (!result.ok) throw result.error;
const client = result.value;

// Create entities, add claims, execute actions...
```

## Client Creation

### Default (In-Memory)

```typescript
const client = await ContextGraph.create();
```

### With SQLite

```typescript
const client = await ContextGraph.create({
  storage: {
    type: 'sqlite',
    path: './contextgraph.db'
  }
});
```

### With Custom Config

```typescript
const client = await ContextGraph.create({
  storage: { type: 'memory' },
  provenance: { verifyOnRead: true },
  policy: { enforceOnExecute: true },
});
```

## Entity Operations

### Create Entity

```typescript
const entity = await client.createEntity({
  type: 'person',
  name: 'Alice',
  properties: {
    department: 'Engineering',
    level: 'senior',
  },
});
```

### Get Entity

```typescript
const entity = await client.getEntity(entityId);
```

### Update Entity

```typescript
await client.updateEntity(entityId, {
  properties: {
    level: 'principal',
  },
});
```

### List Entities

```typescript
const entities = await client.listEntities({
  type: 'person',
  limit: 50,
});
```

## Claim Operations

### Add Claim

```typescript
import { createScope, createConfidence } from '@contextgraph/sdk';

await client.addClaim({
  subjectId: entityId,
  predicate: 'has_skill',
  value: 'TypeScript',
  context: {
    scope: createScope('professional'),
    confidence: createConfidence(0.95),
  },
});
```

### Get Claims

```typescript
const claims = await client.getClaims(entityId);

// With filters
const filteredClaims = await client.getClaims(entityId, {
  predicate: 'has_skill',
  asOf: timestamp,
  minConfidence: 0.8,
});
```

### Revoke Claim

```typescript
await client.revokeClaim(claimId, 'Superseded by new information');
```

## Agent Operations

### Create Agent

```typescript
const agent = await client.createAgent({
  name: 'data-processor',
  description: 'Processes incoming data files',
  capabilities: ['read', 'transform', 'write'],
});
```

### Get Agent

```typescript
const agent = await client.getAgent(agentId);
// Or by name
const agent = await client.getAgentByName('data-processor');
```

### List Agents

```typescript
const agents = await client.listAgents({ status: 'active' });
```

## Action Execution

### Register Handler

```typescript
client.registerHandler('transform', 'csv', async (action, context) => {
  // Process the action
  const data = await readCSV(action.resourceId);
  const transformed = transformData(data, action.parameters);
  return ok({ transformed: true, rowCount: data.length });
});
```

### Execute Action

```typescript
const result = await client.execute({
  agentId: agent.data.id,
  action: 'transform',
  resourceType: 'csv',
  resourceId: 'data/input.csv',
  parameters: {
    outputFormat: 'json',
  },
});
```

## Decision Management

### Record Decision

```typescript
const decision = await client.recordDecision({
  type: 'deployment',
  title: 'Deploy v2.0.0 to production',
  proposedBy: agentId,
  riskLevel: 'high',
});
```

### Approve/Reject Decision

```typescript
await client.approveDecision(decisionId, approverId, 'Approved after review');
await client.rejectDecision(decisionId, reviewerId, 'Needs more testing');
```

### Get Pending Decisions

```typescript
const pending = await client.getPendingDecisions();
```

## Policy Management

### Create Policy

```typescript
await client.createPolicy({
  name: 'Restrict PII Access',
  version: '1.0.0',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read', 'export'],
  resources: ['pii/*'],
  priority: 100,
});
```

### List Policies

```typescript
const policies = await client.listPolicies({ effect: 'deny' });
```

## Provenance

### Verify Chain

```typescript
const verification = await client.verifyProvenance();

console.log(`Valid: ${verification.value.valid}`);
console.log(`Entries: ${verification.value.entriesVerified}`);
```

### Query Provenance

```typescript
const entries = await client.queryProvenance({
  subjectId: entityId,
  limit: 100,
});
```

## Context Assembly

```typescript
const context = await client.assembleContext(entityId, {
  asOf: timestamp,
  jurisdiction: 'EU',
  scope: 'work',
  minConfidence: 0.8,
  depth: 2,
  includeProvenance: true,
});
```

## Audit Trail

```typescript
const audit = await client.getAuditTrail({
  entityId: entityId,
  limit: 100,
  from: startTime,
  to: endTime,
});
```

## Statistics

```typescript
const stats = await client.getStats();

console.log(`Entities: ${stats.value.entities}`);
console.log(`Claims: ${stats.value.claims}`);
console.log(`Agents: ${stats.value.agents}`);
console.log(`Decisions: ${stats.value.decisions}`);
```

## Import/Export

### Export

```typescript
// Export to JSON
const jsonData = await client.exportToJSON();
const jsonString = await client.exportToJSONString({ prettyPrint: true });

// Export to CSV
const entitiesCSV = await client.exportEntitiesToCSV();
const claimsCSV = await client.exportClaimsToCSV();
```

### Import

```typescript
// Import from JSON
await client.importFromJSON(data, {
  dryRun: true,
  merge: true,
  onConflict: 'skip',
});

// Import from CSV
await client.importEntitiesFromCSV(csvString);
await client.importClaimsFromCSV(csvString);
```

## Events

```typescript
// Subscribe to events
client.on('entity:created', (event) => {
  console.log('Entity created:', event.data);
});

client.on('claim:added', (event) => {
  console.log('Claim added:', event.data);
});

client.on('decision:approved', (event) => {
  console.log('Decision approved:', event.data);
});

// Unsubscribe
client.off('entity:created', handler);
```

### Event Types

| Event | Description |
|-------|-------------|
| `entity:created` | New entity created |
| `entity:updated` | Entity updated |
| `claim:added` | Claim added |
| `claim:revoked` | Claim revoked |
| `decision:proposed` | Decision recorded |
| `decision:approved` | Decision approved |
| `decision:rejected` | Decision rejected |
| `execution:started` | Action execution started |
| `execution:completed` | Action execution completed |
| `policy:created` | Policy created |

## Helper Functions

```typescript
import {
  createScope,
  createJurisdiction,
  createConfidence,
  createTimestamp,
  ok,
  err,
} from '@contextgraph/sdk';
```

## Type Exports

```typescript
export type {
  EntityId,
  ClaimId,
  AgentId,
  DecisionId,
  PolicyId,
  Entity,
  Claim,
  Agent,
  Decision,
  Policy,
  Result,
};
```
