/**
 * Code Generation
 *
 * Generate TypeScript types and Zod validators from ontology schemas.
 */

import type {
  OntologySchema,
  EntityDefinition,
  RelationDefinition,
  PropertyDefinition,
  ContextDimensionDefinition,
} from './schema.js';

/**
 * Code generation options
 */
export interface CodegenOptions {
  /** Include JSDoc comments */
  includeComments?: boolean;
  /** Include readonly modifiers */
  readonly?: boolean;
  /** Export types */
  export?: boolean;
  /** Include timestamp as Date type instead of number */
  timestampAsDate?: boolean;
  /** Namespace for generated types */
  namespace?: string;
}

const DEFAULT_OPTIONS: CodegenOptions = {
  includeComments: true,
  readonly: true,
  export: true,
  timestampAsDate: false,
};

/**
 * Map property type to TypeScript type
 */
function propertyTypeToTS(prop: PropertyDefinition, options: CodegenOptions): string {
  switch (prop.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'timestamp':
      return options.timestampAsDate === true ? 'Date' : 'number';
    case 'json':
      return 'unknown';
    case 'reference':
      return 'string'; // Entity ID
    default:
      return 'unknown';
  }
}

/**
 * Map property type to Zod schema
 */
function propertyTypeToZod(prop: PropertyDefinition, options: CodegenOptions): string {
  let zodType: string;

  switch (prop.type) {
    case 'string':
      zodType = 'z.string()';
      if (prop.pattern !== undefined) {
        zodType += `.regex(/${prop.pattern}/)`;
      }
      break;
    case 'number':
      zodType = 'z.number()';
      if (prop.min !== undefined) {
        zodType += `.min(${prop.min})`;
      }
      if (prop.max !== undefined) {
        zodType += `.max(${prop.max})`;
      }
      break;
    case 'boolean':
      zodType = 'z.boolean()';
      break;
    case 'timestamp':
      if (options.timestampAsDate === true) {
        zodType = 'z.date()';
      } else {
        zodType = 'z.number().int().min(0)';
      }
      break;
    case 'json':
      zodType = 'z.unknown()';
      break;
    case 'reference':
      zodType = 'z.string()';
      if (prop.refTypes !== undefined && prop.refTypes.length > 0) {
        // Add comment about valid reference types
        zodType += ` /* ref: ${prop.refTypes.join(' | ')} */`;
      }
      break;
    default:
      zodType = 'z.unknown()';
  }

  if (!prop.required) {
    zodType += '.optional()';
  }

  return zodType;
}

/**
 * Generate JSDoc comment
 */
function generateJSDoc(description: string, indent: string = ''): string {
  return `${indent}/**\n${indent} * ${description}\n${indent} */\n`;
}

/**
 * Convert entity name to valid TypeScript identifier
 */
function toTypeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Convert entity name to valid variable name
 */
