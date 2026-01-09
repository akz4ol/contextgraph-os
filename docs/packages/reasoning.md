# @contextgraph/reasoning - Semantic Reasoning Package

Semantic reasoning engine for ContextGraph with inference rules, relation types, and contradiction detection. Enables knowledge graph enrichment through logical inference and consistency validation.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
  - [Relations](#relations)
  - [Inference Rules](#inference-rules)
  - [Contradictions](#contradictions)
- [API Reference](#api-reference)
  - [Reasoner](#reasoner)
  - [RelationRegistry](#relationregistry)
  - [RuleEngine](#ruleengine)
  - [ContradictionDetector](#contradictiondetector)
- [Built-in Relations](#built-in-relations)
- [Built-in Rules](#built-in-rules)
- [Custom Rules](#custom-rules)
- [Contradiction Resolution](#contradiction-resolution)
- [Examples](#examples)
- [Performance Considerations](#performance-considerations)

## Overview

The reasoning package provides:

| Component | Purpose |
|-----------|---------|
| **RelationRegistry** | Manage relation types (transitive, symmetric, inverse) |
| **RuleEngine** | Forward chaining inference with pattern matching |
| **Reasoner** | High-level reasoning API with CKG integration |
| **ContradictionDetector** | Detect and resolve conflicting claims |

## Installation

```bash
pnpm add @contextgraph/reasoning
```

## Core Concepts

### Relations

Relations define how entities connect to each other. The reasoning engine supports three special relation types:

| Type | Description | Example |
|------|-------------|---------|
| **Transitive** | If A→B and B→C, then A→C | `partOf`, `locatedIn`, `ancestorOf` |
| **Symmetric** | If A→B, then B→A | `knows`, `siblingOf`, `collaboratesWith` |
| **Inverse** | If A→B via R, then B→A via R⁻¹ | `parentOf`/`childOf`, `employs`/`employedBy` |

### Inference Rules

Rules consist of conditions (patterns to match) and conclusions (facts to derive):

```typescript
interface InferenceRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  conclusions: RuleConclusion[];
  priority: number;
  enabled: boolean;
}
```

### Contradictions

Contradictions occur when claims conflict:

| Type | Description | Example |
|------|-------------|---------|
| **Direct Negation** | Same predicate with true/false | `isActive: true` vs `isActive: false` |
| **Mutual Exclusion** | Incompatible values | `status: active` vs `status: deleted` |
| **Temporal Overlap** | Conflicting validity periods | Two addresses valid at same time |
| **Cardinality** | Multiple values for single-valued property | Two birthdates |

## API Reference

### Reasoner

The main reasoning interface that integrates with CKG.

```typescript
class Reasoner {
  constructor(
    ckg: CKG,
    storage: StorageInterface,
    config?: Partial<ReasonerConfig>
  );

  // Infer new facts for an entity
  async infer(entityId: EntityId, predicates?: string[]): Promise<Result<InferredFact[]>>;

  // Explain why a claim exists
  async explain(claimId: ClaimId): Promise<Result<Explanation>>;

  // Explain an inferred fact
  explainInference(inferredFact: InferredFact): Explanation;

  // Get all inferred facts
  getInferredFacts(): InferredFact[];

  // Clear inference cache
  clearInferences(): void;

  // Get statistics
  getStats(): ReasoningStats;

  // Register custom relation
  registerRelation(definition: RelationDefinition): void;

  // Register custom rule
  registerRule(rule: InferenceRule): void;

  // Access underlying components
  getRelations(): RelationRegistry;
  getRuleEngine(): RuleEngine;
}
```

#### ReasonerConfig

```typescript
interface ReasonerConfig {
  /** Maximum inference iterations (default: 100) */
  maxIterations?: number;
  /** Maximum inferred facts (default: 10000) */
  maxFacts?: number;
  /** Minimum confidence threshold (default: 0.5) */
  minConfidence?: number;
  /** Whether to store inferred facts (default: false) */
  materialize?: boolean;
}
```

#### InferredFact

```typescript
interface InferredFact {
  subjectId: EntityId;
  predicate: string;
  object: string | number | boolean;
  sourceClaims: ClaimId[];
  ruleId: string;
  confidence: number;
  inferredAt: number;
}
```

#### Explanation

```typescript
interface Explanation {
  claimId?: ClaimId;
  inferredFact?: InferredFact;
  text: string;
  sources: Array<{ claimId: ClaimId; description: string }>;
  rules: Array<{ ruleId: string; ruleName: string }>;
  chain: string[];
}
```

**Example:**

```typescript
import { createReasoner } from '@contextgraph/reasoning';
import { CKG } from '@contextgraph/ckg';

const ckg = new CKG(storage, provenance);
const reasoner = createReasoner(ckg, storage);

// Infer facts for an entity
const result = await reasoner.infer(entityId);
if (result.ok) {
  for (const fact of result.value) {
    console.log(`Inferred: ${fact.subjectId} ${fact.predicate} ${fact.object}`);
    console.log(`  Confidence: ${fact.confidence}`);
    console.log(`  Rule: ${fact.ruleId}`);
  }
}

// Explain a claim
const explanation = await reasoner.explain(claimId);
if (explanation.ok) {
  console.log(explanation.value.text);
  console.log('Reasoning chain:', explanation.value.chain.join(' → '));
}
```

### RelationRegistry

Manages relation definitions and their properties.

```typescript
class RelationRegistry {
  constructor();

  // Register a relation
  register(definition: RelationDefinition): void;

  // Check relation properties
  isTransitive(name: string): boolean;
  isSymmetric(name: string): boolean;

  // Get inverse relation
  getInverse(name: string): string | undefined;

  // Get relation definition
  get(name: string): RelationDefinition | undefined;

  // Get all relations
  getAll(): RelationDefinition[];

  // Number of registered relations
  get size(): number;
}
```

#### RelationDefinition

```typescript
interface RelationDefinition {
  name: string;
  description?: string;
  transitive?: boolean;
  symmetric?: boolean;
  inverseName?: string;
  domain?: string[];    // Allowed subject types
  range?: string[];     // Allowed object types
}
```

**Example:**

```typescript
import { createRelationRegistry } from '@contextgraph/reasoning';

const registry = createRelationRegistry();

// Register custom relation
registry.register({
  name: 'reportsTo',
  description: 'Employee reports to manager',
  transitive: true,
  inverseName: 'manages',
  domain: ['employee'],
  range: ['employee', 'manager'],
});

// Check properties
console.log(registry.isTransitive('reportsTo')); // true
console.log(registry.getInverse('reportsTo'));    // 'manages'
```

### RuleEngine

Forward chaining inference engine with pattern matching.

```typescript
class RuleEngine {
  constructor(rules?: RuleRegistry);

  // Find all matching rules
  findMatches(facts: Fact[]): RuleMatch[];

  // Apply a rule to generate new facts
  applyRule(rule: InferenceRule, bindings: VariableBinding[]): Fact[];

  // Run forward chaining until fixpoint
  forwardChain(
    initialFacts: Fact[],
    options?: { maxIterations?: number; maxFacts?: number }
  ): Result<{ facts: Fact[]; iterations: number; newFactsCount: number }>;

  // Access rule registry
  getRules(): RuleRegistry;
}
```

#### Fact

```typescript
interface Fact {
  subject: string;
  predicate: string;
  object: string | number | boolean;
}
```

#### RuleMatch

```typescript
interface RuleMatch {
  rule: InferenceRule;
  bindings: VariableBinding[];
}
```

**Example:**

```typescript
import { createRuleEngine } from '@contextgraph/reasoning';

const engine = createRuleEngine();

const facts: Fact[] = [
  { subject: 'alice', predicate: 'parentOf', object: 'bob' },
  { subject: 'bob', predicate: 'parentOf', object: 'charlie' },
];

const result = engine.forwardChain(facts, { maxIterations: 10 });

if (result.ok) {
  console.log(`Derived ${result.value.newFactsCount} new facts`);
  console.log(`Total facts: ${result.value.facts.length}`);
  console.log(`Iterations: ${result.value.iterations}`);
}
```

### ContradictionDetector

Detects and resolves contradictory claims.

```typescript
class ContradictionDetector {
  constructor(ckg: CKG, storage: StorageInterface);

  // Detect contradictions for an entity
  async detectContradictions(entityId: EntityId): Promise<Result<Contradiction[]>>;

  // Detect all contradictions for an entity type
  async detectAllForType(entityType: string): Promise<Result<Contradiction[]>>;

  // Check consistency before adding a claim
  async checkConsistency(
    entityId: EntityId,
    predicate: string,
    value: unknown
  ): Promise<Result<{ consistent: boolean; conflicts: Contradiction[] }>>;

  // Resolve a contradiction
  resolveContradiction(
    contradictionId: string,
    strategy: ResolutionStrategy,
    claims: Array<{ id: ClaimId; createdAt: number; confidence: number }>
  ): Result<ResolutionResult>;

  // Get all detected contradictions
  getContradictions(): Contradiction[];

  // Add custom exclusion rule
  addExclusionRule(rule: MutualExclusionRule): void;

  // Add single-valued property rules
  addSingleValuedRule(rule: SingleValuedRule): void;
}
```

#### Contradiction

```typescript
interface Contradiction {
  id: string;
  type: ContradictionType;
  entityId: EntityId;
  claimIds: ClaimId[];
  description: string;
  detectedAt: number;
  suggestedResolution?: ResolutionStrategy;
}

type ContradictionType =
  | 'direct_negation'
  | 'mutual_exclusion'
  | 'temporal_overlap'
  | 'cardinality'
  | 'type_mismatch';
```

#### ResolutionStrategy

```typescript
type ResolutionStrategy =
  | 'latest_wins'        // Keep most recent claim
  | 'highest_confidence' // Keep highest confidence claim
  | 'manual_required'    // Requires human decision
  | 'keep_both'          // Accept contradiction
  | 'revoke_both';       // Remove all conflicting claims
```

#### ResolutionResult

```typescript
interface ResolutionResult {
  contradictionId: string;
  strategy: ResolutionStrategy;
  keptClaims: ClaimId[];
  revokedClaims: ClaimId[];
  resolvedAt: number;
}
```

**Example:**

```typescript
import { createContradictionDetector } from '@contextgraph/reasoning';

const detector = createContradictionDetector(ckg, storage);

// Detect contradictions
const result = await detector.detectContradictions(entityId);

if (result.ok) {
  for (const contradiction of result.value) {
    console.log(`Found ${contradiction.type}: ${contradiction.description}`);
    console.log(`  Claims: ${contradiction.claimIds.join(', ')}`);
    console.log(`  Suggested: ${contradiction.suggestedResolution}`);
  }
}

// Check before adding claim
const consistency = await detector.checkConsistency(
  entityId,
  'dateOfBirth',
  '1990-01-15'
);

if (!consistency.value.consistent) {
  console.log('Would create contradiction!');
  for (const conflict of consistency.value.conflicts) {
    console.log(`  Conflict with: ${conflict.claimIds.join(', ')}`);
  }
}
```

## Built-in Relations

The registry includes common relations out of the box:

### Transitive Relations

| Name | Description |
|------|-------------|
| `partOf` | Part-whole relationship |
| `subclassOf` | Type hierarchy |
| `locatedIn` | Location hierarchy |
| `reportsTo` | Organizational hierarchy |
| `ancestorOf` | Family hierarchy |

### Symmetric Relations

| Name | Description |
|------|-------------|
| `knows` | Personal acquaintance |
| `collaboratesWith` | Professional collaboration |
| `relatedTo` | Generic relation |
| `siblingOf` | Family relation |
| `marriedTo` | Marital relation |

### Inverse Relations

| Relation | Inverse |
|----------|---------|
| `parentOf` | `childOf` |
| `employs` | `employedBy` |
| `owns` | `ownedBy` |
| `manages` | `managedBy` |
| `teaches` | `taughtBy` |
| `creates` | `createdBy` |

## Built-in Rules

### Transitive Closure

```typescript
{
  id: 'transitive-closure',
  name: 'Transitive Closure',
  description: 'If A relates to B and B relates to C via transitive relation, then A relates to C',
  conditions: [
    { subject: '?a', predicate: '?rel', object: '?b' },
    { subject: '?b', predicate: '?rel', object: '?c' },
  ],
  conclusions: [
    { subject: '?a', predicate: '?rel', object: '?c', confidenceMultiplier: 0.9 }
  ],
  priority: 100,
}
```

### Symmetric Relation

```typescript
{
  id: 'symmetric-relation',
  name: 'Symmetric Relation',
  description: 'If A relates to B via symmetric relation, then B relates to A',
  conditions: [
    { subject: '?a', predicate: '?rel', object: '?b' }
  ],
  conclusions: [
    { subject: '?b', predicate: '?rel', object: '?a', confidenceMultiplier: 1.0 }
  ],
  priority: 90,
}
```

### Inverse Relation

```typescript
{
  id: 'inverse-relation',
  name: 'Inverse Relation',
  description: 'If A relates to B, then B relates to A via inverse',
  conditions: [
    { subject: '?a', predicate: '?rel', object: '?b' }
  ],
  conclusions: [
    { subject: '?b', predicate: '?inverseRel', object: '?a', confidenceMultiplier: 1.0 }
  ],
  priority: 80,
}
```

## Custom Rules

Create custom inference rules for domain-specific reasoning:

```typescript
import { Reasoner } from '@contextgraph/reasoning';

const reasoner = createReasoner(ckg, storage);

// Rule: Team members know each other
reasoner.registerRule({
  id: 'team-knows',
  name: 'Team Members Know Each Other',
  description: 'If A and B are on the same team, they know each other',
  conditions: [
    { subject: '?a', predicate: 'memberOf', object: '?team' },
    { subject: '?b', predicate: 'memberOf', object: '?team' },
  ],
  conclusions: [
    { subject: '?a', predicate: 'knows', object: '?b', confidenceMultiplier: 0.8 }
  ],
  priority: 50,
  enabled: true,
});

// Rule: Manager hierarchy
reasoner.registerRule({
  id: 'skip-level-manager',
  name: 'Skip-Level Manager',
  description: 'If A manages B and B manages C, then A is skip-level manager of C',
  conditions: [
    { subject: '?a', predicate: 'manages', object: '?b' },
    { subject: '?b', predicate: 'manages', object: '?c' },
  ],
  conclusions: [
    { subject: '?a', predicate: 'skipLevelManages', object: '?c', confidenceMultiplier: 0.95 }
  ],
  priority: 60,
  enabled: true,
});
```

### Pattern Variables

Rules use variables (prefixed with `?`) for pattern matching:

| Variable | Matches |
|----------|---------|
| `?a`, `?b`, `?c` | Any entity ID |
| `?rel` | Any predicate |
| `?value` | Any value |

### Confidence Multiplier

Each conclusion has a `confidenceMultiplier` that reduces confidence for inferred facts:

```typescript
// Source claims have confidence 1.0
// After transitive inference (0.9 multiplier):
// Final confidence = 1.0 * 0.9 = 0.9

// After two transitive steps:
// Final confidence = 1.0 * 0.9 * 0.9 = 0.81
```

## Contradiction Resolution

### Default Single-Valued Properties

These properties can only have one value:

- `dateOfBirth`
- `dateOfDeath`
- `birthplace`
- `gender`
- `maritalStatus`
- `nationality`
- `ssn`
- `taxId`
- `email`
- `primaryPhone`

### Default Mutual Exclusions

```typescript
// Status values are mutually exclusive
{ predicate: 'status', exclusiveValues: ['active', 'inactive', 'suspended', 'deleted'] }

// Alive/dead are mutually exclusive
{ predicate: 'alive', exclusiveValues: [true, false] }
```

### Adding Custom Rules

```typescript
const detector = createContradictionDetector(ckg, storage);

// Add single-valued property
detector.addSingleValuedRule({
  predicates: ['primaryAddress', 'currentEmployer', 'spouseId'],
});

// Add mutual exclusion
detector.addExclusionRule({
  predicate: 'employmentStatus',
  exclusiveValues: ['employed', 'unemployed', 'retired', 'student'],
  description: 'Employment status values are mutually exclusive',
});
```

### Resolution Workflow

```typescript
// 1. Detect contradictions
const contradictions = await detector.detectContradictions(entityId);

// 2. For each contradiction, decide resolution
for (const contradiction of contradictions.value) {
  // Get the claims with their metadata
  const claims = await Promise.all(
    contradiction.claimIds.map(async (id) => {
      const claim = await ckg.getClaim(id);
      return {
        id,
        createdAt: claim.value?.data.createdAt ?? 0,
        confidence: 1.0, // or get from claim metadata
      };
    })
  );

  // Apply resolution strategy
  const resolution = detector.resolveContradiction(
    contradiction.id,
    'latest_wins',
    claims
  );

  if (resolution.ok) {
    // Revoke the claims that lost
    for (const claimId of resolution.value.revokedClaims) {
      await ckg.revokeClaim(claimId);
    }

    console.log(`Resolved: kept ${resolution.value.keptClaims.length} claims`);
  }
}
```

## Examples

### Organization Hierarchy Reasoning

```typescript
import { createReasoner, createRelationRegistry } from '@contextgraph/reasoning';

async function reasonAboutOrganization(ckg: CKG) {
  const reasoner = createReasoner(ckg, storage);

  // Register organization-specific relations
  reasoner.registerRelation({
    name: 'reportsTo',
    transitive: true,
    inverseName: 'directReports',
  });

  // Add organization-specific rule
  reasoner.registerRule({
    id: 'same-department',
    name: 'Same Department Inference',
    description: 'People who report to same manager are in same department',
    conditions: [
      { subject: '?a', predicate: 'reportsTo', object: '?manager' },
      { subject: '?b', predicate: 'reportsTo', object: '?manager' },
    ],
    conclusions: [
      { subject: '?a', predicate: 'sameDepartmentAs', object: '?b', confidenceMultiplier: 0.85 }
    ],
    priority: 40,
    enabled: true,
  });

  // Run inference for an employee
  const result = await reasoner.infer(employeeId);

  if (result.ok) {
    // Find all indirect reports
    const indirectReports = result.value.filter(
      f => f.predicate === 'directReports' && f.ruleId === 'inverse-relation'
    );

    // Find all colleagues
    const colleagues = result.value.filter(
      f => f.predicate === 'sameDepartmentAs'
    );

    return { indirectReports, colleagues };
  }
}
```

### Knowledge Graph Consistency Check

```typescript
import { createContradictionDetector } from '@contextgraph/reasoning';

async function validateKnowledgeGraph(ckg: CKG) {
  const detector = createContradictionDetector(ckg, storage);

  // Check all person entities
  const result = await detector.detectAllForType('person');

  if (!result.ok) {
    console.error('Failed to check:', result.error);
    return;
  }

  const report = {
    totalContradictions: result.value.length,
    byType: {} as Record<string, number>,
    criticalIssues: [] as Contradiction[],
  };

  for (const contradiction of result.value) {
    // Count by type
    report.byType[contradiction.type] =
      (report.byType[contradiction.type] ?? 0) + 1;

    // Flag critical issues (cardinality on important fields)
    if (
      contradiction.type === 'cardinality' &&
      ['ssn', 'dateOfBirth', 'taxId'].some(f =>
        contradiction.description.includes(f)
      )
    ) {
      report.criticalIssues.push(contradiction);
    }
  }

  return report;
}
```

### Pre-flight Claim Validation

```typescript
import { createContradictionDetector } from '@contextgraph/reasoning';

async function addClaimSafely(
  ckg: CKG,
  entityId: EntityId,
  predicate: string,
  value: unknown
) {
  const detector = createContradictionDetector(ckg, storage);

  // Check consistency first
  const check = await detector.checkConsistency(entityId, predicate, value);

  if (!check.ok) {
    throw check.error;
  }

  if (!check.value.consistent) {
    // Handle conflicts
    const conflicts = check.value.conflicts;

    // Option 1: Reject
    throw new Error(
      `Cannot add claim: would conflict with ${conflicts.length} existing claims`
    );

    // Option 2: Auto-resolve with latest-wins
    // for (const conflict of conflicts) {
    //   await detector.resolveContradiction(conflict.id, 'latest_wins', ...);
    // }
  }

  // Safe to add
  return ckg.addClaim({ subjectId: entityId, predicate, objectValue: value, ... });
}
```

## Performance Considerations

### Limiting Inference Scope

```typescript
// Only infer specific predicates
const result = await reasoner.infer(entityId, ['manages', 'reportsTo']);
```

### Controlling Iterations

```typescript
const reasoner = createReasoner(ckg, storage, {
  maxIterations: 50,   // Limit inference depth
  maxFacts: 5000,      // Limit total facts
  minConfidence: 0.6,  // Filter low-confidence inferences
});
```

### Caching Inferences

```typescript
// Inferences are cached in memory
const result1 = await reasoner.infer(entityId); // Computes
const result2 = await reasoner.infer(entityId); // Uses cache

// Clear cache when data changes
reasoner.clearInferences();
```

### Rule Priority

Higher priority rules fire first. Use this to ensure important rules complete before others:

```typescript
// Critical rules: 90-100
// Normal rules: 50-89
// Optional rules: 0-49
```

### Batch Processing

For large graphs, process entities in batches:

```typescript
async function inferAll(entityIds: EntityId[]) {
  const results = [];

  for (const batch of chunk(entityIds, 100)) {
    const batchResults = await Promise.all(
      batch.map(id => reasoner.infer(id))
    );
    results.push(...batchResults);

    // Clear cache between batches if memory is a concern
    reasoner.clearInferences();
  }

  return results;
}
```
