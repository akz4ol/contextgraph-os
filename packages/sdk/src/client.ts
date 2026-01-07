/**
 * ContextGraph Client
 *
 * Unified high-level API for ContextGraph OS.
 */

import {
  type Result,
  type EntityId,
  type ProvenanceId,
  type Timestamp,
  type Scope,
  type Jurisdiction,
  type ContextDimensions,
  createTimestamp,
  createScope,
  createJurisdiction,
  ok,
  err,
} from '@contextgraph/core';
import { InMemoryStorage, type StorageInterface } from '@contextgraph/storage';
import { CKG, type Entity, type Claim } from '@contextgraph/ckg';
import { ProvenanceLedger, type ProvenanceEntry, type ChainVerificationResult } from '@contextgraph/provenance';
import { DecisionTraceGraph, type Decision } from '@contextgraph/dtg';
import { PolicyLedger, type Policy, type PolicyRule, type RuleCondition } from '@contextgraph/policy';
import { AgentRegistry, CapabilityRegistry, type Agent, type AgentId, type CreateAgentInput as AgentCreateInput, initializeBuiltinCapabilities } from '@contextgraph/agent';
import { ContextAssembler, type AssembledContext, type ContextQuery, type ContextFilter } from '@contextgraph/retrieval';
import { Executor, type ExecutionResult, type ActionHandler } from '@contextgraph/execution';
import type {
  ContextGraphConfig,
  ContextOptions,
  QueryOptions,
  CreateEntityInput,
  CreateClaimInput,
  CreateAgentInput,
  ExecuteActionInput,
  CreatePolicyInput,
  EventType,
  SDKEvent,
  EventHandler,
  AuditEntry,
} from './types.js';

/**
 * ContextGraph Client
 *
 * The main entry point for interacting with ContextGraph OS.
 */
export class ContextGraph {
  private readonly storage: StorageInterface;
  private readonly ckg: CKG;
  private readonly provenance: ProvenanceLedger;
  private readonly dtg: DecisionTraceGraph;
  private readonly policyLedger: PolicyLedger;
  private readonly agentRegistry: AgentRegistry;
  private readonly capabilityRegistry: CapabilityRegistry;
  private readonly contextAssembler: ContextAssembler;
  private readonly executor: Executor;

  private readonly config: Required<ContextGraphConfig>;
  private readonly eventHandlers = new Map<EventType, Set<EventHandler>>();
  private initialized = false;

  private constructor(config: ContextGraphConfig) {
    this.storage = config.storage ?? new InMemoryStorage();

    this.config = {
      storage: this.storage,
      defaultScope: config.defaultScope ?? createScope('default'),
      defaultJurisdiction: config.defaultJurisdiction ?? createJurisdiction('global'),
      autoProvenance: config.autoProvenance ?? true,
      enablePolicies: config.enablePolicies ?? true,
      enableCapabilities: config.enableCapabilities ?? true,
    };

    // Initialize all components
    this.provenance = new ProvenanceLedger(this.storage);
    this.ckg = new CKG({ storage: this.storage, requireProvenance: true });
    this.dtg = new DecisionTraceGraph(this.storage, this.provenance);
    this.policyLedger = new PolicyLedger(this.storage);
    this.agentRegistry = new AgentRegistry(this.storage);
    this.capabilityRegistry = new CapabilityRegistry();
    this.contextAssembler = new ContextAssembler(this.ckg, this.provenance);

    this.executor = new Executor({
      storage: this.storage,
      agentRegistry: this.agentRegistry,
      capabilityRegistry: this.capabilityRegistry,
      policyLedger: this.policyLedger,
      decisionGraph: this.dtg,
      provenanceLedger: this.provenance,
      requireCapabilityCheck: this.config.enableCapabilities,
      requirePolicyCheck: this.config.enablePolicies,
    });
  }

  /**
   * Create and initialize a new ContextGraph client
   */
  static async create(config: ContextGraphConfig = {}): Promise<Result<ContextGraph, Error>> {
    const client = new ContextGraph(config);
    const initResult = await client.initialize();
    if (!initResult.ok) {
      return err(initResult.error);
    }
    return ok(client);
  }

