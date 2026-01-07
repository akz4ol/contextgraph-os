/**
 * RBAC Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import { createTimestamp } from '@contextgraph/core';
import type { Timestamp } from '@contextgraph/core';
import {
  RoleManager,
  AssignmentManager,
  PermissionChecker,
  BUILT_IN_ROLES,
} from './index.js';
import type {
  Permission,
  CreateRoleInput,
  AssignRoleInput,
  PermissionContext,
} from './index.js';

describe('RoleManager', () => {
  let storage: InMemoryStorage;
  let roleManager: RoleManager;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    roleManager = new RoleManager(storage);
    await roleManager.initialize(BUILT_IN_ROLES);
  });

  describe('initialize', () => {
    it('should create built-in roles', async () => {
      const result = await roleManager.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(5);
        const names = result.value.map((r) => r.name);
        expect(names).toContain('admin');
        expect(names).toContain('operator');
        expect(names).toContain('analyst');
        expect(names).toContain('agent');
        expect(names).toContain('auditor');
      }
    });

    it('should not duplicate built-in roles on re-initialize', async () => {
      await roleManager.initialize(BUILT_IN_ROLES);
      const result = await roleManager.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(5);
      }
    });
  });

  describe('get', () => {
    it('should get admin role by ID', async () => {
      const result = await roleManager.get('role_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        expect(result.value!.name).toBe('admin');
        expect(result.value!.isBuiltIn).toBe(true);
      }
    });

    it('should return null for non-existent role', async () => {
      const result = await roleManager.get('role_nonexistent');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('getByName', () => {
    it('should get role by name', async () => {
      const result = await roleManager.getByName('operator');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        expect(result.value!.id).toBe('role_operator');
      }
    });
  });

  describe('create', () => {
    it('should create a custom role', async () => {
      const input: CreateRoleInput = {
        name: 'custom_role',
        description: 'A custom role for testing',
        permissions: [
          { action: 'read', resource: 'entity' },
          { action: 'create', resource: 'claim' },
        ],
      };

      const result = await roleManager.create(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('custom_role');
        expect(result.value.isBuiltIn).toBe(false);
        expect(result.value.status).toBe('active');
        expect(result.value.permissions.length).toBe(2);
      }
    });

    it('should reject duplicate role names', async () => {
      const input: CreateRoleInput = {
        name: 'admin',
        permissions: [],
      };

      const result = await roleManager.create(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already exists');
      }
    });

    it('should create role with parent', async () => {
      const input: CreateRoleInput = {
        name: 'super_analyst',
        permissions: [{ action: 'create', resource: 'entity' }],
        parentRoleId: 'role_analyst',
      };

      const result = await roleManager.create(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.parentRoleId).toBe('role_analyst');
      }
    });

    it('should reject non-existent parent role', async () => {
      const input: CreateRoleInput = {
        name: 'orphan_role',
        permissions: [],
        parentRoleId: 'role_nonexistent',
      };

      const result = await roleManager.create(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Parent role not found');
      }
    });
  });

  describe('update', () => {
    it('should update custom role', async () => {
      // Create a custom role first
      await roleManager.create({
        name: 'updatable_role',
        permissions: [{ action: 'read', resource: 'entity' }],
      });

      const role = await roleManager.getByName('updatable_role');
      expect(role.ok && role.value).toBeTruthy();

      const result = await roleManager.update(role.ok ? role.value!.id : '', {
        description: 'Updated description',
        permissions: [
          { action: 'read', resource: 'entity' },
          { action: 'update', resource: 'entity' },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBe('Updated description');
        expect(result.value.permissions.length).toBe(2);
      }
    });

    it('should not modify built-in role properties', async () => {
      const result = await roleManager.update('role_admin', {
        name: 'super_admin',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Cannot modify built-in role');
      }
    });

    it('should allow changing built-in role status', async () => {
      const result = await roleManager.update('role_auditor', {
        status: 'inactive',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('inactive');
      }
    });
  });

  describe('delete', () => {
    it('should soft delete custom role', async () => {
      await roleManager.create({
        name: 'deletable_role',
        permissions: [],
      });

      const role = await roleManager.getByName('deletable_role');
      const result = await roleManager.delete(role.ok ? role.value!.id : '');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }

      // Verify it's marked inactive
      const deleted = await roleManager.getByName('deletable_role');
      expect(deleted.ok && deleted.value?.status).toBe('inactive');
    });

    it('should not delete built-in role', async () => {
      const result = await roleManager.delete('role_admin');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Cannot delete built-in role');
      }
    });
  });

  describe('list', () => {
    it('should list all roles', async () => {
      const result = await roleManager.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('should filter by status', async () => {
      const result = await roleManager.list({ status: 'active' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.every((r) => r.status === 'active')).toBe(true);
      }
    });

    it('should filter by isBuiltIn', async () => {
      await roleManager.create({ name: 'custom', permissions: [] });

      const builtIn = await roleManager.list({ isBuiltIn: true });
      const custom = await roleManager.list({ isBuiltIn: false });

      expect(builtIn.ok && builtIn.value.length).toBe(5);
      expect(custom.ok && custom.value.length).toBe(1);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should get permissions for role', async () => {
      const result = await roleManager.getEffectivePermissions('role_analyst');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.some((p) => p.resource === 'entity')).toBe(true);
      }
    });

    it('should include inherited permissions from parent', async () => {
      await roleManager.create({
        name: 'child_role',
        permissions: [{ action: 'create', resource: 'webhook' }],
        parentRoleId: 'role_analyst',
      });

      const role = await roleManager.getByName('child_role');
      const result = await roleManager.getEffectivePermissions(role.ok ? role.value!.id : '');

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should have own permission
        expect(result.value.some((p) => p.resource === 'webhook')).toBe(true);
        // Should have inherited permissions from analyst
        expect(result.value.some((p) => p.resource === 'entity')).toBe(true);
      }
    });
  });
});

describe('AssignmentManager', () => {
  let storage: InMemoryStorage;
  let roleManager: RoleManager;
  let assignmentManager: AssignmentManager;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    roleManager = new RoleManager(storage);
    await roleManager.initialize(BUILT_IN_ROLES);
    assignmentManager = new AssignmentManager(storage, roleManager);
    await assignmentManager.initialize();
  });

  describe('assign', () => {
    it('should assign role to user', async () => {
      const input: AssignRoleInput = {
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      };

      const result = await assignmentManager.assign(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.subjectId).toBe('user_123');
        expect(result.value.roleId).toBe('role_analyst');
        expect(result.value.subjectType).toBe('user');
      }
    });

    it('should assign role with scope', async () => {
      const input: AssignRoleInput = {
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_operator',
        scope: 'project_abc',
        assignedBy: 'admin_001',
      };

      const result = await assignmentManager.assign(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.scope).toBe('project_abc');
      }
    });

    it('should assign role with expiration', async () => {
      const expiresAt = (Date.now() + 86400000) as Timestamp; // 1 day from now
      const input: AssignRoleInput = {
        subjectId: 'contractor_456',
        subjectType: 'user',
        roleId: 'role_analyst',
        expiresAt,
        assignedBy: 'admin_001',
      };

      const result = await assignmentManager.assign(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.expiresAt).toBe(expiresAt);
      }
    });

    it('should reject assignment to non-existent role', async () => {
      const input: AssignRoleInput = {
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_nonexistent',
        assignedBy: 'admin_001',
      };

      const result = await assignmentManager.assign(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Role not found');
      }
    });

    it('should reject duplicate assignment', async () => {
      const input: AssignRoleInput = {
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      };

      await assignmentManager.assign(input);
      const result = await assignmentManager.assign(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already assigned');
      }
    });

    it('should allow same role with different scope', async () => {
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_operator',
        scope: 'project_a',
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_operator',
        scope: 'project_b',
        assignedBy: 'admin_001',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('revoke', () => {
    it('should revoke role assignment', async () => {
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.revoke('user_123', 'role_analyst');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }

      // Verify it's gone
      const hasRole = await assignmentManager.hasRole('user_123', 'role_analyst');
      expect(hasRole.ok && hasRole.value).toBe(false);
    });

    it('should return false for non-existent assignment', async () => {
      const result = await assignmentManager.revoke('user_123', 'role_analyst');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  describe('getRoles', () => {
    it('should get all roles for subject', async () => {
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_auditor',
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.getRoles('user_123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
        const roleIds = result.value.map((a) => a.roleId);
        expect(roleIds).toContain('role_analyst');
        expect(roleIds).toContain('role_auditor');
      }
    });

    it('should filter expired assignments by default', async () => {
      const expiredTime = (Date.now() - 86400000) as Timestamp; // 1 day ago
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        expiresAt: expiredTime,
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.getRoles('user_123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });

    it('should include expired when requested', async () => {
      const expiredTime = (Date.now() - 86400000) as Timestamp;
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        expiresAt: expiredTime,
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.getRoles('user_123', { includeExpired: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
      }
    });
  });

  describe('getSubjects', () => {
    it('should get all subjects with role', async () => {
      await assignmentManager.assign({
        subjectId: 'user_1',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });
      await assignmentManager.assign({
        subjectId: 'user_2',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });
      await assignmentManager.assign({
        subjectId: 'agent_1',
        subjectType: 'agent',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.getSubjects('role_analyst');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
      }
    });
  });

  describe('hasRole', () => {
    it('should return true if subject has role', async () => {
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_admin',
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.hasRole('user_123', 'role_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false if subject does not have role', async () => {
      const result = await assignmentManager.hasRole('user_123', 'role_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('should return false for expired assignment', async () => {
      const expiredTime = (Date.now() - 86400000) as Timestamp;
      await assignmentManager.assign({
        subjectId: 'user_123',
        subjectType: 'user',
        roleId: 'role_analyst',
        expiresAt: expiredTime,
        assignedBy: 'admin_001',
      });

      const result = await assignmentManager.hasRole('user_123', 'role_analyst');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await assignmentManager.assign({
        subjectId: 'user_1',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });
      await assignmentManager.assign({
        subjectId: 'agent_1',
        subjectType: 'agent',
        roleId: 'role_agent',
        assignedBy: 'admin_001',
      });
      await assignmentManager.assign({
        subjectId: 'service_1',
        subjectType: 'service',
        roleId: 'role_operator',
        assignedBy: 'admin_001',
      });
    });

    it('should list all assignments', async () => {
      const result = await assignmentManager.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
      }
    });

    it('should filter by subjectType', async () => {
      const result = await assignmentManager.list({ subjectType: 'agent' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.subjectId).toBe('agent_1');
      }
    });

    it('should filter by roleId', async () => {
      const result = await assignmentManager.list({ roleId: 'role_analyst' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
      }
    });
  });
});

describe('PermissionChecker', () => {
  let storage: InMemoryStorage;
  let roleManager: RoleManager;
  let assignmentManager: AssignmentManager;
  let permissionChecker: PermissionChecker;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    roleManager = new RoleManager(storage);
    await roleManager.initialize(BUILT_IN_ROLES);
    assignmentManager = new AssignmentManager(storage, roleManager);
    await assignmentManager.initialize();
    permissionChecker = new PermissionChecker(roleManager, assignmentManager);
  });

  describe('hasPermission', () => {
    it('should allow admin to do anything', async () => {
      await assignmentManager.assign({
        subjectId: 'admin_user',
        subjectType: 'user',
        roleId: 'role_admin',
        assignedBy: 'system',
      });

      const context: PermissionContext = {
        subjectId: 'admin_user',
        action: 'delete',
        resource: 'policy',
      };

      const result = await permissionChecker.hasPermission(context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(true);
        expect(result.value.matchedRoles).toContain('role_admin');
      }
    });

    it('should allow analyst to read entities', async () => {
      await assignmentManager.assign({
        subjectId: 'analyst_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const context: PermissionContext = {
        subjectId: 'analyst_user',
        action: 'read',
        resource: 'entity',
      };

      const result = await permissionChecker.hasPermission(context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(true);
      }
    });

    it('should deny analyst from creating policies', async () => {
      await assignmentManager.assign({
        subjectId: 'analyst_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const context: PermissionContext = {
        subjectId: 'analyst_user',
        action: 'create',
        resource: 'policy',
      };

      const result = await permissionChecker.hasPermission(context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(false);
        expect(result.value.reason).toContain('No matching permissions');
      }
    });

    it('should deny user without any roles', async () => {
      const context: PermissionContext = {
        subjectId: 'no_roles_user',
        action: 'read',
        resource: 'entity',
      };

      const result = await permissionChecker.hasPermission(context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(false);
      }
    });

    it('should check scoped permissions', async () => {
      await assignmentManager.assign({
        subjectId: 'scoped_user',
        subjectType: 'user',
        roleId: 'role_operator',
        scope: 'project_a',
        assignedBy: 'admin_001',
      });

      // Same scope should work
      const sameScope: PermissionContext = {
        subjectId: 'scoped_user',
        action: 'create',
        resource: 'agent',
        scope: 'project_a',
      };

      const result1 = await permissionChecker.hasPermission(sameScope);
      expect(result1.ok && result1.value.allowed).toBe(true);

      // Different scope should fail
      const diffScope: PermissionContext = {
        subjectId: 'scoped_user',
        action: 'create',
        resource: 'agent',
        scope: 'project_b',
      };

      const result2 = await permissionChecker.hasPermission(diffScope);
      expect(result2.ok && result2.value.allowed).toBe(false);
    });

    it('should combine permissions from multiple roles', async () => {
      await assignmentManager.assign({
        subjectId: 'multi_role_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });
      await assignmentManager.assign({
        subjectId: 'multi_role_user',
        subjectType: 'user',
        roleId: 'role_auditor',
        assignedBy: 'admin_001',
      });

      // Analyst can read entities
      const entityRead: PermissionContext = {
        subjectId: 'multi_role_user',
        action: 'read',
        resource: 'entity',
      };
      const result1 = await permissionChecker.hasPermission(entityRead);
      expect(result1.ok && result1.value.allowed).toBe(true);

      // Auditor can read audit
      const auditRead: PermissionContext = {
        subjectId: 'multi_role_user',
        action: 'read',
        resource: 'audit',
      };
      const result2 = await permissionChecker.hasPermission(auditRead);
      expect(result2.ok && result2.value.allowed).toBe(true);
    });
  });

  describe('permission conditions', () => {
    beforeEach(async () => {
      // Create a role with conditional permissions
      await roleManager.create({
        name: 'conditional_role',
        permissions: [
          {
            action: 'update',
            resource: 'entity',
            conditions: [{ field: 'owner', operator: 'equals', value: 'self' }],
          },
          {
            action: 'read',
            resource: 'claim',
            conditions: [{ field: 'status', operator: 'in', value: ['active', 'pending'] }],
          },
          {
            action: 'delete',
            resource: 'decision',
            conditions: [{ field: 'status', operator: 'not_equals', value: 'approved' }],
          },
          {
            action: 'execute',
            resource: 'agent',
            conditions: [{ field: 'name', operator: 'contains', value: 'test' }],
          },
        ],
      });

      const role = await roleManager.getByName('conditional_role');
      await assignmentManager.assign({
        subjectId: 'cond_user',
        subjectType: 'user',
        roleId: role.ok ? role.value!.id : '',
        assignedBy: 'admin_001',
      });
    });

    it('should evaluate equals condition', async () => {
      const allowed: PermissionContext = {
        subjectId: 'cond_user',
        action: 'update',
        resource: 'entity',
        attributes: { owner: 'self' },
      };
      const result1 = await permissionChecker.hasPermission(allowed);
      expect(result1.ok && result1.value.allowed).toBe(true);

      const denied: PermissionContext = {
        subjectId: 'cond_user',
        action: 'update',
        resource: 'entity',
        attributes: { owner: 'other' },
      };
      const result2 = await permissionChecker.hasPermission(denied);
      expect(result2.ok && result2.value.allowed).toBe(false);
    });

    it('should evaluate in condition', async () => {
      const allowed: PermissionContext = {
        subjectId: 'cond_user',
        action: 'read',
        resource: 'claim',
        attributes: { status: 'active' },
      };
      const result1 = await permissionChecker.hasPermission(allowed);
      expect(result1.ok && result1.value.allowed).toBe(true);

      const denied: PermissionContext = {
        subjectId: 'cond_user',
        action: 'read',
        resource: 'claim',
        attributes: { status: 'archived' },
      };
      const result2 = await permissionChecker.hasPermission(denied);
      expect(result2.ok && result2.value.allowed).toBe(false);
    });

    it('should evaluate not_equals condition', async () => {
      const allowed: PermissionContext = {
        subjectId: 'cond_user',
        action: 'delete',
        resource: 'decision',
        attributes: { status: 'draft' },
      };
      const result1 = await permissionChecker.hasPermission(allowed);
      expect(result1.ok && result1.value.allowed).toBe(true);

      const denied: PermissionContext = {
        subjectId: 'cond_user',
        action: 'delete',
        resource: 'decision',
        attributes: { status: 'approved' },
      };
      const result2 = await permissionChecker.hasPermission(denied);
      expect(result2.ok && result2.value.allowed).toBe(false);
    });

    it('should evaluate contains condition', async () => {
      const allowed: PermissionContext = {
        subjectId: 'cond_user',
        action: 'execute',
        resource: 'agent',
        attributes: { name: 'my_test_agent' },
      };
      const result1 = await permissionChecker.hasPermission(allowed);
      expect(result1.ok && result1.value.allowed).toBe(true);

      const denied: PermissionContext = {
        subjectId: 'cond_user',
        action: 'execute',
        resource: 'agent',
        attributes: { name: 'production_agent' },
      };
      const result2 = await permissionChecker.hasPermission(denied);
      expect(result2.ok && result2.value.allowed).toBe(false);
    });

    it('should support nested attribute paths', async () => {
      await roleManager.create({
        name: 'nested_cond_role',
        permissions: [
          {
            action: 'read',
            resource: 'entity',
            conditions: [{ field: 'metadata.type', operator: 'equals', value: 'document' }],
          },
        ],
      });

      const role = await roleManager.getByName('nested_cond_role');
      await assignmentManager.assign({
        subjectId: 'nested_user',
        subjectType: 'user',
        roleId: role.ok ? role.value!.id : '',
        assignedBy: 'admin_001',
      });

      const allowed: PermissionContext = {
        subjectId: 'nested_user',
        action: 'read',
        resource: 'entity',
        attributes: { metadata: { type: 'document' } },
      };
      const result = await permissionChecker.hasPermission(allowed);
      expect(result.ok && result.value.allowed).toBe(true);
    });
  });

  describe('getPermissions', () => {
    it('should get all permissions for subject', async () => {
      await assignmentManager.assign({
        subjectId: 'perm_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const result = await permissionChecker.getPermissions('perm_user');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if subject has all permissions', async () => {
      await assignmentManager.assign({
        subjectId: 'all_perm_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const contexts = [
        { action: 'read' as const, resource: 'entity' as const },
        { action: 'read' as const, resource: 'claim' as const },
      ];

      const result = await permissionChecker.hasAllPermissions('all_perm_user', contexts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false if subject is missing any permission', async () => {
      await assignmentManager.assign({
        subjectId: 'some_perm_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const contexts = [
        { action: 'read' as const, resource: 'entity' as const },
        { action: 'create' as const, resource: 'policy' as const }, // Analyst can't do this
      ];

      const result = await permissionChecker.hasAllPermissions('some_perm_user', contexts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if subject has any permission', async () => {
      await assignmentManager.assign({
        subjectId: 'any_perm_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const contexts = [
        { action: 'create' as const, resource: 'policy' as const }, // Can't do this
        { action: 'read' as const, resource: 'entity' as const }, // Can do this
      ];

      const result = await permissionChecker.hasAnyPermission('any_perm_user', contexts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false if subject has no permissions', async () => {
      await assignmentManager.assign({
        subjectId: 'no_perm_user',
        subjectType: 'user',
        roleId: 'role_analyst',
        assignedBy: 'admin_001',
      });

      const contexts = [
        { action: 'create' as const, resource: 'policy' as const },
        { action: 'delete' as const, resource: 'agent' as const },
      ];

      const result = await permissionChecker.hasAnyPermission('no_perm_user', contexts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  describe('resourceId matching', () => {
    beforeEach(async () => {
      await roleManager.create({
        name: 'specific_resource_role',
        permissions: [
          { action: 'update', resource: 'entity', resourceId: 'entity_123' },
          { action: 'delete', resource: 'entity', resourceId: '*' },
        ],
      });

      const role = await roleManager.getByName('specific_resource_role');
      await assignmentManager.assign({
        subjectId: 'resource_user',
        subjectType: 'user',
        roleId: role.ok ? role.value!.id : '',
        assignedBy: 'admin_001',
      });
    });

    it('should match specific resourceId', async () => {
      const allowed: PermissionContext = {
        subjectId: 'resource_user',
        action: 'update',
        resource: 'entity',
        resourceId: 'entity_123',
      };
      const result1 = await permissionChecker.hasPermission(allowed);
      expect(result1.ok && result1.value.allowed).toBe(true);

      const denied: PermissionContext = {
        subjectId: 'resource_user',
        action: 'update',
        resource: 'entity',
        resourceId: 'entity_456',
      };
      const result2 = await permissionChecker.hasPermission(denied);
      expect(result2.ok && result2.value.allowed).toBe(false);
    });

    it('should match wildcard resourceId', async () => {
      const context: PermissionContext = {
        subjectId: 'resource_user',
        action: 'delete',
        resource: 'entity',
        resourceId: 'any_entity',
      };
      const result = await permissionChecker.hasPermission(context);
      expect(result.ok && result.value.allowed).toBe(true);
    });
  });
});
