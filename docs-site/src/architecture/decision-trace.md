# Decision Trace Graph

Complete guide to tracking, auditing, and querying agent decisions.

## Why Decision Traces Matter

Traditional AI systems operate as black boxes:

```
Input → [???] → Output
```

ContextGraph OS makes every decision transparent:

```
Input → Context Assembly → Policy Check → Evidence Linking → Execution → Audit Trail
           │                   │                │              │            │
           └───────────────────┴────────────────┴──────────────┴────────────┘
                            All recorded in Decision Trace Graph
```

## Decision Lifecycle

Every decision follows a strict lifecycle:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PROPOSED │────►│ APPROVED │────►│ EXECUTED │────►│COMPLETED │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │                │                │                │
      │          ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
      │          │ REJECTED  │    │ CANCELLED │    │  FAILED   │
      │          └───────────┘    └───────────┘    └───────────┘
      │
      └─────────► NEEDS_REVIEW ────► Human Queue
```

### State Definitions

| State | Description | Can Transition To |
|-------|-------------|-------------------|
| `PROPOSED` | Decision submitted by agent | APPROVED, REJECTED, NEEDS_REVIEW |
| `APPROVED` | Passed policy or human review | EXECUTED, CANCELLED |
| `REJECTED` | Denied by policy or reviewer | (terminal) |
| `NEEDS_REVIEW` | Awaiting human approval | APPROVED, REJECTED |
| `EXECUTED` | Action dispatched | COMPLETED, FAILED |
| `COMPLETED` | Successfully finished | (terminal) |
| `FAILED` | Execution error | (terminal) |
| `CANCELLED` | Withdrawn before execution | (terminal) |

## Decision Anatomy

```typescript
interface Decision {
  // Identity
  id: DecisionId;
  type: string;                    // e.g., "publish_report"

  // Current state
  status: DecisionStatus;

  // Who proposed this?
  proposedBy: AgentId;
  proposedAt: Timestamp;

  // What action?
  action: {
    type: string;
    target: string;
    parameters: Record<string, unknown>;
  };

  // What evidence was considered?
  evidenceIds: ClaimId[];

  // Risk assessment
  risk: {
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    score: number;              // 0-1
    factors: RiskFactor[];
  };

  // Policy evaluation
  policyResult: {
    effect: "allow" | "deny";
    matchedPolicies: PolicyId[];
    conditions: EvaluatedCondition[];
  };

  // Approval (if needed)
  approvedBy?: AgentId | UserId;
  approvedAt?: Timestamp;
  approvalReason?: string;

  // Rejection (if denied)
  rejectedBy?: AgentId | UserId;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Execution result
  executedAt?: Timestamp;
  completedAt?: Timestamp;
  result?: unknown;
  error?: string;

  // Full history
  history: DecisionEvent[];
}
```

## Creating Decisions

### Basic Decision

```typescript
import { DecisionTraceGraph } from '@contextgraph/dtg';

const dtg = new DecisionTraceGraph(storage);

// Create a decision
const decision = await dtg.createDecision({
  type: "publish_report",
  proposedBy: agentId,
  action: {
    type: "publish",
    target: "external_audience",
    parameters: {
      reportId: "report_123",
      format: "pdf",
    },
  },
  evidenceIds: [claim1.id, claim2.id, claim3.id],
});

console.log(decision.status); // "proposed"
```

### With Risk Assessment

```typescript
const decision = await dtg.createDecision({
  type: "delete_customer_data",
  proposedBy: agentId,
  action: {
    type: "delete",
    target: "customer_records",
    parameters: { customerId: "cust_456" },
  },
  risk: {
    level: "HIGH",
    score: 0.85,
    factors: [
      { type: "data_sensitivity", weight: 0.4, description: "PII data" },
      { type: "irreversibility", weight: 0.3, description: "Permanent deletion" },
      { type: "volume", weight: 0.15, description: "Multiple records" },
    ],
  },
  evidenceIds: [deletionRequestClaim.id],
});
```

## State Transitions

### Approve Decision

```typescript
// After policy evaluation or human review
await dtg.transitionDecision(decision.id, "approved", {
  approvedBy: reviewerId,
  reason: "Verified customer deletion request is legitimate",
});
```

### Reject Decision

```typescript
await dtg.transitionDecision(decision.id, "rejected", {
  rejectedBy: policyEngineId,
  reason: "Policy 'pii-protection' denies deletion without manager approval",
});
```

### Execute Decision

```typescript
// After approval
await dtg.transitionDecision(decision.id, "executed");

