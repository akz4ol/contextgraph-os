# Policy-Based Access Control

Learn to implement fine-grained access control using ContextGraph policies.

## What You'll Learn

- Creating allow and deny policies
- Using conditions
- Policy evaluation order
- Handling policy exceptions

## Setup

```typescript
import { ContextGraph } from '@contextgraph/sdk';

const result = await ContextGraph.create();
const client = result.value;
```

## Creating Basic Policies

### Allow Policy

```typescript
await client.createPolicy({
  name: 'Read Access for Analysts',
  version: '1.0.0',
  description: 'Allow analysts to read reports',
  effect: 'allow',
  subjects: ['role:analyst'],
  actions: ['read'],
  resources: ['reports/*'],
  priority: 50,
});
```

### Deny Policy

```typescript
await client.createPolicy({
  name: 'Block Confidential Reports',
  version: '1.0.0',
  description: 'Deny access to confidential reports',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read', 'export'],
  resources: ['reports/confidential/*'],
  priority: 100, // Higher priority = evaluated first
});
```

## Using Conditions

### Time-Based Access

```typescript
await client.createPolicy({
  name: 'Business Hours Only',
  version: '1.0.0',
  effect: 'allow',
  subjects: ['role:contractor'],
  actions: ['*'],
  resources: ['*'],
  conditions: [
    {
      field: 'time.hour',
      operator: 'between',
      value: [9, 17],
    },
    {
      field: 'time.dayOfWeek',
      operator: 'in',
      value: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    },
  ],
  priority: 40,
});
```

### Risk-Based Access

```typescript
await client.createPolicy({
  name: 'High Risk Requires Approval',
  version: '1.0.0',
  effect: 'deny',
  subjects: ['*'],
  actions: ['execute'],
  resources: ['*'],
  conditions: [
    {
      field: 'risk.level',
      operator: 'in',
      value: ['high', 'critical'],
    },
    {
      field: 'approval.status',
      operator: 'not_equals',
      value: 'approved',
    },
  ],
  priority: 90,
});
```

## Testing Policies

Use the policy simulator:

```typescript
import { PolicySimulator } from '@contextgraph/policy';

const simulator = new PolicySimulator(policyLedger, storage);

const result = await simulator.simulate({
  subject: 'agent:data-processor',
  action: 'read',
  resource: 'reports/confidential/q4-2024',
  context: {
    time: new Date('2024-01-15T14:00:00Z'),
  },
});

console.log(`Effect: ${result.effect}`); // 'deny'
console.log(`Matched ${result.matchedPolicies.length} policies`);
```

## Priority System

```
Priority 100: Security policies (deny dangerous actions)
Priority 90:  Risk policies (high-risk requires approval)
Priority 50:  Business rules (role-based access)
Priority 10:  Default policies (fallback rules)
```

When policies conflict at the same priority, deny wins.

## Handling Exceptions

```typescript
import { ExceptionManager } from '@contextgraph/exceptions';

const exceptions = new ExceptionManager(dtg, policyLedger, storage);

// Request exception
const request = await exceptions.request({
  policyId: policyId,
  reason: 'Audit requires temporary access',
  requestedBy: agentId,
  duration: { hours: 4 },
  scope: {
    action: 'read',
    resources: ['reports/confidential/audit-2024'],
  },
});

// Approve exception
await exceptions.approve(request.id, approverId, 'Approved for audit');
```

## Complete Example

```typescript
async function setupAccessControl(client: ContextGraph) {
  // 1. Base read access
  await client.createPolicy({
    name: 'Base Read Access',
    version: '1.0.0',
    effect: 'allow',
    subjects: ['role:employee'],
    actions: ['read'],
    resources: ['public/*', 'team/*'],
    priority: 30,
  });

  // 2. Analyst access
  await client.createPolicy({
    name: 'Analyst Access',
    version: '1.0.0',
    effect: 'allow',
    subjects: ['role:analyst'],
    actions: ['read', 'export'],
    resources: ['reports/*', 'data/*'],
    priority: 50,
  });

  // 3. Block PII
  await client.createPolicy({
    name: 'Block PII',
    version: '1.0.0',
    effect: 'deny',
    subjects: ['*'],
    actions: ['*'],
    resources: ['pii/*', '*/personal/*'],
    conditions: [
      {
        field: 'agent.clearance',
        operator: 'not_equals',
        value: 'pii-authorized',
      },
    ],
    priority: 100,
  });

  // 4. Admin override
  await client.createPolicy({
    name: 'Admin Full Access',
    version: '1.0.0',
    effect: 'allow',
    subjects: ['role:admin'],
    actions: ['*'],
    resources: ['*'],
    priority: 110, // Higher than deny
  });
}
```

## Best Practices

1. **Start with deny-all** - Add explicit allows
2. **Use high priority for security** - Security policies first
3. **Document conditions** - Clear descriptions
4. **Test with simulator** - Before deploying
5. **Monitor evaluations** - Track denied requests

## Next Steps

- [Visualizing Decision Trees](./visualizing-decisions.md)
- [Temporal Queries](./temporal-queries.md)
