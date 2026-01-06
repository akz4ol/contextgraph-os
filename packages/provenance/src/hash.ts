/**
 * Provenance Hash Utilities
 *
 * Provides cryptographic hashing for provenance entries.
 * Uses SHA-256 for content hashing to ensure integrity.
 */

import { createHash } from 'crypto';
import type { ArtifactRef, SourceType, ActionType } from './types.js';
import type { Timestamp } from '@contextgraph/core';

/**
 * Content to be hashed for provenance entry
 */
interface HashContent {
  readonly sourceType: SourceType;
  readonly sourceId: string | undefined;
  readonly sourceUri: string | undefined;
  readonly actor: string | undefined;
  readonly action: ActionType;
  readonly inputRefs: readonly ArtifactRef[];
  readonly outputRefs: readonly ArtifactRef[];
  readonly timestamp: Timestamp;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly previousHash: string | undefined;
}

/**
 * Compute SHA-256 hash of provenance entry content
 *
 * The hash includes all relevant fields to ensure any modification
 * would be detectable.
 */
export function computeProvenanceHash(content: HashContent): string {
  const normalized = {
    sourceType: content.sourceType,
    sourceId: content.sourceId ?? null,
    sourceUri: content.sourceUri ?? null,
    actor: content.actor ?? null,
    action: content.action,
    inputRefs: content.inputRefs.map((ref) => ({ type: ref.type, id: ref.id })),
    outputRefs: content.outputRefs.map((ref) => ({ type: ref.type, id: ref.id })),
    timestamp: content.timestamp,
    metadata: content.metadata,
    previousHash: content.previousHash ?? null,
  };

  const json = JSON.stringify(normalized, Object.keys(normalized).sort());
  const hash = createHash('sha256');
  hash.update(json);
  return hash.digest('hex');
}

/**
 * Verify that a hash matches the content
 */
export function verifyProvenanceHash(content: HashContent, expectedHash: string): boolean {
  const computedHash = computeProvenanceHash(content);
  return computedHash === expectedHash;
}

/**
 * Compute hash of arbitrary data (for metadata hashing)
 */
export function computeDataHash(data: unknown): string {
  const json = JSON.stringify(data);
  const hash = createHash('sha256');
  hash.update(json);
  return hash.digest('hex');
}
