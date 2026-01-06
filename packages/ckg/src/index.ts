/**
 * @contextgraph/ckg
 *
 * Contextual Knowledge Graph implementation.
 * Provides claims with contextual qualifiers and entity management.
 */

export { Entity, type EntityData, EntityRepository } from './entity.js';
export { Claim, type ClaimData, ClaimRepository } from './claim.js';
export { ContextFilter, type ContextFilterOptions, type FilteredClaimSet } from './context-filter.js';
export { CKG, type CKGOptions } from './ckg.js';
