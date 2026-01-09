# Policy Enforcement

ContextGraph OS includes a powerful policy engine for controlling access and enforcing business rules. Policies follow a deny-takes-precedence model for security.

## Policy Structure

```typescript
interface Policy {
  id: PolicyId;
  name: string;
  version: string;
  description?: string;
  effect: 'allow' | 'deny';
  subjects: string[];      // Who this applies to
  actions: string[];       // What actions
  resources: string[];     // Which resources
  conditions?: Condition[];
  priority: number;        // Higher = evaluated first
  validFrom?: Timestamp;
  validUntil?: Timestamp;
}
```

## Creating Policies

### Basic Allow Policy

```typescript
await client.createPolicy({
  name: 'Read Access for Analysts',
  version: '1.0.0',
  effect: 'allow',
  subjects: ['role:analyst'],
  actions: ['read'],
  resources: ['reports/*', 'dashboards/*'],
  priority: 50,
});
```

### Basic Deny Policy

```typescript
await client.createPolicy({
  name: 'Block PII Access',
  version: '1.0.0',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read', 'export'],
  resources: ['pii/*', 'sensitive/*'],
  priority: 100,
});
```

### Conditional Policy

```typescript
await client.createPolicy({
  name: 'Time-Based Access',
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

## Deny-Takes-Precedence

When multiple policies match, deny always wins:

```typescript
// This allows read access to reports
await client.createPolicy({
  name: 'Allow Reports',
  effect: 'allow',
  subjects: ['role:analyst'],
  actions: ['read'],
  resources: ['reports/*'],
  priority: 50,
});

// This denies access to confidential reports
await client.createPolicy({
  name: 'Block Confidential',
  effect: 'deny',
  subjects: ['*'],
  actions: ['read'],
  resources: ['reports/confidential/*'],
  priority: 100,
});

// Result: Analysts can read reports/* except reports/confidential/*
```

## Policy Evaluation

### Automatic Enforcement

Policies are evaluated automatically during execution:

```typescript
// Policies are checked before execution
const result = await client.execute({
  agentId: agentId,
  action: 'read',
  resourceType: 'report',
  resourceId: 'confidential/q4-financials',
});

if (!result.ok && result.error.code === 'POLICY_DENIED') {
  console.log('Access denied by policy');
}
```

### Manual Evaluation

```typescript
import { PolicyEvaluator } from '@contextgraph/policy';

const evaluator = new PolicyEvaluator(policyLedger, storage);

const decision = await evaluator.evaluate({
  subject: 'agent:data-processor',
  action: 'export',
  resource: 'pii/customer-emails',
  context: {
    time: new Date(),
    jurisdiction: 'EU',
  },
});

console.log(`Effect: ${decision.effect}`);  // 'allow' or 'deny'
console.log(`Matched policies: ${decision.matchedPolicies.length}`);
```

## Condition Operators

### Comparison

```typescript
{ field: 'risk.level', operator: 'equals', value: 'high' }
{ field: 'data.count', operator: 'greater_than', value: 100 }
{ field: 'confidence', operator: 'less_than_or_equals', value: 0.5 }
```

### Collection

```typescript
{ field: 'role', operator: 'in', value: ['admin', 'superuser'] }
{ field: 'action', operator: 'not_in', value: ['delete', 'purge'] }
```

### String Matching

```typescript
{ field: 'resource', operator: 'starts_with', value: '/api/v1/' }
{ field: 'resource', operator: 'ends_with', value: '.json' }
{ field: 'resource', operator: 'contains', value: 'admin' }
{ field: 'resource', operator: 'matches', value: '^/api/v[0-9]+/' }
```

### Temporal

```typescript
{ field: 'time.hour', operator: 'between', value: [9, 17] }
{ field: 'date', operator: 'after', value: '2024-01-01' }
```

### Existence

```typescript
{ field: 'approval.id', operator: 'exists' }
{ field: 'override.reason', operator: 'not_exists' }
```

## Policy Templates

Use built-in templates for common patterns:

```typescript
import { PolicyTemplateManager } from '@contextgraph/policy';

const templates = new PolicyTemplateManager(storage);

// Read-only template
await templates.instantiate('read-only', {
  subjects: ['role:viewer'],
  resources: ['dashboards/*'],
});

