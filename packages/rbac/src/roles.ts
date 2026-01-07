/**
 * Role Manager
 *
 * Manages role definitions and CRUD operations.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface, StorageRecord } from '@contextgraph/storage';
import type {
  RoleData,
  CreateRoleInput,
  UpdateRoleInput,
  RoleQueryOptions,
  Permission,
  RoleStatus,
} from './types.js';

/**
 * Role record in storage
 */
interface RoleRecord extends StorageRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly permissions: string; // JSON array
  readonly parentRoleId?: string;
  readonly isBuiltIn: boolean;
  readonly status: RoleStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Role Manager class
 */
export class RoleManager {
  private readonly storage: StorageInterface;
  private readonly collection = 'roles';

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Initialize role storage and create built-in roles
   */
  async initialize(builtInRoles: readonly Omit<RoleData, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Result<void, Error>> {
    const initResult = await this.storage.initialize();
    if (!initResult.ok) {
      return initResult;
    }

    // Create built-in roles if they don't exist
    for (const roleDef of builtInRoles) {
      const existing = await this.getByName(roleDef.name);
      if (existing.ok && existing.value === null) {
        await this.createBuiltIn(roleDef);
      }
    }

    return ok(undefined);
  }

  /**
   * Create a built-in role
   */
  private async createBuiltIn(
    roleDef: Omit<RoleData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Result<RoleData, Error>> {
    const now = createTimestamp();
    const id = `role_${roleDef.name}`;

    const record: RoleRecord = {
      id,
      name: roleDef.name,
      permissions: JSON.stringify(roleDef.permissions),
      isBuiltIn: true,
      status: roleDef.status,
      createdAt: now,
      updatedAt: now,
      ...(roleDef.description !== undefined ? { description: roleDef.description } : {}),
      ...(roleDef.parentRoleId !== undefined ? { parentRoleId: roleDef.parentRoleId } : {}),
    };

    const result = await this.storage.insert(this.collection, record);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(record));
  }

  /**
   * Create a custom role
   */
  async create(input: CreateRoleInput): Promise<Result<RoleData, Error>> {
    // Validate name uniqueness
    const existing = await this.getByName(input.name);
    if (existing.ok && existing.value !== null) {
      return err(new Error(`Role already exists: ${input.name}`));
    }

    // Validate parent role if specified
    if (input.parentRoleId !== undefined) {
      const parent = await this.get(input.parentRoleId);
      if (!parent.ok || parent.value === null) {
        return err(new Error(`Parent role not found: ${input.parentRoleId}`));
      }
    }

    const now = createTimestamp();
    const id = `role_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const record: RoleRecord = {
      id,
      name: input.name,
      permissions: JSON.stringify(input.permissions),
      isBuiltIn: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.parentRoleId !== undefined ? { parentRoleId: input.parentRoleId } : {}),
    };

    const result = await this.storage.insert(this.collection, record);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(record));
  }

  /**
   * Get role by ID
   */
  async get(id: string): Promise<Result<RoleData | null, Error>> {
    const result = await this.storage.findById<RoleRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(this.recordToData(result.value));
  }

  /**
   * Get role by name
   */
  async getByName(name: string): Promise<Result<RoleData | null, Error>> {
    const result = await this.storage.find<RoleRecord>(this.collection, { name }, { limit: 1 });
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.items.length === 0) {
      return ok(null);
    }

    return ok(this.recordToData(result.value.items[0]!));
  }

  /**
   * Update a role
   */
  async update(id: string, input: UpdateRoleInput): Promise<Result<RoleData, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return err(new Error(`Role not found: ${id}`));
    }

    // Cannot modify built-in roles except status
    if (existing.value.isBuiltIn && (input.name !== undefined || input.permissions !== undefined || input.parentRoleId !== undefined)) {
      return err(new Error('Cannot modify built-in role properties'));
    }

    // Validate name uniqueness if changing
    if (input.name !== undefined && input.name !== existing.value.name) {
      const nameCheck = await this.getByName(input.name);
      if (nameCheck.ok && nameCheck.value !== null) {
        return err(new Error(`Role already exists: ${input.name}`));
      }
    }

    const now = createTimestamp();

    const updatedRecord: RoleRecord = {
      id,
      name: input.name ?? existing.value.name,
      permissions: input.permissions !== undefined ? JSON.stringify(input.permissions) : JSON.stringify(existing.value.permissions),
      isBuiltIn: existing.value.isBuiltIn,
      status: input.status ?? existing.value.status,
      createdAt: existing.value.createdAt,
      updatedAt: now,
      ...(input.description !== undefined ? { description: input.description } : existing.value.description !== undefined ? { description: existing.value.description } : {}),
      ...(input.parentRoleId !== undefined ? { parentRoleId: input.parentRoleId } : existing.value.parentRoleId !== undefined ? { parentRoleId: existing.value.parentRoleId } : {}),
    };

    const result = await this.storage.upsert(this.collection, updatedRecord);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(updatedRecord));
  }

  /**
   * Delete a role (only custom roles)
   */
  async delete(id: string): Promise<Result<boolean, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return ok(false);
    }

    if (existing.value.isBuiltIn) {
      return err(new Error('Cannot delete built-in role'));
    }

    // Soft delete by marking as inactive
    const updateResult = await this.update(id, { status: 'inactive' });
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok(true);
  }

  /**
   * List roles
   */
  async list(options: RoleQueryOptions = {}): Promise<Result<readonly RoleData[], Error>> {
    const query: Record<string, unknown> = {};

    if (options.status !== undefined) {
      query['status'] = options.status;
    }
    if (options.isBuiltIn !== undefined) {
      query['isBuiltIn'] = options.isBuiltIn;
    }

    const queryOptions: { limit: number; offset?: number } = {
      limit: options.limit ?? 100,
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }

    const result = await this.storage.find<RoleRecord>(this.collection, query, queryOptions);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => this.recordToData(record)));
  }

  /**
   * Get effective permissions for a role (including inherited)
   */
  async getEffectivePermissions(roleId: string): Promise<Result<readonly Permission[], Error>> {
    const role = await this.get(roleId);
    if (!role.ok) {
      return err(role.error);
    }
    if (role.value === null) {
      return err(new Error(`Role not found: ${roleId}`));
    }

    const permissions: Permission[] = [...role.value.permissions];

    // Get inherited permissions from parent
    if (role.value.parentRoleId !== undefined) {
      const parentPerms = await this.getEffectivePermissions(role.value.parentRoleId);
      if (parentPerms.ok) {
        permissions.push(...parentPerms.value);
      }
    }

    return ok(permissions);
  }

  /**
   * Convert storage record to role data
   */
  private recordToData(record: RoleRecord): RoleData {
    const data: RoleData = {
      id: record.id,
      name: record.name,
      permissions: JSON.parse(record.permissions) as Permission[],
      isBuiltIn: record.isBuiltIn,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.description !== undefined ? { description: record.description } : {}),
      ...(record.parentRoleId !== undefined ? { parentRoleId: record.parentRoleId } : {}),
    };

    return data;
  }
}
