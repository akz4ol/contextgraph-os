/**
 * Permission Checker
 *
 * Evaluates permissions based on role assignments.
 */

import { ok, err } from '@contextgraph/core';
import type { Result } from '@contextgraph/core';
import type {
  Permission,
  PermissionAction,
  ResourceType,
  PermissionContext,
  PermissionCheckResult,
  PermissionCondition,
} from './types.js';
import { RoleManager } from './roles.js';
import { AssignmentManager } from './assignments.js';

/**
 * Permission Checker class
 */
export class PermissionChecker {
  private readonly roleManager: RoleManager;
  private readonly assignmentManager: AssignmentManager;

  constructor(roleManager: RoleManager, assignmentManager: AssignmentManager) {
    this.roleManager = roleManager;
    this.assignmentManager = assignmentManager;
  }

  /**
   * Check if a subject has permission to perform an action
   */
  async hasPermission(context: PermissionContext): Promise<Result<PermissionCheckResult, Error>> {
    // Get all roles assigned to the subject
    const rolesResult = await this.assignmentManager.getRoles(context.subjectId);
    if (!rolesResult.ok) {
      return err(rolesResult.error);
    }

    const matchedRoles: string[] = [];
    const matchedPermissions: Permission[] = [];

    // Check each assigned role
    for (const assignment of rolesResult.value) {
      // Check scope if specified
      if (context.scope !== undefined && assignment.scope !== undefined && assignment.scope !== context.scope) {
        continue;
      }

      // Get effective permissions for this role (including inherited)
      const permsResult = await this.roleManager.getEffectivePermissions(assignment.roleId);
      if (!permsResult.ok) {
        continue;
      }

      // Check each permission
      for (const perm of permsResult.value) {
        if (this.matchesPermission(perm, context)) {
          matchedRoles.push(assignment.roleId);
          matchedPermissions.push(perm);
        }
      }
    }

    const allowed = matchedPermissions.length > 0;

    return ok({
      allowed,
      reason: allowed
        ? `Allowed by ${matchedRoles.length} role(s)`
        : 'No matching permissions found',
      matchedRoles: [...new Set(matchedRoles)], // Deduplicate
      matchedPermissions,
    });
  }

  /**
   * Check if a permission matches the context
   */
  private matchesPermission(permission: Permission, context: PermissionContext): boolean {
    // Check action
    if (!this.matchesAction(permission.action, context.action)) {
      return false;
    }

    // Check resource type
    if (!this.matchesResource(permission.resource, context.resource)) {
      return false;
    }

    // Check resource ID if specified
    if (permission.resourceId !== undefined && context.resourceId !== undefined) {
      if (permission.resourceId !== context.resourceId && permission.resourceId !== '*') {
        return false;
      }
    }

    // Check conditions if specified
    if (permission.conditions !== undefined && permission.conditions.length > 0) {
      if (!this.matchesConditions(permission.conditions, context.attributes ?? {})) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if an action matches
   */
  private matchesAction(permAction: PermissionAction, contextAction: PermissionAction): boolean {
    return permAction === '*' || permAction === contextAction;
  }

  /**
   * Check if a resource matches
   */
  private matchesResource(permResource: ResourceType, contextResource: ResourceType): boolean {
    return permResource === '*' || permResource === contextResource;
  }

  /**
   * Check if conditions match
   */
  private matchesConditions(
    conditions: readonly PermissionCondition[],
    attributes: Readonly<Record<string, unknown>>
  ): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(attributes, condition.field);

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'not_equals':
          if (value === condition.value) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
        case 'not_in':
          if (Array.isArray(condition.value) && condition.value.includes(value)) return false;
          break;
        case 'contains':
          if (typeof value !== 'string' || !value.includes(String(condition.value))) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: Readonly<Record<string, unknown>>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Get all permissions for a subject
   */
  async getPermissions(subjectId: string): Promise<Result<readonly Permission[], Error>> {
    const rolesResult = await this.assignmentManager.getRoles(subjectId);
    if (!rolesResult.ok) {
      return err(rolesResult.error);
    }

    const allPermissions: Permission[] = [];

    for (const assignment of rolesResult.value) {
      const permsResult = await this.roleManager.getEffectivePermissions(assignment.roleId);
      if (permsResult.ok) {
        allPermissions.push(...permsResult.value);
      }
    }

    return ok(allPermissions);
  }

  /**
   * Check multiple permissions at once
   */
  async hasAllPermissions(
    subjectId: string,
    contexts: readonly Omit<PermissionContext, 'subjectId'>[]
  ): Promise<Result<boolean, Error>> {
    for (const ctx of contexts) {
      const result = await this.hasPermission({ ...ctx, subjectId });
      if (!result.ok) {
        return err(result.error);
      }
      if (!result.value.allowed) {
        return ok(false);
      }
    }

    return ok(true);
  }

  /**
   * Check if subject has any of the permissions
   */
  async hasAnyPermission(
    subjectId: string,
    contexts: readonly Omit<PermissionContext, 'subjectId'>[]
  ): Promise<Result<boolean, Error>> {
    for (const ctx of contexts) {
      const result = await this.hasPermission({ ...ctx, subjectId });
      if (!result.ok) {
        return err(result.error);
      }
      if (result.value.allowed) {
        return ok(true);
      }
    }

    return ok(false);
  }
}
