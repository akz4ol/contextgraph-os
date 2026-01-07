/**
 * Assignment Manager
 *
 * Manages role assignments to subjects (users, agents, services).
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface, StorageRecord } from '@contextgraph/storage';
import type {
  RoleAssignment,
  AssignRoleInput,
  AssignmentQueryOptions,
} from './types.js';
import { RoleManager } from './roles.js';

/**
 * Assignment record in storage
 */
interface AssignmentRecord extends StorageRecord {
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
 * Assignment Manager class
 */
export class AssignmentManager {
  private readonly storage: StorageInterface;
  private readonly roleManager: RoleManager;
  private readonly collection = 'role_assignments';

  constructor(storage: StorageInterface, roleManager: RoleManager) {
    this.storage = storage;
    this.roleManager = roleManager;
  }

  /**
   * Initialize assignment storage
   * Note: Storage should already be initialized by RoleManager
   */
  async initialize(): Promise<Result<void, Error>> {
    // Storage initialization is handled by RoleManager
    // This method exists for any future assignment-specific setup
    return ok(undefined);
  }

  /**
   * Assign a role to a subject
   */
  async assign(input: AssignRoleInput): Promise<Result<RoleAssignment, Error>> {
    // Validate role exists
    const role = await this.roleManager.get(input.roleId);
    if (!role.ok) {
      return err(role.error);
    }
    if (role.value === null) {
      return err(new Error(`Role not found: ${input.roleId}`));
    }

    // Check for existing assignment (same subject, role, scope)
    const existing = await this.getAssignment(input.subjectId, input.roleId, input.scope);
    if (existing.ok && existing.value !== null) {
      return err(new Error('Role already assigned to subject'));
    }

    const now = createTimestamp();
    const id = `asgn_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const record: AssignmentRecord = {
      id,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      roleId: input.roleId,
      createdAt: now,
      createdBy: input.assignedBy,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    };

    const result = await this.storage.insert(this.collection, record);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToAssignment(record));
  }

  /**
   * Revoke a role from a subject
   * Uses soft delete by setting expiresAt to now
   */
  async revoke(subjectId: string, roleId: string, scope?: string): Promise<Result<boolean, Error>> {
    const assignment = await this.getAssignment(subjectId, roleId, scope);
    if (!assignment.ok) {
      return err(assignment.error);
    }
    if (assignment.value === null) {
      return ok(false);
    }

    // Soft delete by setting expiration to now (makes it immediately expired)
    const now = createTimestamp();
    const revokedRecord: AssignmentRecord = {
      id: assignment.value.id,
      subjectId: assignment.value.subjectId,
      subjectType: assignment.value.subjectType,
      roleId: assignment.value.roleId,
      createdAt: assignment.value.createdAt,
      createdBy: assignment.value.createdBy,
      expiresAt: (now - 1) as Timestamp, // Set to 1ms in the past
      ...(assignment.value.scope !== undefined ? { scope: assignment.value.scope } : {}),
    };

    const result = await this.storage.upsert(this.collection, revokedRecord);
    return result.ok ? ok(true) : err(result.error);
  }

  /**
   * Get a specific assignment
   */
  async getAssignment(subjectId: string, roleId: string, scope?: string): Promise<Result<RoleAssignment | null, Error>> {
    const query: Record<string, unknown> = { subjectId, roleId };
    if (scope !== undefined) {
      query['scope'] = scope;
    }

    const result = await this.storage.find<AssignmentRecord>(this.collection, query, { limit: 1 });
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.items.length === 0) {
      return ok(null);
    }

    return ok(this.recordToAssignment(result.value.items[0]!));
  }

  /**
   * Get all roles assigned to a subject
   */
  async getRoles(subjectId: string, options: { includeExpired?: boolean } = {}): Promise<Result<readonly RoleAssignment[], Error>> {
    const result = await this.storage.find<AssignmentRecord>(
      this.collection,
      { subjectId },
      { limit: 100 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const now = createTimestamp();
    let assignments = result.value.items.map((record) => this.recordToAssignment(record));

    // Filter out expired assignments unless requested
    if (!options.includeExpired) {
      assignments = assignments.filter((a) => a.expiresAt === undefined || a.expiresAt > now);
    }

    return ok(assignments);
  }

  /**
   * Get all subjects with a specific role
   */
  async getSubjects(roleId: string, options: { includeExpired?: boolean } = {}): Promise<Result<readonly RoleAssignment[], Error>> {
    const result = await this.storage.find<AssignmentRecord>(
      this.collection,
      { roleId },
      { limit: 1000 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const now = createTimestamp();
    let assignments = result.value.items.map((record) => this.recordToAssignment(record));

    // Filter out expired assignments unless requested
    if (!options.includeExpired) {
      assignments = assignments.filter((a) => a.expiresAt === undefined || a.expiresAt > now);
    }

    return ok(assignments);
  }

  /**
   * List all assignments
   */
  async list(options: AssignmentQueryOptions = {}): Promise<Result<readonly RoleAssignment[], Error>> {
    const query: Record<string, unknown> = {};

    if (options.subjectId !== undefined) {
      query['subjectId'] = options.subjectId;
    }
    if (options.roleId !== undefined) {
      query['roleId'] = options.roleId;
    }
    if (options.subjectType !== undefined) {
      query['subjectType'] = options.subjectType;
    }

    const queryOptions: { limit: number; offset?: number } = {
      limit: options.limit ?? 100,
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<AssignmentRecord>(this.collection, query, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    const now = createTimestamp();
    let assignments = result.value.items.map((record) => this.recordToAssignment(record));

    // Filter out expired assignments unless requested
    if (!options.includeExpired) {
      assignments = assignments.filter((a) => a.expiresAt === undefined || a.expiresAt > now);
    }

    return ok(assignments);
  }

  /**
   * Check if a subject has a specific role
   */
  async hasRole(subjectId: string, roleId: string, scope?: string): Promise<Result<boolean, Error>> {
    const assignment = await this.getAssignment(subjectId, roleId, scope);
    if (!assignment.ok) {
      return err(assignment.error);
    }

    if (assignment.value === null) {
      return ok(false);
    }

    // Check expiration
    const now = createTimestamp();
    if (assignment.value.expiresAt !== undefined && assignment.value.expiresAt <= now) {
      return ok(false);
    }

    return ok(true);
  }

  /**
   * Convert storage record to assignment
   */
  private recordToAssignment(record: AssignmentRecord): RoleAssignment {
    const assignment: RoleAssignment = {
      id: record.id,
      subjectId: record.subjectId,
      subjectType: record.subjectType,
      roleId: record.roleId,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      ...(record.scope !== undefined ? { scope: record.scope } : {}),
      ...(record.expiresAt !== undefined ? { expiresAt: record.expiresAt } : {}),
    };

    return assignment;
  }
}
