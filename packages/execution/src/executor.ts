/**
 * Executor
 *
 * Executes agent actions with policy enforcement and decision tracking.
 */

import {
  type Result,
  type DecisionId,
  type EntityId,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type { StorageInterface } from '@contextgraph/storage';
import { Agent, AgentRegistry, CapabilityRegistry } from '@contextgraph/agent';
import { PolicyLedger, type EvaluationContext } from '@contextgraph/policy';
import { DecisionTraceGraph } from '@contextgraph/dtg';
import { ProvenanceLedger } from '@contextgraph/provenance';
import type {
  ExecutionId,
  ExecutionRequest,
  ExecutionResult,
  ExecutionRecord,
  ActionHandler,
  ExecutionContext,
  ActionType,
  ExecutionQueryOptions,
  ApprovalRequest,
  RejectionRequest,
} from './types.js';
import { Execution } from './execution.js';

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  readonly storage: StorageInterface;
  readonly agentRegistry: AgentRegistry;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly policyLedger: PolicyLedger;
  readonly decisionGraph: DecisionTraceGraph;
  readonly provenanceLedger: ProvenanceLedger;
  readonly requireCapabilityCheck?: boolean;
  readonly requirePolicyCheck?: boolean;
}

/**
 * Executor
 *
 * Executes agent actions with full auditability.
 */
export class Executor {
  private readonly collection = 'executions';
  private readonly handlers = new Map<string, ActionHandler>();

  constructor(private readonly config: ExecutorConfig) {}

  /**
   * Register an action handler
   */
  registerHandler(actionType: ActionType, resourceType: string, handler: ActionHandler): void {
    const key = `${actionType}:${resourceType}`;
    this.handlers.set(key, handler);
  }

  /**
   * Execute an action
   */
  async execute(request: ExecutionRequest): Promise<Result<ExecutionResult, Error>> {
    // Create execution record
    const executionResult = Execution.create({
      agentId: request.agentId,
      action: request.action,
      ...(request.context?.id !== undefined ? { contextId: request.context.id } : {}),
      ...(request.requestedBy !== undefined ? { requestedBy: request.requestedBy } : {}),
      ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    });

    if (!executionResult.ok) {
      return err(executionResult.error);
    }

    let execution = executionResult.value;

    // Get the agent
    const agentResult = await this.config.agentRegistry.findById(request.agentId);
    if (!agentResult.ok) {
      return err(agentResult.error);
    }

    if (agentResult.value === null) {
      return err(new ValidationError(`Agent not found: ${request.agentId}`, 'agentId'));
    }

    const agent = agentResult.value;

    // Check if agent is active
    if (!agent.isActive()) {
      const rejectResult = execution.reject(`Agent is ${agent.data.status}`);
      if (rejectResult.ok) {
        await this.saveExecution(rejectResult.value);
      }
      return ok(this.createResult(rejectResult.ok ? rejectResult.value : execution));
    }

    // Check capabilities if required
    if (this.config.requireCapabilityCheck !== false) {
      const capCheck = agent.checkCapability(
        {
          action: request.action.type,
          resourceType: request.action.resourceType,
        },
        this.config.capabilityRegistry
      );

      if (!capCheck.allowed) {
        const rejectResult = execution.reject(capCheck.reason ?? 'Capability check failed');
        if (rejectResult.ok) {
          await this.saveExecution(rejectResult.value);
        }
        return ok(this.createResult(rejectResult.ok ? rejectResult.value : execution));
      }
    }

    // Evaluate policies if required
    if (this.config.requirePolicyCheck !== false) {
      const evalContext: EvaluationContext = {
        subject: {
          agentId: request.agentId,
          agentName: agent.data.name,
        },
        action: request.action.type,
        resource: {
          type: request.action.resourceType,
          id: request.action.resourceId,
        },
        environment: {
          ...(request.metadata ?? {}),
        },
      };

      const policyResult = await this.config.policyLedger.evaluate(evalContext);
      if (!policyResult.ok) {
        return err(policyResult.error);
      }

      const setResult = execution.setPolicyResult(policyResult.value);
      if (!setResult.ok) {
        return err(setResult.error);
      }
      execution = setResult.value;

      // Handle policy decision
      if (execution.isDenied()) {
        const rejectResult = execution.reject('Denied by policy');
        if (rejectResult.ok) {
          await this.saveExecution(rejectResult.value);
        }
        return ok(this.createResult(rejectResult.ok ? rejectResult.value : execution));
      }

      // If approval is required, save and return
      if (execution.requiresApproval()) {
        await this.saveExecution(execution);
        return ok(this.createResult(execution));
      }
    }

    // Execute the action
    return this.executeAction(execution, agent, request);
  }