function toVarName(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Build entity index from schema
 */
function buildEntityIndex(schema: OntologySchema): Map<string, EntityDefinition> {
  const index = new Map<string, EntityDefinition>();
  for (const entity of schema.entities) {
    index.set(entity.name, entity);
  }
  return index;
}

/**
 * Generate TypeScript interface for an entity
 */
function generateEntityInterface(
  entity: EntityDefinition,
  _entityIndex: Map<string, EntityDefinition>,
  options: CodegenOptions
): string {
  const lines: string[] = [];
  const typeName = toTypeName(entity.name);
  const exportKw = options.export === true ? 'export ' : '';
  const readonlyMod = options.readonly === true ? 'readonly ' : '';

  // JSDoc
  if (options.includeComments === true) {
    lines.push(generateJSDoc(entity.description));
  }

  // Interface declaration
  if (entity.extends !== undefined) {
    lines.push(`${exportKw}interface ${typeName} extends ${toTypeName(entity.extends)} {`);
  } else {
    lines.push(`${exportKw}interface ${typeName} {`);
  }

  // Only output own properties (not inherited)
  for (const prop of entity.properties) {
    if (options.includeComments === true && prop.description !== undefined) {
      lines.push(`  /** ${prop.description} */`);
    }

    const optionalMark = prop.required ? '' : '?';
    const tsType = propertyTypeToTS(prop, options);
    lines.push(`  ${readonlyMod}${prop.name}${optionalMark}: ${tsType};`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate Zod schema for an entity
 */
function generateEntityZodSchema(
  entity: EntityDefinition,
  _entityIndex: Map<string, EntityDefinition>,
  options: CodegenOptions
): string {
  const lines: string[] = [];
  const schemaName = `${toVarName(entity.name)}Schema`;
  const exportKw = options.export === true ? 'export ' : '';

  // JSDoc
  if (options.includeComments === true) {
    lines.push(generateJSDoc(`Zod schema for ${entity.name}`));
  }

  // Schema declaration
  if (entity.extends !== undefined) {
    const parentSchemaName = `${toVarName(entity.extends)}Schema`;
    lines.push(`${exportKw}const ${schemaName} = ${parentSchemaName}.extend({`);
  } else {
    lines.push(`${exportKw}const ${schemaName} = z.object({`);
  }

  // Only output own properties (not inherited when extending)
  for (const prop of entity.properties) {
    const zodType = propertyTypeToZod(prop, options);
    lines.push(`  ${prop.name}: ${zodType},`);
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate TypeScript type for a relation
 */
function generateRelationType(
  relation: RelationDefinition,
  options: CodegenOptions
): string {
  const lines: string[] = [];
  const typeName = `${toTypeName(relation.name)}Relation`;
  const exportKw = options.export === true ? 'export ' : '';
  const readonlyMod = options.readonly === true ? 'readonly ' : '';

  // JSDoc
  if (options.includeComments === true) {
    lines.push(generateJSDoc(relation.description));
  }

  lines.push(`${exportKw}interface ${typeName} {`);
  lines.push(`  ${readonlyMod}name: '${relation.name}';`);
  lines.push(`  ${readonlyMod}from: ${relation.from.map((t) => `'${t}'`).join(' | ')};`);
  lines.push(`  ${readonlyMod}to: ${relation.to.map((t) => `'${t}'`).join(' | ')};`);
  lines.push(`  ${readonlyMod}cardinality: '${relation.cardinality}';`);

  if (relation.properties !== undefined && relation.properties.length > 0) {
    lines.push(`  ${readonlyMod}properties: {`);
    for (const prop of relation.properties) {
      const optionalMark = prop.required ? '' : '?';
      const tsType = propertyTypeToTS(prop, options);
      lines.push(`    ${readonlyMod}${prop.name}${optionalMark}: ${tsType};`);
    }
    lines.push('  };');
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate TypeScript type for context dimensions
 */
function generateContextType(
  dimension: ContextDimensionDefinition,
  options: CodegenOptions
): string {
  const lines: string[] = [];
  const typeName = `${toTypeName(dimension.name)}Context`;
  const exportKw = options.export === true ? 'export ' : '';

  // JSDoc
  if (options.includeComments === true) {
    lines.push(generateJSDoc(dimension.description));
  }

  if (dimension.allowedValues !== undefined && dimension.allowedValues.length > 0) {
    const values = dimension.allowedValues.map((v) => `'${v}'`).join(' | ');
    lines.push(`${exportKw}type ${typeName} = ${values};`);
  } else {
    // Default types based on dimension type
    switch (dimension.type) {
      case 'temporal':
        lines.push(`${exportKw}interface ${typeName} {`);
        lines.push(`  validFrom: number;`);
        lines.push(`  validUntil?: number;`);
        lines.push('}');
        break;
      case 'confidence':
        lines.push(`${exportKw}type ${typeName} = number; // 0.0 - 1.0`);
        break;
      case 'jurisdiction':
      case 'scope':
      case 'custom':
      default:
        lines.push(`${exportKw}type ${typeName} = string;`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate all TypeScript types from schema
 */
export function generateTypes(
  schema: OntologySchema,
  options: Partial<CodegenOptions> = {}
): string {
  const opts: CodegenOptions = { ...DEFAULT_OPTIONS, ...options };
  const entityIndex = buildEntityIndex(schema);

  const lines: string[] = [];

  // Header
  lines.push('/**');
  lines.push(` * Generated TypeScript types from ${schema.name}`);
  lines.push(` * Schema version: ${schema.version}`);
  lines.push(' * ');
  lines.push(' * DO NOT EDIT - This file is auto-generated');
  lines.push(' */');
  lines.push('');

  // Namespace wrapper if specified
  if (opts.namespace !== undefined) {
    lines.push(`export namespace ${opts.namespace} {`);
  }

  // Generate entity interfaces
  lines.push('// Entity Types');
  lines.push('');

  // Sort entities by inheritance order (base types first)
  const sortedEntities = sortEntitiesByInheritance(schema.entities);

  for (const entity of sortedEntities) {
    lines.push(generateEntityInterface(entity, entityIndex, opts));
  }

  // Generate relation types
  if (schema.relations.length > 0) {
    lines.push('// Relation Types');
    lines.push('');

    for (const relation of schema.relations) {
      lines.push(generateRelationType(relation, opts));
    }
  }

  // Generate context dimension types
  if (schema.contextDimensions.length > 0) {
    lines.push('// Context Dimension Types');
    lines.push('');

    for (const dimension of schema.contextDimensions) {
      lines.push(generateContextType(dimension, opts));
    }
  }

  // Generate entity type union
  const concreteEntities = schema.entities.filter((e) => e.abstract !== true);
  if (concreteEntities.length > 0) {
    lines.push('// Entity Type Union');
    const entityTypes = concreteEntities.map((e) => toTypeName(e.name)).join(' | ');
    lines.push(`${opts.export === true ? 'export ' : ''}type AnyEntity = ${entityTypes};`);
    lines.push('');

    // Entity type name literal union
    const entityNames = concreteEntities.map((e) => `'${e.name}'`).join(' | ');
    lines.push(`${opts.export === true ? 'export ' : ''}type EntityTypeName = ${entityNames};`);
    lines.push('');
  }

  // Close namespace
  if (opts.namespace !== undefined) {
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate Zod validators from schema
 */
export function generateValidators(
  schema: OntologySchema,
  options: Partial<CodegenOptions> = {}
): string {
  const opts: CodegenOptions = { ...DEFAULT_OPTIONS, ...options };
  const entityIndex = buildEntityIndex(schema);

  const lines: string[] = [];

  // Header
  lines.push('/**');
  lines.push(` * Generated Zod validators from ${schema.name}`);
  lines.push(` * Schema version: ${schema.version}`);
  lines.push(' * ');
  lines.push(' * DO NOT EDIT - This file is auto-generated');
  lines.push(' */');
  lines.push('');
  lines.push("import { z } from 'zod';");
  lines.push('');

  // Generate entity schemas
  lines.push('// Entity Schemas');
  lines.push('');

  // Sort entities by inheritance order (base types first)
  const sortedEntities = sortEntitiesByInheritance(schema.entities);

  for (const entity of sortedEntities) {
    lines.push(generateEntityZodSchema(entity, entityIndex, opts));
  }

  // Generate entity schema map
  const concreteEntities = schema.entities.filter((e) => e.abstract !== true);
  if (concreteEntities.length > 0) {
    lines.push('// Entity Schema Map');
    lines.push(`${opts.export === true ? 'export ' : ''}const entitySchemas = {`);
    for (const entity of concreteEntities) {
      const schemaName = `${toVarName(entity.name)}Schema`;
      lines.push(`  '${entity.name}': ${schemaName},`);
    }
    lines.push('} as const;');
    lines.push('');

    // Inferred types
    lines.push('// Inferred Types');
    for (const entity of sortedEntities) {
      const typeName = toTypeName(entity.name);
      const schemaName = `${toVarName(entity.name)}Schema`;
      lines.push(`${opts.export === true ? 'export ' : ''}type ${typeName} = z.infer<typeof ${schemaName}>;`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate documentation from schema
 */
export function generateDocs(
  schema: OntologySchema,
  format: 'markdown' | 'json' = 'markdown'
): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        name: schema.name,
        version: schema.version,
        description: schema.description,
        entities: schema.entities.map((e) => ({
          name: e.name,
          description: e.description,
          extends: e.extends,
          abstract: e.abstract,
          properties: e.properties,
        })),
        relations: schema.relations.map((r) => ({
          name: r.name,
          description: r.description,
          from: r.from,
          to: r.to,
          cardinality: r.cardinality,
          inverse: r.inverse,
        })),
        contextDimensions: schema.contextDimensions,
      },
      null,
      2
    );
  }

  // Markdown format
  const lines: string[] = [];

  lines.push(`# ${schema.name}`);
  lines.push('');
  lines.push(`**Version:** ${schema.version}`);
  lines.push('');
  lines.push(schema.description);
  lines.push('');

  // Entities
  lines.push('## Entities');
  lines.push('');

  for (const entity of schema.entities) {
    const abstractMark = entity.abstract === true ? ' *(abstract)*' : '';
    const extendsMark = entity.extends !== undefined ? ` extends \`${entity.extends}\`` : '';
    lines.push(`### ${entity.name}${abstractMark}${extendsMark}`);
    lines.push('');
    lines.push(entity.description);
    lines.push('');

    if (entity.properties.length > 0) {
      lines.push('| Property | Type | Required | Description |');
      lines.push('|----------|------|----------|-------------|');
      for (const prop of entity.properties) {
        const req = prop.required ? 'Yes' : 'No';
        const desc = prop.description ?? '-';
        lines.push(`| \`${prop.name}\` | ${prop.type} | ${req} | ${desc} |`);
      }
      lines.push('');
    }
  }

  // Relations
  if (schema.relations.length > 0) {
    lines.push('## Relations');
    lines.push('');

    for (const relation of schema.relations) {
      lines.push(`### ${relation.name}`);
      lines.push('');
      lines.push(relation.description);
      lines.push('');
      lines.push(`- **From:** ${relation.from.join(', ')}`);
      lines.push(`- **To:** ${relation.to.join(', ')}`);
      lines.push(`- **Cardinality:** ${relation.cardinality}`);
      if (relation.inverse !== undefined) {
        lines.push(`- **Inverse:** ${relation.inverse}`);
      }
      lines.push('');
    }
  }

  // Context Dimensions
  if (schema.contextDimensions.length > 0) {
    lines.push('## Context Dimensions');
    lines.push('');

    for (const dim of schema.contextDimensions) {
      const reqMark = dim.required ? ' *(required)*' : '';
      lines.push(`### ${dim.name}${reqMark}`);
      lines.push('');
      lines.push(dim.description);
      lines.push('');
      lines.push(`- **Type:** ${dim.type}`);
      if (dim.allowedValues !== undefined) {
        lines.push(`- **Allowed Values:** ${dim.allowedValues.join(', ')}`);
      }
      lines.push('');
    }
  }

  // Changelog
  if (schema.changelog !== undefined && schema.changelog.length > 0) {
    lines.push('## Changelog');
    lines.push('');
    for (const entry of schema.changelog) {
      lines.push(`- ${entry}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Sort entities by inheritance order (base types first)
 */
function sortEntitiesByInheritance(
  entities: readonly EntityDefinition[]
): EntityDefinition[] {
  const result: EntityDefinition[] = [];
  const remaining = new Set(entities.map((e) => e.name));
  const added = new Set<string>();

  while (remaining.size > 0) {
    for (const entity of entities) {
      if (!remaining.has(entity.name)) continue;

      // Check if parent is already added or entity has no parent
      if (entity.extends === undefined || added.has(entity.extends)) {
        result.push(entity);
        remaining.delete(entity.name);
        added.add(entity.name);
      }
    }
  }

  return result;
}
