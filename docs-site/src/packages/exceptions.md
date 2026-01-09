# @contextgraph/exceptions

Exception requests and approvals for policy overrides.

## Installation

```bash
pnpm add @contextgraph/exceptions
```

## Overview

Handle cases where policies need to be temporarily bypassed:

- Request exceptions to denied policies
- Approval workflows
- Scoped, time-limited exceptions
- Full audit trail

## Requesting Exceptions

```typescript
import { ExceptionManager } from '@contextgraph/exceptions';

const exceptions = new ExceptionManager(dtg, policyLedger, storage);

const request = await exceptions.request({
  policyId: policyId,
  reason: 'Need temporary access for audit',
  requestedBy: agentId,
  duration: { hours: 24 },
  scope: {
    action: 'read',
    resources: ['sensitive/audit-data/*'],
  },
});
```

## Approving Exceptions

```typescript
await exceptions.approve(
  request.id,
  approverId,
  'Approved for audit period'
);
```

## Exception Lifecycle

```
PENDING → APPROVED → ACTIVE → EXPIRED
            ↓
         REJECTED
```

## Exception Structure

```typescript
interface ExceptionRequest {
  id: string;
  policyId: PolicyId;
  reason: string;
  requestedBy: AgentId;
  requestedAt: Timestamp;
  duration: Duration;
  scope: ExceptionScope;
  status: ExceptionStatus;
  approvedBy?: AgentId;
  approvedAt?: Timestamp;
  expiresAt?: Timestamp;
}
```

## Querying Exceptions

```typescript
// Get active exceptions
const active = await exceptions.getActive();

// Get by policy
const policyExceptions = await exceptions.getByPolicy(policyId);

// Get by agent
const agentExceptions = await exceptions.getByAgent(agentId);
```