  /**
   * Approve a pending execution
   */
  async approve(request: ApprovalRequest): Promise<Result<ExecutionResult, Error>> {
    const executionResult = await this.findById(request.executionId);
    if (!executionResult.ok) {
      return err(executionResult.error);
    }

    if (executionResult.value === null) {
      return err(new ValidationError(`Execution not found: ${request.executionId}`, 'executionId'));
    }

    let execution = executionResult.value;

    // Approve the execution
    const approveResult = execution.approve(request.approverId);
    if (!approveResult.ok) {
      return err(approveResult.error);
    }
    execution = approveResult.value;

    // Get the agent
    const agentResult = await this.config.agentRegistry.findById(execution.data.agentId);
    if (!agentResult.ok) {
      return err(agentResult.error);
    }

    if (agentResult.value === null) {
      return err(new ValidationError(`Agent not found: ${execution.data.agentId}`, 'agentId'));
    }

    // Execute the action
    return this.executeAction(execution, agentResult.value, {
      agentId: execution.data.agentId,
      action: execution.data.action,
    });
  }

  /**
   * Reject a pending execution
   */
  async reject(request: RejectionRequest): Promise<Result<ExecutionResult, Error>> {
    const executionResult = await this.findById(request.executionId);
    if (!executionResult.ok) {
      return err(executionResult.error);
    }

    if (executionResult.value === null) {
      return err(new ValidationError(`Execution not found: ${request.executionId}`, 'executionId'));
    }

    const execution = executionResult.value;
    const rejectResult = execution.reject(request.reason);
    if (!rejectResult.ok) {
      return err(rejectResult.error);
    }

    await this.saveExecution(rejectResult.value);
    return ok(this.createResult(rejectResult.value));
  }

  /**
   * Cancel a pending execution
   */
  async cancel(executionId: ExecutionId): Promise<Result<ExecutionResult, Error>> {
    const executionResult = await this.findById(executionId);
    if (!executionResult.ok) {
      return err(executionResult.error);
    }

    if (executionResult.value === null) {
      return err(new ValidationError(`Execution not found: ${executionId}`, 'executionId'));
    }

    const execution = executionResult.value;
    const cancelResult = execution.cancel();
    if (!cancelResult.ok) {
      return err(cancelResult.error);
    }

    await this.saveExecution(cancelResult.value);
    return ok(this.createResult(cancelResult.value));
  }

  /**
   * Get execution by ID
   */
  async findById(id: ExecutionId): Promise<Result<Execution | null, Error>> {
    const result = await this.config.storage.findById<ExecutionRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(Execution.fromRecord(result.value));
  }

