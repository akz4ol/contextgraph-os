/**
 * Problem Space
 *
 * Defines the domain and task space that agents can operate in.
 */

import {
  type Result,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type {
  ProblemSpaceId,
  ProblemSpace,
  ProblemSpaceNode,
  ProblemSpaceNodeType,
  CreateProblemSpaceInput,
} from './types.js';

/**
 * Generate problem space ID
 */
function createProblemSpaceId(): ProblemSpaceId {
  return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as ProblemSpaceId;
}

/**
 * Problem Space Manager
 *
 * Manages problem space definitions and graph operations.
 */
export class ProblemSpaceManager {
  private readonly spaces = new Map<ProblemSpaceId, ProblemSpace>();

  /**
   * Create a new problem space
   */
  create(input: CreateProblemSpaceInput): Result<ProblemSpace, ValidationError> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Problem space name is required', 'name'));
    }

    // Check for duplicate name
    for (const space of this.spaces.values()) {
      if (space.name === input.name.trim()) {
        return err(new ValidationError(`Problem space "${input.name}" already exists`, 'name'));
      }
    }

    const id = createProblemSpaceId();
    const now = createTimestamp();

    const space: ProblemSpace = {
      id,
      name: input.name.trim(),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      nodes: input.nodes ?? [],
      rootNodeIds: input.rootNodeIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.spaces.set(id, space);
    return ok(space);
  }

  /**
   * Get problem space by ID
   */
  get(id: ProblemSpaceId): ProblemSpace | undefined {
    return this.spaces.get(id);
  }

  /**
   * Find problem space by name
   */
  findByName(name: string): ProblemSpace | undefined {
    for (const space of this.spaces.values()) {
      if (space.name === name) {
        return space;
      }
    }
    return undefined;
  }

  /**
   * Add a node to a problem space
   */
  addNode(
    spaceId: ProblemSpaceId,
    node: {
      id: string;
      type: ProblemSpaceNodeType;
      name: string;
      description?: string;
      parentId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Result<ProblemSpace, ValidationError> {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return err(new ValidationError('Problem space not found', 'spaceId'));
    }

    // Check for duplicate node ID
    if (space.nodes.some((n) => n.id === node.id)) {
      return err(new ValidationError(`Node "${node.id}" already exists`, 'id'));
    }

    // Validate parent exists if specified
    if (node.parentId !== undefined && !space.nodes.some((n) => n.id === node.parentId)) {
      return err(new ValidationError(`Parent node "${node.parentId}" not found`, 'parentId'));
    }

    const newNode: ProblemSpaceNode = {
      id: node.id,
      type: node.type,
      name: node.name,
      ...(node.description !== undefined ? { description: node.description } : {}),
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
      ...(node.metadata !== undefined ? { metadata: node.metadata } : {}),
    };

    const updatedSpace: ProblemSpace = {
      ...space,
      nodes: [...space.nodes, newNode],
      rootNodeIds: node.parentId === undefined
        ? [...space.rootNodeIds, node.id]
        : space.rootNodeIds,
      updatedAt: createTimestamp(),
    };

    this.spaces.set(spaceId, updatedSpace);
    return ok(updatedSpace);
  }

  /**
   * Remove a node from a problem space
   */
  removeNode(spaceId: ProblemSpaceId, nodeId: string): Result<ProblemSpace, ValidationError> {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return err(new ValidationError('Problem space not found', 'spaceId'));
    }

    const nodeIndex = space.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      return err(new ValidationError(`Node "${nodeId}" not found`, 'nodeId'));
    }

    // Check for children
    if (space.nodes.some((n) => n.parentId === nodeId)) {
      return err(new ValidationError('Cannot remove node with children', 'nodeId'));
    }

    const newNodes = [...space.nodes];
    newNodes.splice(nodeIndex, 1);

    const updatedSpace: ProblemSpace = {
      ...space,
      nodes: newNodes,
      rootNodeIds: space.rootNodeIds.filter((id) => id !== nodeId),
      updatedAt: createTimestamp(),
    };

    this.spaces.set(spaceId, updatedSpace);
    return ok(updatedSpace);
  }

  /**
   * Get children of a node
   */
  getChildren(spaceId: ProblemSpaceId, nodeId: string): readonly ProblemSpaceNode[] {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return [];
    }

    return space.nodes.filter((n) => n.parentId === nodeId);
  }

  /**
   * Get ancestors of a node (path to root)
   */
  getAncestors(spaceId: ProblemSpaceId, nodeId: string): readonly ProblemSpaceNode[] {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return [];
    }

    const ancestors: ProblemSpaceNode[] = [];
    let currentNode = space.nodes.find((n) => n.id === nodeId);

    while (currentNode?.parentId !== undefined) {
      const parent = space.nodes.find((n) => n.id === currentNode!.parentId);
      if (parent) {
        ancestors.push(parent);
        currentNode = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get descendants of a node (all children recursively)
   */
  getDescendants(spaceId: ProblemSpaceId, nodeId: string): readonly ProblemSpaceNode[] {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return [];
    }

    const descendants: ProblemSpaceNode[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = space.nodes.filter((n) => n.parentId === currentId);
      descendants.push(...children);
      queue.push(...children.map((c) => c.id));
    }

    return descendants;
  }

  /**
   * Find node by ID
   */
  findNode(spaceId: ProblemSpaceId, nodeId: string): ProblemSpaceNode | undefined {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return undefined;
    }

    return space.nodes.find((n) => n.id === nodeId);
  }

  /**
   * Find nodes by type
   */
  findNodesByType(spaceId: ProblemSpaceId, type: ProblemSpaceNodeType): readonly ProblemSpaceNode[] {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return [];
    }

    return space.nodes.filter((n) => n.type === type);
  }

  /**
   * Get all problem spaces
   */
  getAll(): readonly ProblemSpace[] {
    return Array.from(this.spaces.values());
  }

  /**
   * Delete a problem space
   */
  delete(id: ProblemSpaceId): boolean {
    return this.spaces.delete(id);
  }

  /**
   * Clear all problem spaces (for testing)
   */
  clear(): void {
    this.spaces.clear();
  }
}
