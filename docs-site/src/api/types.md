# Type Definitions

Core TypeScript types used throughout ContextGraph OS.

## Branded Types

```typescript
// Unique identifiers with compile-time safety
type EntityId = string & { readonly __brand: 'EntityId' };
type ClaimId = string & { readonly __brand: 'ClaimId' };
type AgentId = string & { readonly __brand: 'AgentId' };
type DecisionId = string & { readonly __brand: 'DecisionId' };
type PolicyId = string & { readonly __brand: 'PolicyId' };
type ProvenanceId = string & { readonly __brand: 'ProvenanceId' };
type Timestamp = string & { readonly __brand: 'Timestamp' };
type Scope = string & { readonly __brand: 'Scope' };
type Jurisdiction = string & { readonly __brand: 'Jurisdiction' };
type Confidence = number & { readonly __brand: 'Confidence' };
```

## Result Type

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

## Entity Types

```typescript
interface Entity {
  id: EntityId;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CreateEntityInput {
  type: string;
  name: string;
  properties?: Record<string, unknown>;
}
```

## Claim Types

```typescript
interface Claim {
  id: ClaimId;
  subjectId: EntityId;
  predicate: string;
  objectValue?: unknown;
  objectId?: EntityId;
  context: ClaimContext;
  status: 'active' | 'revoked';
  createdAt: Timestamp;
  revokedAt?: Timestamp;
  revokedReason?: string;
}

interface ClaimContext {
  scope?: Scope;
  jurisdiction?: Jurisdiction;
  confidence?: Confidence;
  validFrom?: Timestamp;
  validUntil?: Timestamp | null;
}

interface AddClaimInput {
  subjectId: EntityId;
  predicate: string;
  value?: unknown;
  objectId?: EntityId;
  context?: Partial<ClaimContext>;
}
```

## Agent Types

```typescript
interface Agent {
  id: AgentId;
  name: string;
  description?: string;
  status: AgentStatus;
  capabilities: string[];
  metadata?: Record<string, unknown>;
  parentId?: AgentId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type AgentStatus = 'active' | 'suspended' | 'revoked';

interface CreateAgentInput {
  name: string;
  description?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}
```

## Decision Types

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

## Policy Types

```typescript
interface Policy {
  id: PolicyId;
  name: string;
  version: string;
  description?: string;
  effect: 'allow' | 'deny';
  subjects: string[];
  actions: string[];
  resources: string[];
  conditions?: Condition[];
  priority: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
}

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

## Provenance Types

```typescript
interface ProvenanceEntry {
  id: ProvenanceId;
  hash: string;
  previousHash: string | null;
  type: ProvenanceType;
  subjectId: string;
  data: unknown;
  source: ProvenanceSource;
  timestamp: Timestamp;
  agentId?: AgentId;
}

type ProvenanceType =
  | 'claim_created'
  | 'claim_revoked'
  | 'entity_created'
  | 'entity_updated'
  | 'decision_recorded'
  | 'decision_approved'
  | 'decision_rejected'
  | 'execution_logged'
  | 'policy_created';

interface ProvenanceSource {
  type: 'agent' | 'user' | 'system' | 'external' | 'inference';
  id: string;
  method?: string;
  metadata?: Record<string, unknown>;
}
```

## Execution Types

```typescript
interface ActionRequest {
  agentId: AgentId;
  action: string;
  resourceType: string;
  resourceId: string;
  parameters?: Record<string, unknown>;
}

interface ActionResult {
  executionId: string;
  status: 'allowed' | 'denied' | 'error';
  output?: unknown;
  error?: Error;
  duration: number;
  timestamp: Timestamp;
}
```

## Query Types

```typescript
interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ClaimQueryOptions extends QueryOptions {
  predicate?: string;
  asOf?: Timestamp;
  jurisdiction?: string;
  scope?: string;
  minConfidence?: number;
  activeOnly?: boolean;
  includeExpired?: boolean;
}
```
