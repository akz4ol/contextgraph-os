/**
 * @contextgraph/ontology
 *
 * Ontology definitions and validation for ContextGraph OS.
 * Provides versioned semantic contracts for all graph objects.
 */

export { OntologySchemaBuilder, type OntologySchema, type EntityDefinition, type RelationDefinition, type ContextDimensionDefinition, type PropertyDefinition } from './schema.js';
export { OntologyLoader, type LoadedOntology } from './loader.js';
export { OntologyValidator, type ValidationResult, type ValidationError, type ValidationWarning, type EntityInput, type ClaimInput } from './validator.js';
export { ontologyV0_1 } from './versions/v0.1.js';
export { generateTypes, generateValidators, generateDocs, type CodegenOptions } from './codegen.js';
