/**
 * @contextgraph/exceptions
 *
 * Exception and override management for ContextGraph OS.
 * Provides controlled policy deviation with approval workflows.
 */

export {
  type ExceptionStatus,
  type ExceptionRiskLevel,
  type PolicyReference,
  type ApprovalRequirement,
  type ApproverRecord,
  type ExceptionData,
  type ExceptionRecord,
  type CreateExceptionInput,
  type ExceptionQueryOptions,
  APPROVAL_REQUIREMENTS,
} from './types.js';

export {
  Exception,
} from './exception.js';

export {
  ExceptionManager,
} from './manager.js';
