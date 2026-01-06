/**
 * Provenance Types
 *
 * Defines the core types for tracking data provenance and lineage.
 */

import { type ProvenanceId, type Timestamp } from '@contextgraph/core';

/**
 * Source type enumeration
 */
export type SourceType =
  | 'human'
  | 'agent'
  | 'system'
  | 'external_api'
  | 'document'
  | 'database'
  | 'derived';

/**
 * Action type enumeration
 */
export type ActionType =
  | 'create'
  | 'update'
  | 'derive'
  | 'import'
  | 'transform'
  | 'validate'
  | 'approve'
  | 'reject'
  | 'execute';

/**
 * Reference to another artifact (claim, entity, decision, etc.)
 */
export interface ArtifactRef {
  readonly type: 'claim' | 'entity' | 'decision' | 'provenance' | 'policy';
  readonly id: string;
}

/**
 * Provenance entry data structure
 */
export interface ProvenanceData {
  readonly id: ProvenanceId;
  /** Type of source */
  readonly sourceType: SourceType;
  /** Source identifier (e.g., user ID, agent ID, system name) */
  readonly sourceId: string | undefined;
  /** Source URI (e.g., API endpoint, document URL) */
  readonly sourceUri: string | undefined;
  /** Actor who performed the action */
  readonly actor: string | undefined;
  /** Action that was performed */
  readonly action: ActionType;
  /** References to input artifacts */
  readonly inputRefs: readonly ArtifactRef[];
  /** References to output artifacts */
  readonly outputRefs: readonly ArtifactRef[];
  /** When the action occurred */
  readonly timestamp: Timestamp;
  /** Additional metadata */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Hash of this entry's content */
  readonly hash: string;
  /** Hash of the previous entry (for chain integrity) */
  readonly previousHash: string | undefined;
  /** When the record was created */
  readonly createdAt: Timestamp;
}

/**
 * Provenance storage record format
 */
export interface ProvenanceRecord {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string | null;
  readonly sourceUri: string | null;
  readonly actor: string | null;
  readonly action: string;
  readonly inputRefs: string | null;
  readonly outputRefs: string | null;
  readonly timestamp: Timestamp;
  readonly metadata: string | null;
  readonly hash: string;
  readonly previousHash: string | null;
  readonly createdAt: Timestamp;
  [key: string]: unknown;
}

/**
 * Input for creating a new provenance entry
 */
export interface CreateProvenanceInput {
  readonly sourceType: SourceType;
  readonly sourceId?: string;
  readonly sourceUri?: string;
  readonly actor?: string;
  readonly action: ActionType;
  readonly inputRefs?: readonly ArtifactRef[];
  readonly outputRefs?: readonly ArtifactRef[];
  readonly timestamp?: Timestamp;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Query options for provenance
 */
export interface ProvenanceQueryOptions {
  readonly sourceType?: SourceType;
  readonly actor?: string;
  readonly action?: ActionType;
  readonly timeRange?: {
    readonly start: Timestamp;
    readonly end: Timestamp;
  };
  readonly limit?: number;
  readonly offset?: number;
}
