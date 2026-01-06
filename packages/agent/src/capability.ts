/**
 * Capability Registry
 *
 * Manages capability definitions and registration.
 */

import {
  type Result,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type {
  Capability,
  CapabilityId,
  CapabilityCategory,
  ResourceConstraint,
  CapabilityRegistryEntry,
} from './types.js';

/**
 * Generate capability ID
 */
function createCapabilityId(): CapabilityId {
  return `cap_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as CapabilityId;
}

/**
 * Capability Registry
 *
 * Central registry for capability definitions.
 */
export class CapabilityRegistry {
  private readonly capabilities = new Map<CapabilityId, CapabilityRegistryEntry>();

  /**
   * Register a new capability
   */
  register(input: {
    name: string;
    description?: string;
    category: CapabilityCategory;
    actions: readonly string[];
    resourceTypes: readonly string[];
    constraints?: readonly ResourceConstraint[];
  }): Result<Capability, ValidationError> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Capability name is required', 'name'));
    }

    // Validate actions
    if (input.actions.length === 0) {
      return err(new ValidationError('At least one action is required', 'actions'));
    }

    // Validate resource types
    if (input.resourceTypes.length === 0) {
      return err(new ValidationError('At least one resource type is required', 'resourceTypes'));
    }

    // Check for duplicate name
    for (const entry of this.capabilities.values()) {
      if (entry.capability.name === input.name.trim()) {
        return err(new ValidationError(`Capability "${input.name}" already exists`, 'name'));
      }
    }

    const id = createCapabilityId();
    const capability: Capability = {
      id,
      name: input.name.trim(),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      category: input.category,
      actions: [...input.actions],
      resourceTypes: [...input.resourceTypes],
      ...(input.constraints !== undefined ? { constraints: [...input.constraints] } : {}),
    };

    this.capabilities.set(id, {
      capability,
      registeredAt: createTimestamp(),
    });

    return ok(capability);
  }

  /**
   * Get capability by ID
   */
  get(id: CapabilityId): Capability | undefined {
    return this.capabilities.get(id)?.capability;
  }

  /**
   * Find capability by name
   */
  findByName(name: string): Capability | undefined {
    for (const entry of this.capabilities.values()) {
      if (entry.capability.name === name) {
        return entry.capability;
      }
    }
    return undefined;
  }

  /**
   * Find capabilities by category
   */
  findByCategory(category: CapabilityCategory): readonly Capability[] {
    const results: Capability[] = [];
    for (const entry of this.capabilities.values()) {
      if (entry.capability.category === category) {
        results.push(entry.capability);
      }
    }
    return results;
  }

  /**
   * Find capabilities that allow a specific action
   */
  findByAction(action: string): readonly Capability[] {
    const results: Capability[] = [];
    for (const entry of this.capabilities.values()) {
      if (entry.capability.actions.includes(action)) {
        results.push(entry.capability);
      }
    }
    return results;
  }

  /**
   * Find capabilities that apply to a resource type
   */
  findByResourceType(resourceType: string): readonly Capability[] {
    const results: Capability[] = [];
    for (const entry of this.capabilities.values()) {
      if (entry.capability.resourceTypes.includes(resourceType)) {
        results.push(entry.capability);
      }
    }
    return results;
  }

  /**
   * Check if an action is allowed by a capability
   */
  checkAction(capabilityId: CapabilityId, action: string, resourceType: string): boolean {
    const capability = this.get(capabilityId);
    if (!capability) {
      return false;
    }

    const actionMatch = capability.actions.includes(action) || capability.actions.includes('*');
    const resourceMatch = capability.resourceTypes.includes(resourceType) || capability.resourceTypes.includes('*');

    return actionMatch && resourceMatch;
  }

  /**
   * Get all registered capabilities
   */
  getAll(): readonly Capability[] {
    return Array.from(this.capabilities.values()).map((e) => e.capability);
  }

  /**
   * Get count of registered capabilities
   */
  count(): number {
    return this.capabilities.size;
  }

  /**
   * Remove a capability (for testing)
   */
  remove(id: CapabilityId): boolean {
    return this.capabilities.delete(id);
  }

  /**
   * Clear all capabilities (for testing)
   */
  clear(): void {
    this.capabilities.clear();
  }
}

/**
 * Built-in capability definitions
 */
export const BUILTIN_CAPABILITIES = {
  READ_DATA: {
    name: 'read_data',
    category: 'read' as CapabilityCategory,
    actions: ['read', 'list', 'search', 'get'],
    resourceTypes: ['*'],
    description: 'Read access to data resources',
  },
  WRITE_DATA: {
    name: 'write_data',
    category: 'write' as CapabilityCategory,
    actions: ['create', 'update', 'delete'],
    resourceTypes: ['*'],
    description: 'Write access to data resources',
  },
  EXECUTE_CODE: {
    name: 'execute_code',
    category: 'execute' as CapabilityCategory,
    actions: ['execute', 'run'],
    resourceTypes: ['code', 'script', 'function'],
    description: 'Execute code or scripts',
  },
  COMMUNICATE_EXTERNAL: {
    name: 'communicate_external',
    category: 'communicate' as CapabilityCategory,
    actions: ['send', 'receive', 'connect'],
    resourceTypes: ['api', 'service', 'network'],
    description: 'Communicate with external services',
  },
  DELEGATE_TASK: {
    name: 'delegate_task',
    category: 'delegate' as CapabilityCategory,
    actions: ['delegate', 'spawn', 'assign'],
    resourceTypes: ['agent', 'task'],
    description: 'Delegate tasks to other agents',
  },
  ADMIN_AGENT: {
    name: 'admin_agent',
    category: 'admin' as CapabilityCategory,
    actions: ['create', 'update', 'delete', 'suspend', 'revoke'],
    resourceTypes: ['agent', 'capability', 'policy'],
    description: 'Administrative access to agent management',
  },
} as const;

/**
 * Initialize registry with built-in capabilities
 */
export function initializeBuiltinCapabilities(registry: CapabilityRegistry): void {
  for (const config of Object.values(BUILTIN_CAPABILITIES)) {
    registry.register(config);
  }
}
