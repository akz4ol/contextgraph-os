# @contextgraph/policy

Policy ledger with rule evaluation and deny-takes-precedence semantics.

## Installation

```bash
pnpm add @contextgraph/policy
```

## Overview

The policy package provides:

- Policy creation and management
- Deny-takes-precedence evaluation
- Condition-based rules
- Policy templates and simulation

## Creating Policies

```typescript
import { PolicyLedger } from '@contextgraph/policy';

const ledger = new PolicyLedger(storage);
await ledger.initialize();

await ledger.create({
  name: 'Read Access for Analysts',
  version: '1.0.0',
  effect: 'allow',
  subjects: ['role:analyst'],
  actions: ['read'],
  resources: ['reports/*'],
  priority: 50,
});
```

## Policy Evaluation

```typescript
import { PolicyEvaluator } from '@contextgraph/policy';

const evaluator = new PolicyEvaluator(ledger, storage);

const decision = await evaluator.evaluate({
  subject: 'agent:data-processor',
  action: 'read',
  resource: 'reports/q4-2024',
  context: {
    time: new Date(),
    jurisdiction: 'US',
  },
});

console.log(`Effect: ${decision.effect}`);
```

## Policy Structure

```typescript
interface Policy {
  id: PolicyId;
  name: string;
  version: string;
  description?: string;
  effect: 'allow' | 'deny';
  subjects: string[];      // Who
  actions: string[];       // What
  resources: string[];     // Where
  conditions?: Condition[];
  priority: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
}
```

## Conditions

```typescript
interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'exists'
  | 'between';
```

## Policy Templates

```typescript
import { PolicyTemplateManager } from '@contextgraph/policy';

const templates = new PolicyTemplateManager(storage);

// Use built-in templates
await templates.instantiate('read-only', {
  subjects: ['role:viewer'],
  resources: ['dashboards/*'],
});

await templates.instantiate('pii-protection', {
  piiResources: ['customers/*'],
  allowedRoles: ['role:privacy-officer'],
});
```

## Policy Simulation

```typescript
import { PolicySimulator } from '@contextgraph/policy';

const simulator = new PolicySimulator(ledger, storage);

const result = await simulator.simulate({
  subject: 'agent:new-processor',
  action: 'delete',
  resource: 'data/records',
});

console.log(`Would be: ${result.effect}`);
console.log(`Matched policies: ${result.matchedPolicies.length}`);
```

## Priority System

- Higher priority policies are evaluated first
- Deny policies take precedence over allow at same priority
- Recommended ranges:
  - Security policies: 100+
  - Business rules: 50-99
  - Default policies: 1-49
