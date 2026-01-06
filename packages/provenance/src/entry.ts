/**
 * Provenance Entry Model
 *
 * Immutable provenance entries that form a hash-linked chain.
 * Each entry records who did what, when, and with what inputs/outputs.
 */

import {
  type ProvenanceId,
  type Result,
  createProvenanceId,
  createTimestamp,
  ok,
  err,
  ValidationError,
} from '@contextgraph/core';
import type {
  ProvenanceData,
  ProvenanceRecord,
  CreateProvenanceInput,
  ArtifactRef,
  SourceType,
  ActionType,
} from './types.js';
import { computeProvenanceHash, verifyProvenanceHash } from './hash.js';

/**
 * Valid source types
 */
const VALID_SOURCE_TYPES: readonly SourceType[] = [
  'human',
  'agent',
  'system',
  'external_api',
  'document',
  'database',
  'derived',
];

/**
 * Valid action types
 */
const VALID_ACTION_TYPES: readonly ActionType[] = [
  'create',
  'update',
  'derive',
  'import',
  'transform',
  'validate',
  'approve',
  'reject',
  'execute',
];

/**
 * Provenance Entry (immutable)
 *
 * Represents a single record in the provenance ledger.
 */
export class ProvenanceEntry {
  private constructor(public readonly data: ProvenanceData) {}

  /**
   * Create a new provenance entry
   */
  static create(
    input: CreateProvenanceInput,
    previousHash?: string
  ): Result<ProvenanceEntry, ValidationError> {
    // Validate source type
    if (!VALID_SOURCE_TYPES.includes(input.sourceType)) {
      return err(new ValidationError(`Invalid source type: ${input.sourceType}`, 'sourceType'));
    }

    // Validate action type
    if (!VALID_ACTION_TYPES.includes(input.action)) {
      return err(new ValidationError(`Invalid action type: ${input.action}`, 'action'));
    }

    // Validate input refs
    const inputRefs = input.inputRefs ?? [];
    for (const ref of inputRefs) {
      if (!ref.type || !ref.id) {
        return err(new ValidationError('Invalid input reference: missing type or id', 'inputRefs'));
      }
    }

    // Validate output refs
    const outputRefs = input.outputRefs ?? [];
    for (const ref of outputRefs) {
      if (!ref.type || !ref.id) {
        return err(new ValidationError('Invalid output reference: missing type or id', 'outputRefs'));
      }
    }

    const id = createProvenanceId();
    const timestamp = input.timestamp ?? createTimestamp();
    const createdAt = createTimestamp();
    const metadata = input.metadata ?? {};

    // Compute hash
    const hash = computeProvenanceHash({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceUri: input.sourceUri,
      actor: input.actor,
      action: input.action,
      inputRefs,
      outputRefs,
      timestamp,
      metadata,
      previousHash,
    });

    const data: ProvenanceData = {
      id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceUri: input.sourceUri,
      actor: input.actor,
      action: input.action,
      inputRefs,
      outputRefs,
      timestamp,
      metadata,
      hash,
      previousHash,
      createdAt,
    };

    return ok(new ProvenanceEntry(data));
  }

  /**
   * Reconstruct entry from stored record
   */
  static fromRecord(record: ProvenanceRecord): ProvenanceEntry {
    const inputRefs = record.inputRefs !== null
      ? (typeof record.inputRefs === 'string'
          ? JSON.parse(record.inputRefs) as ArtifactRef[]
          : record.inputRefs as unknown as ArtifactRef[])
      : [];

    const outputRefs = record.outputRefs !== null
      ? (typeof record.outputRefs === 'string'
          ? JSON.parse(record.outputRefs) as ArtifactRef[]
          : record.outputRefs as unknown as ArtifactRef[])
      : [];

    const metadata = record.metadata !== null
      ? (typeof record.metadata === 'string'
          ? JSON.parse(record.metadata) as Record<string, unknown>
          : record.metadata as Record<string, unknown>)
      : {};

    return new ProvenanceEntry({
      id: record.id as ProvenanceId,
      sourceType: record.sourceType as SourceType,
      sourceId: record.sourceId ?? undefined,
      sourceUri: record.sourceUri ?? undefined,
      actor: record.actor ?? undefined,
      action: record.action as ActionType,
      inputRefs,
      outputRefs,
      timestamp: record.timestamp,
      metadata,
      hash: record.hash,
      previousHash: record.previousHash ?? undefined,
      createdAt: record.createdAt,
    });
  }

  /**
   * Convert to storage record
   */
  toRecord(): ProvenanceRecord {
    return {
      id: this.data.id,
      sourceType: this.data.sourceType,
      sourceId: this.data.sourceId ?? null,
      sourceUri: this.data.sourceUri ?? null,
      actor: this.data.actor ?? null,
      action: this.data.action,
      inputRefs: this.data.inputRefs.length > 0 ? JSON.stringify(this.data.inputRefs) : null,
      outputRefs: this.data.outputRefs.length > 0 ? JSON.stringify(this.data.outputRefs) : null,
      timestamp: this.data.timestamp,
      metadata: Object.keys(this.data.metadata).length > 0 ? JSON.stringify(this.data.metadata) : null,
      hash: this.data.hash,
      previousHash: this.data.previousHash ?? null,
      createdAt: this.data.createdAt,
    };
  }

  /**
   * Verify this entry's hash
   */
  verifyHash(): boolean {
    return verifyProvenanceHash(
      {
        sourceType: this.data.sourceType,
        sourceId: this.data.sourceId,
        sourceUri: this.data.sourceUri,
        actor: this.data.actor,
        action: this.data.action,
        inputRefs: this.data.inputRefs,
        outputRefs: this.data.outputRefs,
        timestamp: this.data.timestamp,
        metadata: this.data.metadata,
        previousHash: this.data.previousHash,
      },
      this.data.hash
    );
  }

  /**
   * Check if this entry links to a previous entry
   */
  isLinkedTo(previousEntry: ProvenanceEntry): boolean {
    return this.data.previousHash === previousEntry.data.hash;
  }
}