  /**
   * Initialize the client
   */
  private async initialize(): Promise<Result<void, Error>> {
    if (this.initialized) {
      return ok(undefined);
    }

    // Initialize storage
    const storageResult = await this.storage.initialize();
    if (!storageResult.ok) {
      return err(storageResult.error);
    }

    // Initialize provenance
    const provResult = await this.provenance.initialize();
    if (!provResult.ok) {
      return err(provResult.error);
    }

    // Initialize built-in capabilities
    initializeBuiltinCapabilities(this.capabilityRegistry);

    this.initialized = true;
    return ok(undefined);
  }

  // ============================================================================
  // Entity Operations
  // ============================================================================

  /**
   * Create a new entity
   */
  async createEntity(input: CreateEntityInput): Promise<Result<Entity, Error>> {
    const createInput: {
      type: string;
      name?: string;
      properties?: Readonly<Record<string, unknown>>;
    } = {
      type: input.type,
    };

    if (input.name !== undefined) {
      createInput.name = input.name;
    }
    if (input.properties !== undefined) {
      createInput.properties = input.properties;
    }

    const result = await this.ckg.createEntity(createInput);

    if (result.ok) {
      await this.emit('entity:created', result.value);
    }

    return result;
  }

  /**
   * Get entity by ID
   */
  async getEntity(id: EntityId): Promise<Result<Entity | null, Error>> {
    return this.ckg.getEntity(id);
  }

  /**
   * Find entities by type
   */
  async findEntitiesByType(type: string, options?: QueryOptions): Promise<Result<readonly Entity[], Error>> {
    const queryOptions: { limit?: number; offset?: number } = {};
    if (options?.limit !== undefined) {
      queryOptions.limit = options.limit;
    }
    if (options?.offset !== undefined) {
      queryOptions.offset = options.offset;
    }
    return this.ckg.findEntitiesByType(type, queryOptions);
  }

  /**
   * Resolve entity by ID or alias
   */
  async resolveEntity(identifier: string): Promise<Result<Entity | null, Error>> {
    return this.ckg.resolveEntity(identifier);
  }

  // ============================================================================
  // Claim Operations
  // ============================================================================

  /**
   * Add a claim to an entity
   */
  async addClaim(input: CreateClaimInput): Promise<Result<Claim, Error>> {
    // Record provenance for this claim
    const provResult = await this.provenance.record({
      sourceType: 'system',
      sourceId: 'contextgraph-sdk',
      actor: 'sdk-user',
      action: 'create',
      metadata: {
        operation: 'add_claim',
        predicate: input.predicate,
        subjectId: input.subjectId,
      },
    });

    if (!provResult.ok) {
      return err(provResult.error);
    }

    // Get entity type for validation
    const entityResult = await this.ckg.getEntity(input.subjectId);
    if (!entityResult.ok) {
      return err(entityResult.error);
    }
    if (entityResult.value === null) {
      return err(new Error(`Entity not found: ${input.subjectId}`));
    }

    const context = this.buildContext(input.context);

    const claimInput: {
      subjectId: EntityId;
      subjectType: string;
      predicate: string;
      objectValue: unknown;
      objectId?: EntityId;
      context: ContextDimensions;
      provenanceId: ProvenanceId;
    } = {
      subjectId: input.subjectId,
      subjectType: entityResult.value.data.type,
      predicate: input.predicate,
      objectValue: input.value,
      context,
      provenanceId: provResult.value.data.id,
    };

    if (input.objectId !== undefined) {
      claimInput.objectId = input.objectId;
    }

    const result = await this.ckg.createClaim(claimInput);

    if (result.ok) {
      await this.emit('claim:added', result.value);
    }

    return result;
  }