// PII protection template
await templates.instantiate('pii-protection', {
  piiResources: ['customers/*', 'users/*'],
  allowedRoles: ['role:privacy-officer'],
});

// Rate limiting template
await templates.instantiate('rate-limit', {
  subjects: ['*'],
  maxRequests: 100,
  windowSeconds: 60,
});
```

### Available Templates

| Template | Description |
|----------|-------------|
| `read-only` | Allow only read operations |
| `pii-protection` | Block access to PII unless authorized |
| `approval-required` | Require approval for actions |
| `rate-limit` | Limit request rate |
| `time-based` | Restrict by time of day |
| `jurisdiction` | Restrict by jurisdiction |

## Policy Simulation

Test policies before deployment:

```typescript
import { PolicySimulator } from '@contextgraph/policy';

const simulator = new PolicySimulator(policyLedger, storage);

// Simulate a request
const result = await simulator.simulate({
  subject: 'agent:new-processor',
  action: 'delete',
  resource: 'data/customer-records',
  context: { time: new Date() },
});

console.log(`Would be: ${result.effect}`);
console.log(`Matching policies:`);
for (const policy of result.matchedPolicies) {
  console.log(`  - ${policy.name} (${policy.effect})`);
}

// Bulk simulation
const scenarios = [
  { subject: 'role:admin', action: 'delete', resource: 'data/*' },
  { subject: 'role:analyst', action: 'read', resource: 'reports/*' },
  { subject: 'role:guest', action: 'write', resource: 'comments/*' },
];

const results = await simulator.simulateMany(scenarios);
```

## Exception Handling

Request policy exceptions:

```typescript
import { ExceptionManager } from '@contextgraph/exceptions';

const exceptions = new ExceptionManager(dtg, policyLedger, storage);

// Request an exception
const request = await exceptions.request({
  policyId: policyId,
  reason: 'Need temporary access for audit',
  requestedBy: agentId,
  duration: { hours: 24 },
  scope: {
    action: 'read',
    resources: ['sensitive/audit-data'],
  },
});

// Approve the exception
await exceptions.approve(request.id, approverId, 'Approved for audit period');

// The exception is now active and will be considered during evaluation
```

## RBAC Integration

Combine with Role-Based Access Control:

```typescript
import { RBACManager } from '@contextgraph/rbac';

const rbac = new RBACManager(storage);

// Define roles
await rbac.createRole({
  name: 'data-analyst',
  permissions: ['read:reports', 'read:dashboards', 'export:csv'],
  inherits: ['viewer'],
});

// Assign roles
await rbac.assignRole(agentId, 'data-analyst');

// Policies can reference roles
await client.createPolicy({
  name: 'Analyst Access',
  effect: 'allow',
  subjects: ['role:data-analyst'],
  actions: ['read', 'export'],
  resources: ['analytics/*'],
  priority: 50,
});
```

## Best Practices

### 1. Use Specific Subjects

```typescript
// Good - specific subjects
{ subjects: ['role:admin', 'role:security-officer'] }

// Avoid - too broad
{ subjects: ['*'] }  // Only for deny policies
```

### 2. Set Appropriate Priorities

```typescript
// Security policies: High priority (100+)
{ name: 'Block Dangerous Actions', priority: 150 }

// Business rules: Medium priority (50-99)
{ name: 'Department Access', priority: 60 }

// Default policies: Low priority (1-49)
{ name: 'Default Allow', priority: 10 }
```

### 3. Version Your Policies

```typescript
{
  name: 'Data Access Policy',
  version: '2.1.0',  // Semantic versioning
  description: 'Updated to include new data categories',
}
```

### 4. Document Conditions

```typescript
{
  conditions: [
    {
      field: 'data.classification',
      operator: 'not_in',
      value: ['top-secret', 'classified'],
      // _comment: 'Only allow unclassified data'
    },
  ],
}
```

## Next Steps

- [RBAC Package](../packages/rbac.md) - Role management
- [Exceptions Package](../packages/exceptions.md) - Exception handling
- [Compliance Package](../packages/compliance.md) - Compliance features
- [Policy Tutorial](../tutorials/policy-control.md) - Hands-on guide
