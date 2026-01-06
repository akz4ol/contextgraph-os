/**
 * @contextgraph/provenance
 *
 * Immutable provenance ledger for ContextGraph OS.
 * Tracks data lineage with hash-linked chains for integrity verification.
 */

export {
  type SourceType,
  type ActionType,
  type ArtifactRef,
  type ProvenanceData,
  type ProvenanceRecord,
  type CreateProvenanceInput,
  type ProvenanceQueryOptions,
} from './types.js';

export {
  ProvenanceEntry,
} from './entry.js';

export {
  ProvenanceLedger,
  ProvenanceLedgerError,
  type ChainVerificationResult,
} from './ledger.js';

export {
  computeProvenanceHash,
  verifyProvenanceHash,
  computeDataHash,
} from './hash.js';
