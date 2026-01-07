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
  ExportOptions,
  GraphExport,
  EntityExport,
  ClaimExport,
  AgentExport,
  DecisionExport,
  PolicyExport,
  ProvenanceExport,
  ImportOptions,
  ImportResult,
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

  // ============================================================================
  // Import/Export Operations
  // ============================================================================

  /**
   * Export the entire graph to JSON format
   */
  async exportToJSON(options: ExportOptions = {}): Promise<Result<GraphExport, Error>> {
    const includeAll = options.includeEntities === undefined &&
      options.includeClaims === undefined &&
      options.includeAgents === undefined &&
      options.includeDecisions === undefined &&
      options.includePolicies === undefined &&
      options.includeProvenance === undefined;

    const includeEntities = options.includeEntities ?? includeAll;
    const includeClaims = options.includeClaims ?? includeAll;
    const includeAgents = options.includeAgents ?? includeAll;
    const includeDecisions = options.includeDecisions ?? includeAll;
    const includePolicies = options.includePolicies ?? includeAll;
    const includeProvenance = options.includeProvenance ?? includeAll;

    const entities: EntityExport[] = [];
    const claims: ClaimExport[] = [];
    const agents: AgentExport[] = [];
    const decisions: DecisionExport[] = [];
    const policies: PolicyExport[] = [];
    const provenance: ProvenanceExport[] = [];

    // Export entities
    if (includeEntities) {
      const entitiesResult = await this.storage.find<{
        id: string;
        type: string;
        name?: string;
        properties: Record<string, unknown>;
        aliases?: readonly string[];
        createdAt: Timestamp;
      }>('entities', {}, { limit: 10000 });
      if (entitiesResult.ok) {
        for (const entity of entitiesResult.value.items) {
          if (options.since !== undefined && entity.createdAt < options.since) continue;
          const exportEntity: EntityExport = {
            id: entity.id,
            type: entity.type,
            name: entity.name ?? '',
            properties: entity.properties,
            createdAt: entity.createdAt,
          };
          if (entity.aliases !== undefined) {
            (exportEntity as { aliases?: readonly string[] }).aliases = entity.aliases;
          }
          entities.push(exportEntity);
        }
      }
    }

    // Export claims
    if (includeClaims) {
      const claimsResult = await this.storage.find<{
        id: string;
        subjectId: string;
        predicate: string;
        value: unknown;
        objectId?: string;
        context?: Record<string, unknown>;
        provenanceId: string;
        createdAt: Timestamp;
      }>('claims', {}, { limit: 10000 });
      if (claimsResult.ok) {
        for (const claim of claimsResult.value.items) {
          if (options.since !== undefined && claim.createdAt < options.since) continue;
          const exportClaim: ClaimExport = {
            id: claim.id,
            subjectId: claim.subjectId,
            predicate: claim.predicate,
            value: claim.value,
            provenanceId: claim.provenanceId,
            createdAt: claim.createdAt,
          };
          if (claim.objectId !== undefined) {
            (exportClaim as { objectId?: string }).objectId = claim.objectId;
          }
          if (claim.context !== undefined) {
            (exportClaim as { context?: Record<string, unknown> }).context = claim.context;
          }
          claims.push(exportClaim);
        }
      }
    }

    // Export agents
    if (includeAgents) {
      const agentsResult = await this.agentRegistry.query({ limit: 10000 });
      if (agentsResult.ok) {
        for (const agent of agentsResult.value) {
          if (options.since !== undefined && agent.data.createdAt < options.since) continue;
          const exportAgent: AgentExport = {
            id: agent.data.id,
            name: agent.data.name,
            status: agent.data.status,
            createdAt: agent.data.createdAt,
          };
          if (agent.data.description !== undefined) {
            (exportAgent as { description?: string }).description = agent.data.description;
          }
          if (agent.data.parentAgentId !== undefined) {
            (exportAgent as { parentAgentId?: string }).parentAgentId = agent.data.parentAgentId;
          }
          if (agent.data.metadata !== undefined) {
            (exportAgent as { metadata?: Readonly<Record<string, unknown>> }).metadata = agent.data.metadata;
          }
          agents.push(exportAgent);
        }
      }
    }

    // Export decisions
    if (includeDecisions) {
      const decisionsResult = await this.dtg.queryDecisions({ limit: 10000 });
      if (decisionsResult.ok) {
        for (const decision of decisionsResult.value) {
          if (options.since !== undefined && decision.data.createdAt < options.since) continue;
          const exportDecision: DecisionExport = {
            id: decision.data.id,
            type: decision.data.type,
            title: decision.data.title,
            status: decision.data.status,
            proposedBy: decision.data.proposedBy,
            createdAt: decision.data.createdAt,
          };
          if (decision.data.description !== undefined) {
            (exportDecision as { description?: string }).description = decision.data.description;
          }
          if (decision.data.riskLevel !== undefined) {
            (exportDecision as { riskLevel?: string }).riskLevel = decision.data.riskLevel;
          }
          decisions.push(exportDecision);
        }
      }
    }

    // Export policies
    if (includePolicies) {
      const policiesResult = await this.getEffectivePolicies();
      if (policiesResult.ok) {
        for (const policy of policiesResult.value) {
          if (options.since !== undefined && policy.data.createdAt < options.since) continue;
          // Extract effect from first rule if available
          const firstRule = policy.data.rules[0];
          const exportPolicy: PolicyExport = {
            id: policy.data.id,
            name: policy.data.name,
            version: policy.data.version,
            effect: firstRule?.effect ?? 'deny',
            subjects: [],
            actions: [],
            resources: [],
            priority: policy.data.priority,
            status: policy.data.status,
            createdAt: policy.data.createdAt,
          };
          if (policy.data.description !== undefined) {
            (exportPolicy as { description?: string }).description = policy.data.description;
          }
          if (firstRule?.conditions !== undefined && firstRule.conditions.length > 0) {
            (exportPolicy as { conditions?: readonly { field: string; operator: string; value: unknown }[] }).conditions =
              firstRule.conditions.map(c => ({
                field: c.field,
                operator: c.operator,
                value: c.value,
              }));
          }
          policies.push(exportPolicy);
        }
      }
    }

    // Export provenance
    if (includeProvenance) {
      const provenanceResult = await this.queryProvenance({ limit: 10000 });
      if (provenanceResult.ok) {
        for (const entry of provenanceResult.value) {
          if (options.since !== undefined && entry.data.timestamp < options.since) continue;
          const exportProvenance: ProvenanceExport = {
            id: entry.data.id,
            sourceType: entry.data.sourceType,
            sourceId: entry.data.sourceId ?? '',
            action: entry.data.action,
            timestamp: entry.data.timestamp,
            hash: entry.data.hash,
          };
          if (entry.data.previousHash !== undefined) {
            (exportProvenance as { previousHash?: string }).previousHash = entry.data.previousHash;
          }
          provenance.push(exportProvenance);
        }
      }
    }

    const exportData: GraphExport = {
      version: '1.0.0',
      exportedAt: createTimestamp(),
      entities,
      claims,
      agents,
      decisions,
      policies,
      provenance,
    };

    return ok(exportData);
  }

  /**
   * Export to JSON string
   */
  async exportToJSONString(options: ExportOptions = {}): Promise<Result<string, Error>> {
    const exportResult = await this.exportToJSON(options);
    if (!exportResult.ok) {
      return err(exportResult.error);
    }
    const indent = options.prettyPrint ? 2 : undefined;
    return ok(JSON.stringify(exportResult.value, null, indent));
  }

  /**
   * Import from JSON format
   */
  async importFromJSON(data: GraphExport, options: ImportOptions = {}): Promise<Result<ImportResult, Error>> {
    const errors: string[] = [];
    let entitiesImported = 0;
    let claimsImported = 0;
    let agentsImported = 0;
    let decisionsImported = 0;
    let policiesImported = 0;
    let skipped = 0;

    const onConflict = options.onConflict ?? 'skip';
    const dryRun = options.dryRun ?? false;

    // Validate version
    if (!options.skipValidation && data.version !== '1.0.0') {
      errors.push(`Unsupported export version: ${data.version}`);
    }

    // Import entities
    for (const entity of data.entities) {
      if (!options.skipValidation) {
        if (!entity.id || !entity.type || !entity.name) {
          errors.push(`Invalid entity: missing required fields`);
          continue;
        }
      }

      if (dryRun) {
        entitiesImported++;
        continue;
      }

      // Check for existing entity
      const existing = await this.getEntity(entity.id as EntityId);
      if (existing.ok && existing.value !== null) {
        if (onConflict === 'skip') {
          skipped++;
          continue;
        } else if (onConflict === 'error') {
          errors.push(`Entity already exists: ${entity.id}`);
          continue;
        }
        // 'overwrite' - continue with insert (upsert)
      }

      const result = await this.storage.upsert('entities', {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        properties: entity.properties ?? {},
        aliases: entity.aliases ?? [],
        createdAt: entity.createdAt,
      });

      if (result.ok) {
        entitiesImported++;
      } else {
        errors.push(`Failed to import entity ${entity.id}: ${result.error.message}`);
      }
    }

    // Import agents
    for (const agent of data.agents) {
      if (!options.skipValidation) {
        if (!agent.id || !agent.name) {
          errors.push(`Invalid agent: missing required fields`);
          continue;
        }
      }

      if (dryRun) {
        agentsImported++;
        continue;
      }

      const existing = await this.getAgent(agent.id);
      if (existing.ok && existing.value !== null) {
        if (onConflict === 'skip') {
          skipped++;
          continue;
        } else if (onConflict === 'error') {
          errors.push(`Agent already exists: ${agent.id}`);
          continue;
        }
      }

      const result = await this.storage.upsert('agents', {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        description: agent.description,
        parentAgentId: agent.parentAgentId,
        metadata: agent.metadata ?? {},
        capabilities: [],
        problemSpaceBindings: [],
        policyIds: [],
        createdAt: agent.createdAt,
        updatedAt: agent.createdAt,
      });

      if (result.ok) {
        agentsImported++;
      } else {
        errors.push(`Failed to import agent ${agent.id}: ${result.error.message}`);
      }
    }

    // Import claims (after entities to ensure subjects exist)
    for (const claim of data.claims) {
      if (!options.skipValidation) {
        if (!claim.id || !claim.subjectId || !claim.predicate) {
          errors.push(`Invalid claim: missing required fields`);
          continue;
        }
      }

      if (dryRun) {
        claimsImported++;
        continue;
      }

      const result = await this.storage.upsert('claims', {
        id: claim.id,
        subjectId: claim.subjectId,
        predicate: claim.predicate,
        value: claim.value,
        objectId: claim.objectId,
        context: claim.context ?? {},
        provenanceId: claim.provenanceId,
        status: 'active',
        createdAt: claim.createdAt,
      });

      if (result.ok) {
        claimsImported++;
      } else {
        errors.push(`Failed to import claim ${claim.id}: ${result.error.message}`);
      }
    }

    // Import policies
    for (const policy of data.policies) {
      if (!options.skipValidation) {
        if (!policy.id || !policy.name || !policy.effect) {
          errors.push(`Invalid policy: missing required fields`);
          continue;
        }
      }

      if (dryRun) {
        policiesImported++;
        continue;
      }

      const result = await this.storage.upsert('policies', {
        id: policy.id,
        name: policy.name,
        version: policy.version,
        description: policy.description,
        effect: policy.effect,
        subjects: policy.subjects,
        actions: policy.actions,
        resources: policy.resources,
        conditions: policy.conditions ?? [],
        priority: policy.priority,
        status: policy.status,
        createdAt: policy.createdAt,
      });

      if (result.ok) {
        policiesImported++;
      } else {
        errors.push(`Failed to import policy ${policy.id}: ${result.error.message}`);
      }
    }

    // Note: Decisions and provenance are typically not imported to maintain integrity
    // But we can import decisions if explicitly included
    for (const decision of data.decisions) {
      if (dryRun) {
        decisionsImported++;
        continue;
      }

      const result = await this.storage.upsert('decisions', {
        id: decision.id,
        type: decision.type,
        title: decision.title,
        description: decision.description,
        status: decision.status,
        proposedBy: decision.proposedBy,
        riskLevel: decision.riskLevel,
        createdAt: decision.createdAt,
      });

      if (result.ok) {
        decisionsImported++;
      } else {
        errors.push(`Failed to import decision ${decision.id}: ${result.error.message}`);
      }
    }

    return ok({
      success: errors.length === 0,
      entitiesImported,
      claimsImported,
      agentsImported,
      decisionsImported,
      policiesImported,
      skipped,
      errors,
    });
  }

  /**
   * Import from JSON string
   */
  async importFromJSONString(jsonString: string, options: ImportOptions = {}): Promise<Result<ImportResult, Error>> {
    try {
      const data = JSON.parse(jsonString) as GraphExport;
      return this.importFromJSON(data, options);
    } catch (error) {
      return err(new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Export entities to CSV format
   */
  async exportEntitiesToCSV(): Promise<Result<string, Error>> {
    const entitiesResult = await this.storage.find<{
      id: string;
      type: string;
      name?: string;
      properties: Record<string, unknown>;
      createdAt: Timestamp;
    }>('entities', {}, { limit: 10000 });
    if (!entitiesResult.ok) {
      return err(entitiesResult.error);
    }

    const headers = ['id', 'type', 'name', 'properties', 'createdAt'];
    const rows = [headers.join(',')];

    for (const entity of entitiesResult.value.items) {
      const row = [
        this.escapeCSV(entity.id),
        this.escapeCSV(entity.type),
        this.escapeCSV(entity.name ?? ''),
        this.escapeCSV(JSON.stringify(entity.properties ?? {})),
        this.escapeCSV(String(entity.createdAt)),
      ];
      rows.push(row.join(','));
    }

    return ok(rows.join('\n'));
  }

  /**
   * Export claims to CSV format
   */
  async exportClaimsToCSV(): Promise<Result<string, Error>> {
    const claimsResult = await this.storage.find<{
      id: string;
      subjectId: string;
      predicate: string;
      value: unknown;
      objectId?: string;
      provenanceId?: string;
      createdAt: Timestamp;
    }>('claims', {}, { limit: 10000 });

    if (!claimsResult.ok) {
      return err(claimsResult.error);
    }

    const headers = ['id', 'subjectId', 'predicate', 'value', 'objectId', 'provenanceId', 'createdAt'];
    const rows = [headers.join(',')];

    for (const claim of claimsResult.value.items) {
      const row = [
        this.escapeCSV(claim.id),
        this.escapeCSV(claim.subjectId),
        this.escapeCSV(claim.predicate),
        this.escapeCSV(typeof claim.value === 'string' ? claim.value : JSON.stringify(claim.value)),
        this.escapeCSV(claim.objectId),
        this.escapeCSV(claim.provenanceId),
        this.escapeCSV(String(claim.createdAt)),
      ];
      rows.push(row.join(','));
    }

    return ok(rows.join('\n'));
  }

  /**
   * Import entities from CSV format
   */
  async importEntitiesFromCSV(csv: string, options: ImportOptions = {}): Promise<Result<ImportResult, Error>> {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      return err(new Error('CSV must have at least a header row and one data row'));
    }

    const headers = this.parseCSVLine(lines[0]!);
    const requiredHeaders = ['type', 'name'];
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        return err(new Error(`Missing required header: ${required}`));
      }
    }

    let entitiesImported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]!);
      const record: Record<string, unknown> = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]!] = values[j] ?? '';
      }

      if (!record['type'] || !record['name']) {
        errors.push(`Row ${i + 1}: missing required fields`);
        continue;
      }

      if (options.dryRun) {
        entitiesImported++;
        continue;
      }

      // Parse properties if provided
      let properties: Record<string, unknown> = {};
      if (record['properties'] && typeof record['properties'] === 'string' && record['properties'].trim()) {
        try {
          properties = JSON.parse(record['properties'] as string);
        } catch {
          // Ignore parse errors, use empty properties
        }
      }

      const createInput: CreateEntityInput = {
        type: record['type'] as string,
        name: record['name'] as string,
        properties,
      };
      const result = await this.createEntity(createInput);

      if (result.ok) {
        entitiesImported++;
      } else {
        errors.push(`Row ${i + 1}: ${result.error.message}`);
      }
    }

    return ok({
      success: errors.length === 0,
      entitiesImported,
      claimsImported: 0,
      agentsImported: 0,
      decisionsImported: 0,
      policiesImported: 0,
      skipped,
      errors,
    });
  }

  /**
   * Import claims from CSV format
   */
  async importClaimsFromCSV(csv: string, options: ImportOptions = {}): Promise<Result<ImportResult, Error>> {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      return err(new Error('CSV must have at least a header row and one data row'));
    }

    const headers = this.parseCSVLine(lines[0]!);
    const requiredHeaders = ['subjectId', 'predicate', 'value'];
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        return err(new Error(`Missing required header: ${required}`));
      }
    }

    let claimsImported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]!);
      const record: Record<string, unknown> = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]!] = values[j] ?? '';
      }

      if (!record['subjectId'] || !record['predicate']) {
        errors.push(`Row ${i + 1}: missing required fields`);
        continue;
      }

      if (options.dryRun) {
        claimsImported++;
        continue;
      }

      // Try to parse value as JSON, otherwise use as string
      let value: unknown = record['value'];
      if (typeof value === 'string' && value.trim()) {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
      }

      const claimInput: CreateClaimInput = {
        subjectId: record['subjectId'] as EntityId,
        predicate: record['predicate'] as string,
        value,
      };
      if (record['objectId'] && typeof record['objectId'] === 'string' && record['objectId'].trim()) {
        (claimInput as { objectId?: EntityId }).objectId = record['objectId'] as EntityId;
      }
      const result = await this.addClaim(claimInput);

      if (result.ok) {
        claimsImported++;
      } else {
        errors.push(`Row ${i + 1}: ${result.error.message}`);
      }
    }

    return ok({
      success: errors.length === 0,
      entitiesImported: 0,
      claimsImported,
      agentsImported: 0,
      decisionsImported: 0,
      policiesImported: 0,
      skipped,
      errors,
    });
  }

  /**
   * Escape a value for CSV
   */
  private escapeCSV(value: string | undefined | null): string {
    const str = value ?? '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Parse a CSV line into values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    values.push(current);

    return values;
  }
}
