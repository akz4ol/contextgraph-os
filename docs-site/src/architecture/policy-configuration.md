# Policy Configuration

Comprehensive guide to configuring policies in ContextGraph OS.

## Policy Anatomy

```yaml
policy:
  # Identity
  id: pol_abc123
  name: "High Risk Action Guard"
  version: "1.0.0"
  description: "Requires approval for high-risk actions"

  # Effect
  effect: deny  # or 'allow'

  # Who does this apply to?
  subjects:
    - "*"  # All subjects
    # - "role:analyst"
    # - "agent:data-processor"

  # What actions?
  actions:
    - "delete"
    - "publish"
    - "export"

  # Which resources?
  resources:
    - "production/*"
    - "customer-data/*"

  # Under what conditions?
  conditions:
    - field: "risk.level"
      operator: "in"
      value: ["HIGH", "CRITICAL"]

  # Priority (higher = evaluated first)
  priority: 100

  # Temporal validity
  validFrom: "2024-01-01T00:00:00Z"
  validUntil: null  # No expiration
```

## Policy Matching

### Subject Matching

```yaml
# Match all
subjects: ["*"]

# Match specific role
subjects: ["role:admin"]

# Match specific agent
subjects: ["agent:data-processor"]

# Match multiple
subjects: ["role:analyst", "role:data-scientist"]

# Match pattern
subjects: ["agent:*-processor"]
```

### Action Matching

```yaml
# Match specific action
actions: ["delete"]

# Match multiple
actions: ["read", "write", "delete"]

# Match all
actions: ["*"]

# Match pattern
actions: ["export:*"]
```

### Resource Matching

```yaml
# Exact match
resources: ["/api/users/123"]

# Wildcard suffix
resources: ["reports/*"]

# Wildcard prefix
resources: ["*/sensitive"]

# Multiple patterns
resources: ["pii/*", "*/personal/*", "customers/*"]
```

## Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `{ field: "status", operator: "equals", value: "active" }` |
| `not_equals` | Not equal | `{ field: "status", operator: "not_equals", value: "deleted" }` |
| `in` | In array | `{ field: "role", operator: "in", value: ["admin", "super"] }` |
| `not_in` | Not in array | `{ field: "role", operator: "not_in", value: ["guest"] }` |
| `greater_than` | Numeric comparison | `{ field: "risk.score", operator: "greater_than", value: 0.7 }` |
| `less_than` | Numeric comparison | `{ field: "confidence", operator: "less_than", value: 0.5 }` |
| `between` | Range | `{ field: "hour", operator: "between", value: [9, 17] }` |
| `contains` | String contains | `{ field: "path", operator: "contains", value: "admin" }` |
| `starts_with` | String prefix | `{ field: "resource", operator: "starts_with", value: "/api/" }` |
| `matches` | Regex match | `{ field: "email", operator: "matches", value: ".*@company\\.com$" }` |
| `exists` | Field exists | `{ field: "approval.id", operator: "exists" }` |

## Condition Fields

### Built-in Fields

| Field | Description |
|-------|-------------|
| `subject.id` | Subject identifier |
| `subject.role` | Subject's role |
| `subject.type` | Subject type (agent, user) |
| `action` | Action being performed |
| `resource` | Target resource |
| `time.hour` | Current hour (0-23) |
| `time.dayOfWeek` | Day name (Mon, Tue, etc.) |
| `time.date` | ISO date |
| `risk.level` | Risk level (LOW, MEDIUM, HIGH, CRITICAL) |
| `risk.score` | Risk score (0-1) |
| `context.jurisdiction` | Jurisdiction code |
| `context.scope` | Scope |

### Custom Fields

Access any field from the action context:

```yaml
conditions:
  - field: "parameters.count"
    operator: "greater_than"
    value: 100
  - field: "metadata.department"
    operator: "equals"
    value: "finance"
```

## Policy Templates

### Read-Only Access

```yaml
policy:
  name: "Read Only Access"
  effect: allow
  subjects: ["role:viewer"]
  actions: ["read", "list", "get"]
  resources: ["*"]
  priority: 30
```

### PII Protection

```yaml
policy:
  name: "PII Protection"
  effect: deny
  subjects: ["*"]
  actions: ["*"]
  resources: ["pii/*", "*/personal/*"]
  conditions:
    - field: "subject.clearance"
      operator: "not_equals"
      value: "pii-authorized"
  priority: 100
```

### Business Hours Only

```yaml
policy:
  name: "Business Hours Only"
  effect: deny
  subjects: ["role:contractor"]
  actions: ["*"]
  resources: ["*"]
  conditions:
    - field: "time.hour"
      operator: "not_in"
      value: [9, 10, 11, 12, 13, 14, 15, 16, 17]
  priority: 80
```

### High Risk Approval

```yaml
policy:
  name: "High Risk Requires Approval"
  effect: deny
  subjects: ["*"]
  actions: ["delete", "publish", "deploy"]
  resources: ["production/*"]
  conditions:
    - field: "risk.level"
      operator: "in"
      value: ["HIGH", "CRITICAL"]
    - field: "approval.status"
      operator: "not_equals"
      value: "approved"
  priority: 90
```

### Jurisdiction Restriction

```yaml
policy:
  name: "EU Data in EU Only"
  effect: deny
  subjects: ["*"]
  actions: ["export", "transfer"]
  resources: ["eu-data/*"]
  conditions:
    - field: "context.jurisdiction"
      operator: "not_equals"
      value: "EU"
  priority: 95
```

## Policy Evaluation Order

1. Policies sorted by **priority** (highest first)
2. For each policy:
   - Check subject match
   - Check action match
   - Check resource match
   - Evaluate conditions
3. First **DENY** wins (deny-takes-precedence)
4. If no deny, first **ALLOW** wins
5. If no match, **implicit DENY**

```
Priority 100: Security policies
Priority 90:  Risk policies
Priority 80:  Compliance policies
Priority 50:  Business rules
Priority 30:  Role defaults
Priority 10:  Fallback rules
```

## Testing Policies

### Simulation

```typescript
const simulator = new PolicySimulator(policyLedger, storage);

const result = await simulator.simulate({
  subject: "agent:report-generator",
  action: "publish",
  resource: "production/quarterly-report",
  context: {
    risk: { level: "HIGH" },
    time: { hour: 14 }
  }
});

console.log(result.effect);  // "deny"
console.log(result.matchedPolicies);
console.log(result.reason);
```

### Batch Testing

```typescript
const scenarios = [
  { subject: "role:admin", action: "delete", resource: "data/*" },
  { subject: "role:analyst", action: "read", resource: "reports/*" },
  { subject: "role:guest", action: "write", resource: "comments/*" },
];

const results = await simulator.simulateMany(scenarios);
```

## Best Practices

1. **Start restrictive** - Default deny, explicit allow
2. **Use high priority for security** - Security > Compliance > Business
3. **Test before deploy** - Use simulator
4. **Version policies** - Semantic versioning
5. **Document conditions** - Clear descriptions
6. **Monitor evaluations** - Track deny rates
7. **Review regularly** - Quarterly policy audits
