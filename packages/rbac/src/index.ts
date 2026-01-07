/**
 * @contextgraph/rbac
 *
 * Role-Based Access Control for ContextGraph OS.
 * Provides role management, assignment handling, and permission checking.
 */

// Types
export type {
  BuiltInRole,
  PermissionAction,
  ResourceType,
  Permission,
  PermissionCondition,
  RoleStatus,
  RoleData,
  RoleAssignment,
  CreateRoleInput,
  UpdateRoleInput,
  AssignRoleInput,
  PermissionContext,
  PermissionCheckResult,
  RoleQueryOptions,
  AssignmentQueryOptions,
} from './types.js';

export { BUILT_IN_ROLES } from './types.js';

// Role Management
export { RoleManager } from './roles.js';

// Assignment Management
export { AssignmentManager } from './assignments.js';

// Permission Checking
export { PermissionChecker } from './permissions.js';