  /**
   * Get claims for an entity
   */
  async getClaims(entityId: EntityId, options?: QueryOptions): Promise<Result<readonly Claim[], Error>> {
    const result = await this.ckg.getClaimsForSubject(entityId);
    if (!result.ok) {
      return result;
    }

    let claims = [...result.value];

    // Apply temporal filter if specified
    if (options?.asOf !== undefined) {
      claims = claims.filter((c) => {
        const start = c.data.context.temporal?.start;
        const end = c.data.context.temporal?.end;
        if (start !== undefined && options.asOf! < start) return false;
        if (end !== undefined && end !== null && options.asOf! > end) return false;
        return true;
      });
    }

    // Apply confidence filter if specified
    if (options?.minConfidence !== undefined) {
      claims = claims.filter((c) => {
        const conf = c.data.context.confidence ?? 1.0;
        return conf >= options.minConfidence!;
      });
    }

    // Apply limit
    if (options?.limit !== undefined) {
      claims = claims.slice(0, options.limit);
    }

    return ok(claims);
  }

  /**
   * Get a specific claim value
   */
  async getClaimValue(entityId: EntityId, predicate: string, options?: QueryOptions): Promise<Result<unknown, Error>> {
    const claimsResult = await this.getClaims(entityId, options);
    if (!claimsResult.ok) {
      return err(claimsResult.error);
    }

    const claim = claimsResult.value.find((c) => c.data.predicate === predicate);
    if (!claim) {
      return err(new Error(`No claim found for predicate: ${predicate}`));
    }

    return ok(claim.data.objectValue);
  }

  // ============================================================================
  // Agent Operations
  // ============================================================================

  /**
   * Create a new agent
   */
  async createAgent(input: CreateAgentInput): Promise<Result<Agent, Error>> {
    const createInput: AgentCreateInput = {
      name: input.name,
    };

    if (input.description !== undefined) {
      (createInput as { description?: string }).description = input.description;
    }
    if (input.parentAgentId !== undefined) {
      (createInput as { parentAgentId?: AgentId }).parentAgentId = input.parentAgentId as unknown as AgentId;
    }
    if (input.metadata !== undefined) {
      (createInput as { metadata?: Readonly<Record<string, unknown>> }).metadata = input.metadata;
    }

    const result = await this.agentRegistry.create(createInput);

    if (result.ok) {
      await this.emit('agent:created', result.value);
    }

    return result;
  }

  /**
   * Get agent by ID
   */
  async getAgent(id: string): Promise<Result<Agent | null, Error>> {
    return this.agentRegistry.findById(id as unknown as AgentId);
  }

  /**
   * Find agent by name
   */
  async findAgentByName(name: string): Promise<Result<Agent | null, Error>> {
    return this.agentRegistry.findByName(name);
  }

  /**
   * Get all active agents
   */
  async getActiveAgents(): Promise<Result<readonly Agent[], Error>> {
    return this.agentRegistry.findActive();
  }

  // ============================================================================
  // Execution Operations
  // ============================================================================

  /**
   * Execute an action
   */
  async execute(input: ExecuteActionInput): Promise<Result<ExecutionResult, Error>> {
    const actionDef: {
      type: 'read' | 'write' | 'execute' | 'communicate' | 'delegate' | 'approve' | 'reject';
      resourceType: string;
      resourceId?: string;
      parameters?: Readonly<Record<string, unknown>>;
      description?: string;
    } = {
      type: input.action as 'read' | 'write' | 'execute' | 'communicate' | 'delegate' | 'approve' | 'reject',
      resourceType: input.resourceType,
    };

    if (input.resourceId !== undefined) {
      actionDef.resourceId = input.resourceId;
    }
    if (input.parameters !== undefined) {
      actionDef.parameters = input.parameters;
    }
    if (input.description !== undefined) {
      actionDef.description = input.description;
    }

    const result = await this.executor.execute({
      agentId: input.agentId as unknown as AgentId,
      action: actionDef,
    });

    if (result.ok) {
      if (result.value.status === 'completed') {
        await this.emit('execution:completed', result.value);
      } else if (result.value.status === 'failed') {
        await this.emit('execution:failed', result.value);
      }
    }

    return result;
  }

