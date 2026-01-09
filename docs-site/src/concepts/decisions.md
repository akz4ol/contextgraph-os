# Decisions as Data

In ContextGraph OS, decisions are first-class data objects with full lifecycle tracking. Every significant decision made by agents or users is recorded, tracked, and auditable.

## Why Track Decisions?

AI agents make countless decisions. Without tracking:
- You can't explain why something happened
- You can't audit agent behavior
- You can't learn from past decisions
- You can't ensure compliance

ContextGraph solves this by treating decisions as data.

## Decision Structure

```typescript
interface Decision {
  id: DecisionId;
  type: DecisionType;
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
  context: DecisionContext;
  outcome?: DecisionOutcome;
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

## Decision Lifecycle

```
┌──────────┐
│ PROPOSED │ ─────────────────────────────┐
└────┬─────┘                              │
     │                                    │
     ▼                                    ▼
┌──────────┐                        ┌──────────┐
│ APPROVED │                        │ REJECTED │
└────┬─────┘                        └──────────┘
     │
     ▼
┌──────────┐
│ EXECUTED │
└────┬─────┘
     │
     ├──────────────────┐
     ▼                  ▼
┌──────────┐      ┌──────────┐
│COMPLETED │      │  FAILED  │
└──────────┘      └──────────┘
```

## Recording Decisions

### Basic Decision

```typescript
const decision = await client.recordDecision({
  type: 'data_processing',
  title: 'Process customer data batch',
  proposedBy: agentId,
  riskLevel: 'low',
});
```

### Decision with Context

```typescript
const decision = await client.recordDecision({
  type: 'deployment',
  title: 'Deploy version 2.0.0 to production',
  description: 'Release includes new auth system and performance improvements',
  proposedBy: agentId,
  riskLevel: 'high',
  context: {
    environment: 'production',
    affectedServices: ['api', 'web', 'worker'],
    rollbackPlan: 'Revert to v1.9.5',
    estimatedDowntime: '0 minutes',
  },
});
```

## Approving and Rejecting

### Approval

```typescript
await client.approveDecision(
  decisionId,
  approverId,
  'Approved after security review'
);
```

### Rejection

```typescript
await client.rejectDecision(
  decisionId,
  reviewerId,
  'Needs additional testing before deployment'
);
```

### Conditional Approval

```typescript
// Check conditions before approving
const decision = await dtg.get(decisionId);

if (decision.value.data.riskLevel === 'critical') {
  // Critical decisions need multiple approvers
  const approvals = await dtg.getApprovals(decisionId);
  if (approvals.length < 2) {
    throw new Error('Critical decisions require 2 approvals');
  }
}

await client.approveDecision(decisionId, approverId);
```

## Executing Decisions

Once approved, decisions can be executed:

```typescript
// Mark as executed
await dtg.updateStatus(decisionId, 'executed', {
  executedAt: createTimestamp(),
  executor: agentId,
});

// Perform the actual work
const result = await performDeployment(decision.context);

// Mark as completed or failed
if (result.success) {
  await dtg.updateStatus(decisionId, 'completed', {
    completedAt: createTimestamp(),
    outcome: {
      success: true,
      metrics: result.metrics,
    },
  });
} else {
  await dtg.updateStatus(decisionId, 'failed', {
    completedAt: createTimestamp(),
    outcome: {
      success: false,
      error: result.error,
    },
  });
}
```

## Querying Decisions

### Get Pending Decisions

```typescript
const pending = await client.getPendingDecisions();

for (const decision of pending.value) {
  console.log(`${decision.data.title} - ${decision.data.riskLevel}`);
}
```

### Query by Status

```typescript
const approved = await dtg.queryDecisions({
  status: 'approved',
  from: startOfMonth,
  to: endOfMonth,
});
```

### Query by Agent

```typescript
const agentDecisions = await dtg.queryDecisions({
  proposedBy: agentId,
  limit: 50,
});
```

### Query by Risk Level

```typescript
const highRisk = await dtg.queryDecisions({
  riskLevel: ['high', 'critical'],
  status: 'proposed',
});
```

## Decision Types

Define decision types for your domain:

```typescript
type DecisionType =
  // Operational
  | 'deployment'
  | 'rollback'
  | 'scaling'
  | 'maintenance'

  // Data
  | 'data_processing'
  | 'data_deletion'
  | 'data_export'

  // Access
  | 'access_grant'
  | 'access_revoke'

  // Business
  | 'approval'
  | 'exception'
  | 'escalation';
```

## Risk Assessment

### Risk Levels

```typescript
// Low: Routine, easily reversible
{ riskLevel: 'low' }

// Medium: Some impact, recoverable
{ riskLevel: 'medium' }

// High: Significant impact, careful execution needed
{ riskLevel: 'high' }

// Critical: Major impact, requires multiple approvals
{ riskLevel: 'critical' }
```

### Automatic Risk Escalation

```typescript
import { createRecommendationEngine } from '@contextgraph/recommendations';

const engine = createRecommendationEngine(dtg, storage);

// Check risk before executing
const assessment = await engine.assessRisk({
  action: 'delete',
  entityType: 'User',
  resource: '/api/users/bulk',
  attributes: { count: 1000 },
});

if (assessment.riskLevel === 'high') {
  // Escalate for review
  await decision.escalate('Bulk deletion requires manager approval');
}
```

## Decision Recommendations

Use historical decisions to inform new ones:

```typescript
const recommendation = await engine.recommend({
  action: 'deploy',
  entityType: 'Service',
  resource: 'api-gateway',
  attributes: {
    environment: 'production',
    changeType: 'configuration',
  },
});

console.log(`Recommendation: ${recommendation.action}`);
console.log(`Confidence: ${recommendation.confidence}`);
console.log(`Based on ${recommendation.precedents.length} similar decisions`);
```

## Audit Integration

Decisions integrate with the audit system:

```typescript
// Get full decision history
const history = await dtg.getDecisionHistory(decisionId);

// Includes all state changes with timestamps and actors
for (const event of history) {
  console.log(`${event.timestamp}: ${event.previousStatus} → ${event.newStatus}`);
  console.log(`  By: ${event.actor}`);
  console.log(`  Reason: ${event.reason}`);
}
```

## Best Practices

### 1. Be Specific About Risk

```typescript
// Good - clear risk assessment
{
  riskLevel: 'high',
  context: {
    reason: 'Affects production database',
    mitigations: ['Backup taken', 'Rollback script ready']
  }
}

// Avoid - vague risk
{ riskLevel: 'medium' }  // Why medium?
```

### 2. Always Record Outcomes

```typescript
// Good - complete outcome
await dtg.updateStatus(id, 'completed', {
  outcome: {
    success: true,
    duration: 45000,
    affectedRecords: 1523,
    metrics: { cpu: '12%', memory: '45%' }
  }
});

// Avoid - missing outcome
await dtg.updateStatus(id, 'completed');
```

### 3. Link Related Decisions

```typescript
// Reference related decisions
await client.recordDecision({
  type: 'rollback',
  title: 'Rollback v2.0.0 deployment',
  context: {
    relatedDecisionId: originalDeploymentId,
    reason: 'Performance degradation detected'
  }
});
```

## Next Steps

- [Context Filtering](./context.md) - Query decisions with context
- [Policy Enforcement](./policy.md) - Require approvals via policy
- [DTG Package](../packages/dtg.md) - API reference
- [Recommendations](../packages/recommendations.md) - Decision recommendations
