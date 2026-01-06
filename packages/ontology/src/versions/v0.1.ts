/**
 * Ontology v0.1 - Initial Version
 *
 * Defines the core entity types, relations, and context dimensions
 * for ContextGraph OS.
 */

import { createOntologyVersion } from '@contextgraph/core';
import { OntologySchemaBuilder, type OntologySchema } from '../schema.js';

const version = createOntologyVersion('0.1.0');

const builder = new OntologySchemaBuilder(
  version,
  'ContextGraph Core Ontology',
  'Core ontology for provenance-first, time-aware knowledge graphs'
);

// ============================================================================
// Base Entity Types
// ============================================================================

builder.addEntity({
  name: 'Entity',
  description: 'Abstract base type for all entities',
  abstract: true,
  properties: [
    { name: 'name', type: 'string', required: false, description: 'Human-readable name' },
    { name: 'description', type: 'string', required: false, description: 'Detailed description' },
    { name: 'metadata', type: 'json', required: false, description: 'Additional metadata' },
  ],
});

// ============================================================================
// Actor Types
// ============================================================================

builder.addEntity({
  name: 'Actor',
  description: 'Abstract base for entities that can perform actions',
  abstract: true,
  extends: 'Entity',
  properties: [],
});

builder.addEntity({
  name: 'Person',
  description: 'A human actor',
  extends: 'Actor',
  properties: [
    { name: 'email', type: 'string', required: false, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    { name: 'role', type: 'string', required: false },
    { name: 'department', type: 'string', required: false },
  ],
});

builder.addEntity({
  name: 'Agent',
  description: 'An AI agent actor',
  extends: 'Actor',
  properties: [
    { name: 'agentType', type: 'string', required: true },
    { name: 'version', type: 'string', required: false },
    { name: 'capabilities', type: 'json', required: false },
  ],
});

builder.addEntity({
  name: 'System',
  description: 'An automated system actor',
  extends: 'Actor',
  properties: [
    { name: 'systemType', type: 'string', required: true },
    { name: 'endpoint', type: 'string', required: false },
  ],
});

// ============================================================================
// Organizational Types
// ============================================================================

builder.addEntity({
  name: 'Organization',
  description: 'An organizational unit',
  extends: 'Entity',
  properties: [
    { name: 'orgType', type: 'string', required: true },
    { name: 'jurisdiction', type: 'string', required: false },
  ],
});

builder.addEntity({
  name: 'Team',
  description: 'A team within an organization',
  extends: 'Entity',
  properties: [
    { name: 'teamType', type: 'string', required: false },
  ],
});

builder.addEntity({
  name: 'Project',
  description: 'A project or initiative',
  extends: 'Entity',
  properties: [
    { name: 'status', type: 'string', required: true },
    { name: 'startDate', type: 'timestamp', required: false },
    { name: 'endDate', type: 'timestamp', required: false },
  ],
});

// ============================================================================
// Document Types
// ============================================================================

builder.addEntity({
  name: 'Document',
  description: 'Abstract base for documents',
  abstract: true,
  extends: 'Entity',
  properties: [
    { name: 'title', type: 'string', required: true },
    { name: 'version', type: 'string', required: false },
    { name: 'status', type: 'string', required: true },
  ],
});

builder.addEntity({
  name: 'Policy',
  description: 'A policy document',
  extends: 'Document',
  properties: [
    { name: 'effectiveFrom', type: 'timestamp', required: true },
    { name: 'effectiveTo', type: 'timestamp', required: false },
    { name: 'scope', type: 'json', required: false },
  ],
});

builder.addEntity({
  name: 'Contract',
  description: 'A contract document',
  extends: 'Document',
  properties: [
    { name: 'contractType', type: 'string', required: true },
    { name: 'value', type: 'number', required: false },
    { name: 'currency', type: 'string', required: false },
  ],
});

// ============================================================================
// Decision Types
// ============================================================================

builder.addEntity({
  name: 'Decision',
  description: 'A recorded decision',
  extends: 'Entity',
  properties: [
    { name: 'decisionType', type: 'string', required: true },
    { name: 'status', type: 'string', required: true },
    { name: 'outcome', type: 'json', required: false },
  ],
});

builder.addEntity({
  name: 'Exception',
  description: 'An exception to a policy',
  extends: 'Entity',
  properties: [
    { name: 'riskLevel', type: 'string', required: true },
    { name: 'justification', type: 'string', required: true },
    { name: 'expiresAt', type: 'timestamp', required: false },
  ],
});

// ============================================================================
// Resource Types
// ============================================================================

builder.addEntity({
  name: 'Resource',
  description: 'Abstract base for resources',
  abstract: true,
  extends: 'Entity',
  properties: [
    { name: 'resourceType', type: 'string', required: true },
  ],
});

builder.addEntity({
  name: 'Asset',
  description: 'A tangible or intangible asset',
  extends: 'Resource',
  properties: [
    { name: 'assetType', type: 'string', required: true },
    { name: 'value', type: 'number', required: false },
  ],
});

builder.addEntity({
  name: 'Tool',
  description: 'A tool or capability available to agents',
  extends: 'Resource',
  properties: [
    { name: 'toolType', type: 'string', required: true },
    { name: 'permissions', type: 'json', required: false },
  ],
});

// ============================================================================
// Relations
// ============================================================================

// Actor relations
builder.addRelation({
  name: 'belongsTo',
  description: 'Actor belongs to an organization or team',
  from: ['Person', 'Agent', 'System'],
  to: ['Organization', 'Team'],
  cardinality: 'many-to-many',
  inverse: 'hasMembers',
});

builder.addRelation({
  name: 'hasMembers',
  description: 'Organization or team has members',
  from: ['Organization', 'Team'],
  to: ['Person', 'Agent', 'System'],
  cardinality: 'one-to-many',
  inverse: 'belongsTo',
});

builder.addRelation({
  name: 'reportsTo',
  description: 'Actor reports to another actor',
  from: ['Person'],
  to: ['Person'],
  cardinality: 'many-to-one',
  inverse: 'manages',
});

builder.addRelation({
  name: 'manages',
  description: 'Actor manages other actors',
  from: ['Person'],
  to: ['Person'],
  cardinality: 'one-to-many',
  inverse: 'reportsTo',
});

// Organizational relations
builder.addRelation({
  name: 'parentOf',
  description: 'Parent organization',
  from: ['Organization'],
  to: ['Organization', 'Team'],
  cardinality: 'one-to-many',
  inverse: 'childOf',
});

builder.addRelation({
  name: 'childOf',
  description: 'Child of organization',
  from: ['Organization', 'Team'],
  to: ['Organization'],
  cardinality: 'many-to-one',
  inverse: 'parentOf',
});

// Project relations
builder.addRelation({
  name: 'worksOn',
  description: 'Actor works on a project',
  from: ['Person', 'Agent', 'Team'],
  to: ['Project'],
  cardinality: 'many-to-many',
  inverse: 'hasWorkers',
});

builder.addRelation({
  name: 'hasWorkers',
  description: 'Project has workers',
  from: ['Project'],
  to: ['Person', 'Agent', 'Team'],
  cardinality: 'many-to-many',
  inverse: 'worksOn',
});

builder.addRelation({
  name: 'owns',
  description: 'Actor or organization owns a project or resource',
  from: ['Person', 'Organization', 'Team'],
  to: ['Project', 'Asset', 'Document'],
  cardinality: 'one-to-many',
  inverse: 'ownedBy',
});

builder.addRelation({
  name: 'ownedBy',
  description: 'Resource is owned by an actor',
  from: ['Project', 'Asset', 'Document'],
  to: ['Person', 'Organization', 'Team'],
  cardinality: 'many-to-one',
  inverse: 'owns',
});

// Decision relations
builder.addRelation({
  name: 'proposedBy',
  description: 'Decision proposed by an actor',
  from: ['Decision'],
  to: ['Person', 'Agent'],
  cardinality: 'many-to-one',
});

builder.addRelation({
  name: 'approvedBy',
  description: 'Decision approved by an actor',
  from: ['Decision'],
  to: ['Person'],
  cardinality: 'many-to-many',
});

builder.addRelation({
  name: 'relatesTo',
  description: 'Decision relates to an entity',
  from: ['Decision'],
  to: ['Entity'],
  cardinality: 'many-to-many',
});

builder.addRelation({
  name: 'precedentFor',
  description: 'Decision serves as precedent for another',
  from: ['Decision'],
  to: ['Decision'],
  cardinality: 'many-to-many',
});

// Exception relations
builder.addRelation({
  name: 'exceptionTo',
  description: 'Exception to a policy',
  from: ['Exception'],
  to: ['Policy'],
  cardinality: 'many-to-many',
});

builder.addRelation({
  name: 'requestedBy',
  description: 'Exception requested by an actor',
  from: ['Exception'],
  to: ['Person', 'Agent'],
  cardinality: 'many-to-one',
});

builder.addRelation({
  name: 'grantedBy',
  description: 'Exception granted by an actor',
  from: ['Exception'],
  to: ['Person'],
  cardinality: 'many-to-many',
});

// Policy relations
builder.addRelation({
  name: 'governs',
  description: 'Policy governs an entity type or scope',
  from: ['Policy'],
  to: ['Organization', 'Team', 'Project', 'Tool'],
  cardinality: 'many-to-many',
});

builder.addRelation({
  name: 'supersedes',
  description: 'Policy supersedes an older policy',
  from: ['Policy'],
  to: ['Policy'],
  cardinality: 'one-to-one',
  inverse: 'supersededBy',
});

builder.addRelation({
  name: 'supersededBy',
  description: 'Policy is superseded by a newer policy',
  from: ['Policy'],
  to: ['Policy'],
  cardinality: 'one-to-one',
  inverse: 'supersedes',
});

// Agent relations
builder.addRelation({
  name: 'canUse',
  description: 'Agent can use a tool',
  from: ['Agent'],
  to: ['Tool'],
  cardinality: 'many-to-many',
});

builder.addRelation({
  name: 'constrainedBy',
  description: 'Agent is constrained by a policy',
  from: ['Agent'],
  to: ['Policy'],
  cardinality: 'many-to-many',
});

// ============================================================================
// Context Dimensions
// ============================================================================

builder.addContextDimension({
  name: 'temporal',
  description: 'Time interval when the claim is valid',
  type: 'temporal',
  required: true,
});

builder.addContextDimension({
  name: 'jurisdiction',
  description: 'Geographic or regulatory jurisdiction',
  type: 'jurisdiction',
  required: false,
});

builder.addContextDimension({
  name: 'scope',
  description: 'Organizational scope',
  type: 'scope',
  required: false,
});

builder.addContextDimension({
  name: 'confidence',
  description: 'Confidence level (0-1)',
  type: 'confidence',
  required: false,
});

// Build and export the ontology
export const ontologyV0_1: OntologySchema = builder.build();