  /**
   * Register an action handler
   */
  registerHandler(action: string, resourceType: string, handler: ActionHandler): void {
    this.executor.registerHandler(
      action as 'read' | 'write' | 'execute' | 'communicate' | 'delegate' | 'approve' | 'reject',
      resourceType,
      handler
    );
  }

  // ============================================================================
  // Policy Operations
  // ============================================================================

  /**
   * Create a new policy
   */
  async createPolicy(input: CreatePolicyInput): Promise<Result<Policy, Error>> {
    // Build a proper PolicyRule from the input
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const conditions: RuleCondition[] = input.conditions !== undefined
      ? input.conditions.map((c) => ({
          field: c.field,
          operator: c.operator as RuleCondition['operator'],
          value: c.value,
        }))
      : [];

    const rules: PolicyRule[] = [{
      id: ruleId,
      name: `${input.name}-rule`,
      description: input.description,
      effect: input.effect,
      conditions,
      priority: input.priority ?? 0,
    }];

    const policyInput: {
      name: string;
      version: string;
      rules: readonly PolicyRule[];
      description?: string;
      priority?: number;
    } = {
      name: input.name,
      version: input.version,
      rules,
    };

    if (input.description !== undefined) {
      policyInput.description = input.description;
    }
    if (input.priority !== undefined) {
      policyInput.priority = input.priority;
    }

    const result = await this.policyLedger.create(policyInput);

    if (result.ok) {
      await this.emit('policy:created', result.value);
    }

    return result;
  }

  /**
   * Get effective policies
   */
  async getEffectivePolicies(): Promise<Result<readonly Policy[], Error>> {
    return this.policyLedger.findEffective();
  }

  // ============================================================================
  // Decision Operations
  // ============================================================================