  /**
   * Query executions
   */
  async query(options: ExecutionQueryOptions): Promise<Result<readonly Execution[], Error>> {
    const criteria: Record<string, unknown> = {};

    if (options.agentId !== undefined) {
      criteria['agentId'] = options.agentId;
    }

    if (options.status !== undefined) {
      criteria['status'] = options.status;
    }

    const queryOptions: { limit?: number; offset?: number } = {};
    if (options.limit !== undefined) {
      queryOptions.limit = options.limit;
    }
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.config.storage.find<ExecutionRecord>(this.collection, criteria, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record: ExecutionRecord) => Execution.fromRecord(record)));
  }

  /**
   * Execute an action
   */
  private async executeAction(
    execution: Execution,
    agent: Agent,
    request: ExecutionRequest
  ): Promise<Result<ExecutionResult, Error>> {
    // Record provenance
    const provResult = await this.config.provenanceLedger.record({
      sourceType: 'agent',
      sourceId: agent.data.id,
      action: 'execute',
      metadata: {
        executionId: execution.data.id,
        actionType: request.action.type,
        resourceType: request.action.resourceType,
      },
    });

    // Create decision in DTG
    let decisionId: DecisionId | undefined;
    if (provResult.ok) {
      const decisionResult = await this.config.decisionGraph.recordDecision({
        type: 'external_action',
        title: `Execute ${request.action.type} on ${request.action.resourceType}`,
        proposedBy: agent.data.id as unknown as EntityId,
        ...(request.action.description !== undefined ? { description: request.action.description } : {}),
      });

      if (decisionResult.ok) {
        decisionId = decisionResult.value.data.id;
      }
    }

    // Start execution
    const startResult = execution.start(decisionId);
    if (!startResult.ok) {
      return err(startResult.error);
    }
    execution = startResult.value;

    // Find handler
    const handlerKey = `${request.action.type}:${request.action.resourceType}`;
    const handler = this.handlers.get(handlerKey) ?? this.handlers.get(`${request.action.type}:*`);

    if (handler === undefined) {
      // No handler, complete with no output
      const completeResult = execution.complete();
      if (!completeResult.ok) {
        return err(completeResult.error);
      }
      await this.saveExecution(completeResult.value);

      // Update decision status
      if (decisionId !== undefined) {
        await this.config.decisionGraph.executeDecision(decisionId, undefined);
      }

      return ok(this.createResult(completeResult.value));
    }

    // Execute handler
    const context: ExecutionContext = {
      executionId: execution.data.id,
      agentId: execution.data.agentId,
      ...(request.context !== undefined ? { assembledContext: request.context } : {}),
      ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    };

    try {
      const handlerResult = await handler(request.action, context);

      if (handlerResult.ok) {
        const completeResult = execution.complete(handlerResult.value);
        if (!completeResult.ok) {
          return err(completeResult.error);
        }
        await this.saveExecution(completeResult.value);

        // Update decision status
        if (decisionId !== undefined) {
          const outcome = handlerResult.value !== undefined && typeof handlerResult.value === 'object'
            ? handlerResult.value as Record<string, unknown>
            : undefined;
          await this.config.decisionGraph.executeDecision(decisionId, outcome);
        }

        return ok(this.createResult(completeResult.value));
      } else {
        const failResult = execution.fail(handlerResult.error.message);
        if (!failResult.ok) {
          return err(failResult.error);
        }
        await this.saveExecution(failResult.value);

        // Note: DTG doesn't have a direct fail method, decision stays in executed state
        // The failure is tracked in the execution record itself

        return ok(this.createResult(failResult.value));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failResult = execution.fail(errorMessage);
      if (!failResult.ok) {
        return err(failResult.error);
      }
      await this.saveExecution(failResult.value);

      return ok(this.createResult(failResult.value));
    }
  }

  /**
   * Save execution to storage
   */
  private async saveExecution(execution: Execution): Promise<Result<void, Error>> {
    const result = await this.config.storage.insert(this.collection, execution.toRecord());
    if (!result.ok) {
      return err(result.error);
    }
    return ok(undefined);
  }

  /**
   * Create execution result from execution
   */
  private createResult(execution: Execution): ExecutionResult {
    const durationMs = execution.getDurationMs();
    return {
      executionId: execution.data.id,
      status: execution.data.status,
      ...(execution.data.output !== undefined ? { output: execution.data.output } : {}),
      ...(execution.data.error !== undefined ? { error: execution.data.error } : {}),
      ...(execution.data.decisionId !== undefined ? { decisionId: execution.data.decisionId } : {}),
      ...(execution.data.policyResult !== undefined ? { policyResult: execution.data.policyResult } : {}),
      startedAt: execution.data.startedAt ?? execution.data.createdAt,
      ...(execution.data.completedAt !== undefined ? { completedAt: execution.data.completedAt } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
  }
}
