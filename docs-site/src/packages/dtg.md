# @contextgraph/dtg

Decision Trace Graph - tracks decisions with full lifecycle and audit trails.

## Installation

```bash
pnpm add @contextgraph/dtg
```

## Overview

The DTG tracks every significant decision through its lifecycle:

```
PROPOSED → APPROVED → EXECUTED → COMPLETED
              ↓           ↓
          REJECTED     FAILED
```

## Creating the DTG

```typescript
import { DecisionTraceGraph } from '@contextgraph/dtg';

const dtg = new DecisionTraceGraph(storage);
await dtg.initialize();
```

## Recording Decisions

```typescript
const decision = await dtg.record({
  type: 'deployment',
  title: 'Deploy v2.0.0 to production',
  description: 'Release new authentication system',
  proposedBy: agentId,
  riskLevel: 'high',
  context: {
    environment: 'production',
    services: ['api', 'web'],
  },
});
```

## Decision Lifecycle

### Approve

```typescript
await dtg.approve(decisionId, approverId, 'Approved after security review');
```

### Reject

```typescript
await dtg.reject(decisionId, reviewerId, 'Needs more testing');
```

### Execute

```typescript
await dtg.execute(decisionId, {
  executedBy: agentId,
  executedAt: createTimestamp(),
});
```

### Complete

```typescript
await dtg.complete(decisionId, {
  success: true,
  outcome: {
    deploymentId: 'dep_123',
    duration: 45000,
  },
});
```

### Fail

```typescript
await dtg.fail(decisionId, {
  error: 'Database migration failed',
  failedAt: createTimestamp(),
});
```

## Querying Decisions

### Get by ID

```typescript
const decision = await dtg.get(decisionId);
```

### Query by Status

```typescript
const pending = await dtg.queryDecisions({
  status: 'proposed',
  limit: 50,
});

const approved = await dtg.queryDecisions({
  status: 'approved',
  from: startTime,
  to: endTime,
});
```

### Query by Agent

```typescript
const agentDecisions = await dtg.queryDecisions({
  proposedBy: agentId,
});
```

### Query by Risk Level

```typescript
const highRisk = await dtg.queryDecisions({
  riskLevel: ['high', 'critical'],
  status: 'proposed',
});
```

## Decision Interface

```typescript
interface Decision {
  id: DecisionId;
  type: string;
  title: string;
  description?: string;
  status: DecisionStatus;
  riskLevel: RiskLevel;
  proposedBy: AgentId;
  proposedAt: Timestamp;
  approvedBy?: AgentId;
  approvedAt?: Timestamp;
  rejectedBy?: AgentId;
  rejectedAt?: Timestamp;
  executedAt?: Timestamp;
  completedAt?: Timestamp;
  context?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
}

type DecisionStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'completed'
  | 'failed';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
```

## Decision History

Get the full history of a decision:

```typescript
const history = await dtg.getHistory(decisionId);

for (const event of history) {
  console.log(`${event.timestamp}: ${event.previousStatus} → ${event.newStatus}`);
  console.log(`  By: ${event.actor}`);
  console.log(`  Reason: ${event.reason}`);
}
```

## Statistics

```typescript
const stats = await dtg.getStats();

console.log(`Total: ${stats.total}`);
console.log(`Proposed: ${stats.byStatus.proposed}`);
console.log(`Approved: ${stats.byStatus.approved}`);
console.log(`Completed: ${stats.byStatus.completed}`);
```