// When execution completes
await dtg.transitionDecision(decision.id, "completed", {
  result: { deletedRecords: 15 },
});

// Or if execution fails
await dtg.transitionDecision(decision.id, "failed", {
  error: "Database connection timeout",
});
```

## Querying Decisions

### By Status

```typescript
// Get all pending decisions
const pending = await dtg.queryDecisions({
  status: "proposed",
});

// Get decisions needing review
const needsReview = await dtg.queryDecisions({
  status: "needs_review",
});
```

### By Agent

```typescript
// All decisions by a specific agent
const agentDecisions = await dtg.queryDecisions({
  proposedBy: agentId,
});

// High-risk decisions by agent
const highRisk = await dtg.queryDecisions({
  proposedBy: agentId,
  riskLevel: ["HIGH", "CRITICAL"],
});
```

### By Time Range

```typescript
// Decisions from last 24 hours
const recent = await dtg.queryDecisions({
  proposedAfter: createTimestamp(Date.now() - 24 * 60 * 60 * 1000),
});

// Decisions in Q4
const q4Decisions = await dtg.queryDecisions({
  proposedAfter: createTimestamp('2024-10-01'),
  proposedBefore: createTimestamp('2024-12-31'),
});
```

### By Type

```typescript
// All publish decisions
const publishes = await dtg.queryDecisions({
  type: "publish_report",
});

// Multiple types
const modifications = await dtg.queryDecisions({
  types: ["update", "delete", "create"],
});
```

## Decision History

Every state change is recorded:

```typescript
const decision = await dtg.getDecision(decisionId);

for (const event of decision.history) {
  console.log(`${event.timestamp}: ${event.fromStatus} → ${event.toStatus}`);
  console.log(`  By: ${event.actor}`);
  console.log(`  Reason: ${event.reason}`);
}

// Output:
// 2024-03-15T10:00:00Z: null → proposed
//   By: agent:report-generator
//   Reason: null
// 2024-03-15T10:00:05Z: proposed → needs_review
//   By: policy:high-risk-guard
//   Reason: Action risk level HIGH requires human approval
// 2024-03-15T14:30:00Z: needs_review → approved
//   By: user:compliance-officer
//   Reason: Verified report accuracy and authorization
// 2024-03-15T14:30:01Z: approved → executed
//   By: system:executor
//   Reason: null
// 2024-03-15T14:30:05Z: executed → completed
//   By: system:executor
//   Reason: Successfully published to external audience
```

## Evidence Linking

Decisions are linked to their supporting evidence:

```typescript
// Get evidence for a decision
const evidence = await dtg.getDecisionEvidence(decision.id);

for (const claim of evidence) {
  console.log(`Claim: ${claim.value}`);
  console.log(`  Confidence: ${claim.confidence}`);
  console.log(`  Source: ${claim.source}`);
  console.log(`  Valid: ${claim.validFrom} - ${claim.validUntil}`);
}
```

### Evidence Sufficiency

Check if decision has sufficient evidence:

```typescript
const sufficiency = await dtg.checkEvidenceSufficiency(decision.id, {
  minClaims: 2,
  minConfidence: 0.8,
  requiredSources: ["internal", "verified"],
});

if (!sufficiency.sufficient) {
  console.log(`Missing: ${sufficiency.gaps}`);
  // e.g., "Missing: verified source claim"
}
```

## Audit Reports

### Decision Summary

```typescript
const summary = await dtg.generateSummary({
  timeRange: {
    from: createTimestamp('2024-01-01'),
    to: createTimestamp('2024-03-31'),
  },
  groupBy: "agent",
});

