# Context Filtering

ContextGraph enables sophisticated filtering of data based on temporal, jurisdictional, scope, and confidence contexts. This allows you to get exactly the right data for your use case.

## Context Dimensions

### 1. Temporal Context

Filter by time - when data is/was valid:

```typescript
// Get claims valid at a specific time
const claims = await ckg.query({
  subjectId: entityId,
  asOf: createTimestamp('2024-06-15'),
});

// Get claims valid during a range
const rangeClaims = await ckg.query({
  subjectId: entityId,
  validFrom: createTimestamp('2024-01-01'),
  validTo: createTimestamp('2024-12-31'),
});
```

### 2. Jurisdictional Context

Filter by legal/regulatory jurisdiction:

```typescript
import { createJurisdiction } from '@contextgraph/core';

// Create jurisdiction-specific claims
await client.addClaim({
  subjectId: userId,
  predicate: 'data_retention_period',
  value: '7 years',
  context: {
    jurisdiction: createJurisdiction('EU'),
  },
});

await client.addClaim({
  subjectId: userId,
  predicate: 'data_retention_period',
  value: '5 years',
  context: {
    jurisdiction: createJurisdiction('US'),
  },
});

// Query for specific jurisdiction
const euClaims = await ckg.query({
  subjectId: userId,
  jurisdiction: 'EU',
});
```

### 3. Scope Context

Filter by domain or application scope:

```typescript
import { createScope } from '@contextgraph/core';

// Work-related claims
await client.addClaim({
  subjectId: personId,
  predicate: 'phone',
  value: '+1-555-WORK',
  context: {
    scope: createScope('work'),
  },
});

// Personal claims
await client.addClaim({
  subjectId: personId,
  predicate: 'phone',
  value: '+1-555-HOME',
  context: {
    scope: createScope('personal'),
  },
});

// Query by scope
const workContacts = await ckg.query({
  subjectId: personId,
  scope: 'work',
});
```

### 4. Confidence Context

Filter by confidence level:

```typescript
import { createConfidence } from '@contextgraph/core';

// High confidence claim (verified)
await client.addClaim({
  subjectId: entityId,
  predicate: 'verified_email',
  value: 'alice@example.com',
  context: {
    confidence: createConfidence(1.0),
  },
});

// Lower confidence claim (inferred)
await client.addClaim({
  subjectId: entityId,
  predicate: 'likely_industry',
  value: 'technology',
  context: {
    confidence: createConfidence(0.75),
  },
});

// Query only high-confidence claims
const verifiedClaims = await ckg.query({
  subjectId: entityId,
  minConfidence: 0.9,
});
```

## Context Assembly

The Retrieval package provides powerful context assembly:

```typescript
import { ContextAssembler } from '@contextgraph/retrieval';

const assembler = new ContextAssembler(ckg, provenance, storage);

// Assemble full context for an entity
const context = await assembler.assemble(entityId, {
  // Temporal filter
  asOf: createTimestamp('2024-06-15'),

  // Jurisdictional filter
  jurisdiction: 'EU',

  // Scope filter
  scope: 'work',

  // Confidence filter
  minConfidence: 0.8,

  // Include related entities
  depth: 2,

  // Include provenance
  includeProvenance: true,
});

// Result includes:
// - Matching claims
// - Related entities (up to depth 2)
// - Provenance records
// - Applied filters
```

## Filter Combinations

Combine multiple filters for precise queries:

```typescript
// Complex query: EU jurisdiction, work scope,
// high confidence, as of last month
const context = await assembler.assemble(entityId, {
  asOf: createTimestamp('2024-05-31'),
  jurisdiction: 'EU',
  scope: 'work',
  minConfidence: 0.85,
});
```

## Context Inheritance

Claims can inherit context from their entities:

```typescript
// Entity with default context
const entity = await client.createEntity({
  type: 'contract',
  name: 'Service Agreement',
  properties: {
    defaultJurisdiction: 'US-DE',
    defaultScope: 'legal',
  },
});

// Claims inherit entity context unless overridden
await client.addClaim({
  subjectId: entity.data.id,
  predicate: 'effective_date',
  value: '2024-01-01',
  // Inherits jurisdiction: US-DE, scope: legal
});

// Override specific context
await client.addClaim({
  subjectId: entity.data.id,
  predicate: 'eu_compliance_date',
  value: '2024-06-01',
  context: {
    jurisdiction: createJurisdiction('EU'),  // Override
    // Inherits scope: legal
  },
});
```

## Query Operators

### Equality

```typescript
{ jurisdiction: 'EU' }  // Exact match
```

### Multiple Values

```typescript
{ jurisdiction: ['EU', 'UK'] }  // Either EU or UK
```

### Range (for confidence)

```typescript
{ minConfidence: 0.8 }  // At least 0.8
{ maxConfidence: 0.95 }  // At most 0.95
{ minConfidence: 0.8, maxConfidence: 0.95 }  // Between
```

### Negation

```typescript
{ excludeScope: ['test', 'development'] }  // Not test or development
```

## Context-Aware Policies

Policies can reference context:

```typescript
await client.createPolicy({
  name: 'GDPR Data Access',
  effect: 'deny',
  subjects: ['*'],
  actions: ['export'],
  resources: ['personal_data/*'],
  conditions: [
    {
      field: 'context.jurisdiction',
      operator: 'not_equals',
      value: 'EU',
    },
  ],
});
```

## SDK Integration

The SDK provides convenient methods:

```typescript
// Get claims with context
const claims = await client.getClaims(entityId, {
  asOf: timestamp,
  jurisdiction: 'EU',
  scope: 'work',
  minConfidence: 0.8,
});

// Assemble context
const context = await client.assembleContext(entityId, {
  jurisdiction: 'US',
  scope: 'compliance',
  includeRelated: true,
  depth: 2,
});
```

## Performance Considerations

### Indexed Fields

These context fields are indexed for fast queries:
- `validFrom` / `validUntil`
- `jurisdiction`
- `scope`
- `confidence`

### Query Optimization

```typescript
// Efficient: Uses indexes
const claims = await ckg.query({
  subjectId: entityId,
  jurisdiction: 'EU',
  minConfidence: 0.9,
});

// Less efficient: Full scan needed
const claims = await ckg.query({
  predicate: 'custom_field',
  // No subjectId, no indexed fields
});
```

## Best Practices

### 1. Be Explicit About Context

```typescript
// Good - clear context
await client.addClaim({
  subjectId: id,
  predicate: 'price',
  value: 99.99,
  context: {
    jurisdiction: createJurisdiction('US'),
    scope: createScope('retail'),
    confidence: createConfidence(1.0),
    validFrom: createTimestamp(),
  },
});
```

### 2. Use Appropriate Granularity

```typescript
// Jurisdiction examples
'US'      // Country level
'US-CA'   // State level
'US-CA-LA'  // City level

// Scope examples
'work'
'work:hr'
'work:hr:benefits'
```

### 3. Document Context Semantics

```typescript
// In your codebase, document what contexts mean
const SCOPES = {
  'work': 'Professional/employment context',
  'personal': 'Personal/private context',
  'public': 'Publicly accessible information',
  'internal': 'Internal company use only',
};
```

## Next Steps

- [Policy Enforcement](./policy.md) - Context-aware policies
- [Retrieval Package](../packages/retrieval.md) - API reference
- [Temporal Queries Tutorial](../tutorials/temporal-queries.md)
