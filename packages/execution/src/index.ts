/**
 * @contextgraph/execution
 *
 * Agent execution framework with policy enforcement and decision tracking.
 */

// Types
export type {
  ExecutionId,
  ActionType,
  ExecutionStatus,
  ActionDefinition,
  ExecutionRequest,
  ExecutionResult,
  ExecutionData,
  ExecutionRecord,
  ActionHandler,
  ExecutionContext,
  ExecutionQueryOptions,
  ApprovalRequest,
  RejectionRequest,
} from './types.js';

// Execution model
export { Execution } from './execution.js';

// Executor
export { Executor, type ExecutorConfig } from './executor.js';