// Output:
// {
//   "agent:report-generator": {
//     total: 150,
//     approved: 120,
//     rejected: 25,
//     failed: 5,
//     avgRiskScore: 0.45,
//   },
//   "agent:data-processor": {
//     total: 500,
//     approved: 480,
//     rejected: 15,
//     failed: 5,
//     avgRiskScore: 0.25,
//   }
// }
```

### Export for Compliance

```typescript
const report = await dtg.exportForCompliance({
  format: "json",
  timeRange: { from: q4Start, to: q4End },
  includeEvidence: true,
  includeHistory: true,
  redactPII: true,
});

// Save for compliance records
await writeFile("q4-decisions.json", JSON.stringify(report));
```

## Visualization

```typescript
import { visualizeDecisions } from '@contextgraph/viz';

// Generate Mermaid diagram of decision flow
const diagram = await visualizeDecisions(dtg, decision.id, {
  format: "mermaid",
  includeEvidence: true,
  includePolicy: true,
});

// Output:
// ```mermaid
// flowchart TD
//     P[Proposed] --> |policy check| NR[Needs Review]
//     NR --> |human approval| A[Approved]
//     A --> |dispatch| E[Executed]
//     E --> |success| C[Completed]
//
//     subgraph Evidence
//         E1[Claim: Revenue +15%]
//         E2[Claim: Q4 Verified]
//     end
// ```
```

## Best Practices

### 1. Always Link Evidence

```typescript
// Good: Decision with evidence
const decision = await dtg.createDecision({
  type: "approve_loan",
  evidenceIds: [creditScore.id, income.id, history.id],
  // ...
});

// Bad: Decision without evidence
const decision = await dtg.createDecision({
  type: "approve_loan",
  evidenceIds: [], // No audit trail!
  // ...
});
```

### 2. Use Meaningful Types

```typescript
// Good: Specific types
type: "publish_quarterly_report"
type: "delete_customer_pii"
type: "escalate_support_ticket"

// Bad: Vague types
type: "action"
type: "do_thing"
type: "process"
```

### 3. Include Risk Assessment

```typescript
// For any action that modifies data or has external effects
risk: {
  level: calculateRiskLevel(action),
  score: calculateRiskScore(action),
  factors: identifyRiskFactors(action),
}
```

### 4. Provide Transition Reasons

```typescript
// Always explain why a transition occurred
await dtg.transitionDecision(id, "rejected", {
  rejectedBy: policyId,
  reason: "Confidence threshold not met (required: 0.8, actual: 0.65)",
});
```

## Integration with Policy Engine

Decisions integrate with policy evaluation:

```typescript
import { PolicyEngine } from '@contextgraph/policy';
import { DecisionTraceGraph } from '@contextgraph/dtg';

const policy = new PolicyEngine(policyLedger);
const dtg = new DecisionTraceGraph(storage);

// Create decision
const decision = await dtg.createDecision({
  type: "publish",
  action: { type: "publish", target: "external" },
  // ...
});

// Evaluate against policies
const result = await policy.evaluate({
  subject: decision.proposedBy,
  action: decision.action.type,
  resource: decision.action.target,
  context: { risk: decision.risk },
});

// Transition based on result
if (result.effect === "allow") {
  await dtg.transitionDecision(decision.id, "approved", {
    approvedBy: "policy:auto-approve",
    reason: `Allowed by policy ${result.matchedPolicies[0]}`,
  });
} else if (result.requiresApproval) {
  await dtg.transitionDecision(decision.id, "needs_review", {
    reason: `Requires human approval: ${result.reason}`,
  });
} else {
  await dtg.transitionDecision(decision.id, "rejected", {
    rejectedBy: result.matchedPolicies[0],
    reason: result.reason,
  });
}
```

## Next Steps

- [Compliance Reporting](./compliance-reporting.md)
- [Governance Deep Dive](./governance.md)
- [Policy Configuration](./policy-configuration.md)
