/**
 * RBAC Types
 *
 * Type definitions for Role-Based Access Control.
 */

import type { Timestamp } from '@contextgraph/core';

/**
 * Built-in role names
 */
export type BuiltInRole = 'admin' | 'operator' | 'analyst' | 'agent' | 'auditor';

/**
 * Permission actions
 */
export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'revoke'
  | '*';

/**
 * Resource types
 */
export type ResourceType =
  | 'entity'
  | 'claim'
  | 'agent'
  | 'decision'
  | 'policy'
  | 'role'
  | 'audit'
  | 'provenance'
  | 'webhook'
  | '*';

/**
 * Permission definition
 */
export interface Permission {
  readonly action: PermissionAction;
  readonly resource: ResourceType;
  readonly resourceId?: string;
  readonly conditions?: readonly PermissionCondition[];
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  readonly field: string;
  readonly operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains';
  readonly value: unknown;
}

/**
 * Role status
 */
export type RoleStatus = 'active' | 'inactive';

/**
 * Role data
 */
export interface RoleData {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly permissions: readonly Permission[];
  readonly parentRoleId?: string;
  readonly isBuiltIn: boolean;
  readonly status: RoleStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Role assignment
 */
export interface RoleAssignment {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectType: 'user' | 'agent' | 'service';
  readonly roleId: string;
  readonly scope?: string;
  readonly expiresAt?: Timestamp;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
}

/**
 * Create role input
 */
export interface CreateRoleInput {
  readonly name: string;
  readonly description?: string;
  readonly permissions: readonly Permission[];
  readonly parentRoleId?: string;
}

/**
 * Update role input
 */
export interface UpdateRoleInput {
  readonly name?: string;
  readonly description?: string;
  readonly permissions?: readonly Permission[];
  readonly parentRoleId?: string;
  readonly status?: RoleStatus;
}

/**
 * Assign role input
 */
export interface AssignRoleInput {
  readonly subjectId: string;
  readonly subjectType: 'user' | 'agent' | 'service';
  readonly roleId: string;
  readonly scope?: string;
  readonly expiresAt?: Timestamp;
  readonly assignedBy: string;
}

/**
 * Permission check context
 */
export interface PermissionContext {
  readonly subjectId: string;
  readonly action: PermissionAction;
  readonly resource: ResourceType;
  readonly resourceId?: string;
  readonly scope?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly matchedRoles: readonly string[];
  readonly matchedPermissions: readonly Permission[];
}

/**
 * Role query options
 */
export interface RoleQueryOptions {
  readonly status?: RoleStatus;
  readonly isBuiltIn?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Assignment query options
 */
export interface AssignmentQueryOptions {
  readonly subjectId?: string;
  readonly roleId?: string;
  readonly subjectType?: 'user' | 'agent' | 'service';
  readonly includeExpired?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Built-in role definitions
 */
export const BUILT_IN_ROLES: readonly Omit<RoleData, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'admin',
    description: 'Full system access - can perform any action on any resource',
    permissions: [{ action: '*', resource: '*' }],
    isBuiltIn: true,
    status: 'active',
  },
  {
    name: 'operator',
    description: 'Manage agents and policies - operational control',
    permissions: [
      { action: '*', resource: 'agent' },
      { action: '*', resource: 'policy' },
      { action: 'read', resource: 'entity' },
      { action: 'read', resource: 'claim' },
      { action: 'read', resource: 'decision' },
      { action: 'approve', resource: 'decision' },
      { action: 'reject', resource: 'decision' },
      { action: 'read', resource: 'audit' },
    ],
    isBuiltIn: true,
    status: 'active',
  },
  {
    name: 'analyst',
    description: 'Read-only access for analysis and queries',
    permissions: [
      { action: 'read', resource: 'entity' },
      { action: 'read', resource: 'claim' },
      { action: 'read', resource: 'agent' },
      { action: 'read', resource: 'decision' },
      { action: 'read', resource: 'policy' },
      { action: 'read', resource: 'provenance' },
    ],
    isBuiltIn: true,
    status: 'active',
  },
  {
    name: 'agent',
    description: 'Execute actions only - for automated agents',
    permissions: [
      { action: 'execute', resource: 'agent' },
      { action: 'create', resource: 'entity' },
      { action: 'read', resource: 'entity' },
      { action: 'create', resource: 'claim' },
      { action: 'read', resource: 'claim' },
      { action: 'create', resource: 'decision' },
      { action: 'read', resource: 'policy' },
    ],
    isBuiltIn: true,
    status: 'active',
  },
  {
    name: 'auditor',
    description: 'Read audit trails and provenance - compliance role',
    permissions: [
      { action: 'read', resource: 'audit' },
      { action: 'read', resource: 'provenance' },
      { action: 'read', resource: 'decision' },
      { action: 'read', resource: 'policy' },
    ],
    isBuiltIn: true,
    status: 'active',
  },
];
