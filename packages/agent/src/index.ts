/**
 * @contextgraph/agent
 *
 * Agent policy and problem-space graphs for ContextGraph OS.
 * Defines agent capabilities, constraints, and operational domains.
 */

export {
  type AgentId,
  type CapabilityId,
  type ProblemSpaceId,
  type AgentStatus,
  type CapabilityCategory,
  type ResourceConstraintType,
  type ResourceConstraint,
  type Capability,
  type AgentCapability,
  type ProblemSpaceNodeType,
  type ProblemSpaceNode,
  type ProblemSpace,
  type AgentProblemSpaceBinding,
  type AgentData,
  type AgentRecord,
  type CreateAgentInput,
  type GrantCapabilityInput,
  type CapabilityCheckContext,
  type CapabilityCheckResult,
  type CreateProblemSpaceInput,
  type CapabilityRegistryEntry,
} from './types.js';

export {
  Agent,
} from './agent.js';

export {
  CapabilityRegistry,
  BUILTIN_CAPABILITIES,
  initializeBuiltinCapabilities,
} from './capability.js';

export {
  ProblemSpaceManager,
} from './problem-space.js';

export {
  AgentRegistry,
  type AgentQueryOptions,
} from './registry.js';

export {
  AgentHierarchyManager,
  type Delegation,
  type DelegationRecord,
  type AgentHierarchyNode,
  type CascadeOperation,
  type CascadeResult,
  type DelegateCapabilityInput,
} from './hierarchy.js';