  /**
   * Record a decision
   */
  async recordDecision(input: {
    type: string;
    title: string;
    proposedBy: string;
    description?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<Result<Decision, Error>> {
    const decisionInput: {
      type: 'claim_creation' | 'claim_update' | 'entity_creation' | 'entity_update' |
            'policy_change' | 'workflow_step' | 'external_action' | 'approval_request' | 'exception_request';
      title: string;
      proposedBy: EntityId;
      description?: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    } = {
      type: input.type as 'claim_creation',
      title: input.title,
      proposedBy: input.proposedBy as EntityId,
    };

    if (input.description !== undefined) {
      decisionInput.description = input.description;
    }
    if (input.riskLevel !== undefined) {
      decisionInput.riskLevel = input.riskLevel;
    }

    const result = await this.dtg.recordDecision(decisionInput);

    if (result.ok) {
      await this.emit('decision:proposed', result.value);
    }

    return result;
  }

  /**
   * Get pending decisions
   */
  async getPendingDecisions(): Promise<Result<readonly Decision[], Error>> {
    return this.dtg.getPendingDecisions();
  }

  /**
   * Approve a decision
   */
  async approveDecision(decisionId: string, approverId: string): Promise<Result<Decision | null, Error>> {
    const result = await this.dtg.approveDecision(decisionId as unknown as import('@contextgraph/core').DecisionId, approverId as EntityId);

    if (result.ok && result.value) {
      await this.emit('decision:approved', result.value);
    }

    return result;
  }

  // ============================================================================
  // Context Assembly
  // ============================================================================

  /**
   * Assemble context for an entity
   */
  async assembleContext(entityId: EntityId, options?: QueryOptions): Promise<Result<AssembledContext, Error>> {
    const filter: ContextFilter = {};

    if (options !== undefined) {
      if (options.asOf !== undefined) {
        (filter as { asOf?: Timestamp }).asOf = options.asOf;
      }
      if (options.scope !== undefined) {
        (filter as { scope?: Scope }).scope = options.scope;
      }
      if (options.minConfidence !== undefined) {
        (filter as { minConfidence?: number }).minConfidence = options.minConfidence;
      }
    }

    const query: ContextQuery = {
      entityIds: [entityId],
      filter,
    };

    return this.contextAssembler.assemble(query, { maxDepth: 2 });
  }

  // ============================================================================
  // Provenance Operations
  // ============================================================================

  /**
   * Get provenance by ID
   */
  async getProvenance(id: ProvenanceId): Promise<Result<ProvenanceEntry | null, Error>> {
    return this.provenance.getById(id);
  }

  /**
   * Query provenance entries
   */
  async queryProvenance(options?: { limit?: number }): Promise<Result<readonly ProvenanceEntry[], Error>> {
    const queryOpts: { limit?: number } = {};
    if (options?.limit !== undefined) {
      queryOpts.limit = options.limit;
    }
    return this.provenance.query(queryOpts);
  }

  /**
   * Verify provenance chain integrity
   */
  async verifyProvenance(): Promise<Result<ChainVerificationResult, Error>> {
    return this.provenance.verifyChain();
  }

  // ============================================================================
  // Audit Operations
  // ============================================================================

  /**
   * Get audit trail for recent operations
   */
  async getAuditTrail(options?: { limit?: number }): Promise<Result<readonly AuditEntry[], Error>> {
    const execResult = await this.executor.query({ limit: options?.limit ?? 100 });
    if (!execResult.ok) {
      return err(execResult.error);
    }

    const entries: AuditEntry[] = execResult.value.map((exec) => {
      const entry: AuditEntry = {
        id: exec.data.id,
        timestamp: exec.data.createdAt,
        action: exec.data.action.type,
        actor: exec.data.agentId,
        resource: `${exec.data.action.resourceType}${exec.data.action.resourceId ? ':' + exec.data.action.resourceId : ''}`,
        outcome: exec.data.status === 'completed' ? 'success' : exec.data.status === 'rejected' ? 'denied' : 'failure',
      };

      if (exec.data.error !== undefined) {
        return { ...entry, details: { error: exec.data.error } };
      }

      return entry;
    });

    return ok(entries);
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to events
   */
  on<T = unknown>(event: EventType, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);
  }

  /**
   * Unsubscribe from events
   */
  off<T = unknown>(event: EventType, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  /**
   * Emit an event
   */
  private async emit<T>(type: EventType, data: T): Promise<void> {
    const handlers = this.eventHandlers.get(type);
    if (!handlers) return;

    const event: SDKEvent<T> = {
      type,
      timestamp: createTimestamp(),
      data,
    };

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Event handler error for ${type}:`, error);
      }
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Build context dimensions from options
   */
  private buildContext(options?: ContextOptions): ContextDimensions {
    const context: ContextDimensions = {
      temporal: {
        start: options?.validFrom ?? createTimestamp(),
        end: options?.validUntil ?? null,
      },
    };

    if (options?.scope !== undefined) {
      (context as { scope?: Scope }).scope = options.scope;
    }
    if (options?.jurisdiction !== undefined) {
      (context as { jurisdiction?: Jurisdiction }).jurisdiction = options.jurisdiction;
    }
    if (options?.confidence !== undefined) {
      (context as { confidence?: number }).confidence = options.confidence;
    }

    return context;
  }

  /**
   * Get underlying storage (for advanced use cases)
   */
  getStorage(): StorageInterface {
    return this.storage;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<Result<{
    entities: number;
    claims: number;
    agents: number;
    decisions: number;
    policies: number;
  }, Error>> {
    const [agentStats, policyStats, dtgStats] = await Promise.all([
      this.agentRegistry.getStats(),
      this.policyLedger.getStats(),
      this.dtg.getStats(),
    ]);

    if (!agentStats.ok) return err(agentStats.error);
    if (!policyStats.ok) return err(policyStats.error);
    if (!dtgStats.ok) return err(dtgStats.error);

    // Count entities and claims from CKG (simplified)
    const entitiesResult = await this.storage.count('entities', {});
    const claimsResult = await this.storage.count('claims', {});

    return ok({
      entities: entitiesResult.ok ? entitiesResult.value : 0,
      claims: claimsResult.ok ? claimsResult.value : 0,
      agents: agentStats.value.total,
      decisions: dtgStats.value.total,
      policies: policyStats.value.total,
    });
  }
}
