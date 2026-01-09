# SDK API Reference

Complete API reference for the ContextGraph SDK.

## ContextGraph Class

### create()

```typescript
static async create(config?: ContextGraphConfig): Promise<Result<ContextGraph>>
```

Creates a new ContextGraph client.

**Parameters:**
- `config` - Optional configuration object

**Returns:** `Result<ContextGraph>`

### Entity Methods

#### createEntity()

```typescript
async createEntity(input: CreateEntityInput): Promise<Result<Entity>>
```

#### getEntity()

```typescript
async getEntity(id: EntityId): Promise<Result<Entity | null>>
```

#### updateEntity()

```typescript
async updateEntity(id: EntityId, updates: Partial<Entity>): Promise<Result<Entity>>
```

#### listEntities()

```typescript
async listEntities(options?: ListEntitiesOptions): Promise<Result<Entity[]>>
```

### Claim Methods

#### addClaim()

```typescript
async addClaim(input: AddClaimInput): Promise<Result<Claim>>
```

#### getClaims()

```typescript
async getClaims(entityId: EntityId, options?: ClaimQueryOptions): Promise<Result<Claim[]>>
```

#### revokeClaim()

```typescript
async revokeClaim(id: ClaimId, reason?: string): Promise<Result<void>>
```

### Agent Methods

#### createAgent()

```typescript
async createAgent(input: CreateAgentInput): Promise<Result<Agent>>
```

#### getAgent()

```typescript
async getAgent(id: AgentId): Promise<Result<Agent | null>>
```

#### getAgentByName()

```typescript
async getAgentByName(name: string): Promise<Result<Agent | null>>
```

#### listAgents()

```typescript
async listAgents(options?: ListAgentsOptions): Promise<Result<Agent[]>>
```

### Execution Methods

#### registerHandler()

```typescript
registerHandler(
  action: string,
  resourceType: string,
  handler: ActionHandler
): void
```

#### execute()

```typescript
async execute(request: ActionRequest): Promise<Result<ActionResult>>
```

### Decision Methods

#### recordDecision()

```typescript
async recordDecision(input: RecordDecisionInput): Promise<Result<Decision>>
```

#### approveDecision()

```typescript
async approveDecision(
  id: DecisionId,
  approverId: AgentId,
  comment?: string
): Promise<Result<Decision>>
```

#### rejectDecision()

```typescript
async rejectDecision(
  id: DecisionId,
  rejecterId: AgentId,
  reason?: string
): Promise<Result<Decision>>
```

#### getPendingDecisions()

```typescript
async getPendingDecisions(): Promise<Result<Decision[]>>
```

### Policy Methods

#### createPolicy()

```typescript
async createPolicy(input: CreatePolicyInput): Promise<Result<Policy>>
```

#### listPolicies()

```typescript
async listPolicies(options?: ListPoliciesOptions): Promise<Result<Policy[]>>
```

### Provenance Methods

#### verifyProvenance()

```typescript
async verifyProvenance(): Promise<Result<VerificationResult>>
```

#### queryProvenance()

```typescript
async queryProvenance(options?: ProvenanceQueryOptions): Promise<Result<ProvenanceEntry[]>>
```

### Context Methods

#### assembleContext()

```typescript
async assembleContext(
  entityId: EntityId,
  options?: AssemblyOptions
): Promise<Result<AssembledContext>>
```

### Audit Methods

#### getAuditTrail()

```typescript
async getAuditTrail(options?: AuditQueryOptions): Promise<Result<AuditEntry[]>>
```

### Statistics

#### getStats()

```typescript
async getStats(): Promise<Result<SystemStats>>
```

### Import/Export

#### exportToJSON()

```typescript
async exportToJSON(): Promise<Result<ExportData>>
```

#### importFromJSON()

```typescript
async importFromJSON(
  data: ExportData,
  options?: ImportOptions
): Promise<Result<ImportResult>>
```

### Events

#### on()

```typescript
on(event: EventType, handler: EventHandler): void
```

#### off()

```typescript
off(event: EventType, handler: EventHandler): void
```

## Helper Functions

### createTimestamp()

```typescript
function createTimestamp(input?: string | Date): Timestamp
```

### createScope()

```typescript
function createScope(value: string): Scope
```

### createJurisdiction()

```typescript
function createJurisdiction(value: string): Jurisdiction
```

### createConfidence()

```typescript
function createConfidence(value: number): Confidence
```

### ok()

```typescript
function ok<T>(value: T): Result<T>
```

### err()

```typescript
function err<E = Error>(error: E): Result<never, E>
```
