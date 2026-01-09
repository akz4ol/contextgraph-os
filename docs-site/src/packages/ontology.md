# @contextgraph/ontology

Schema definitions, versioning, and validation for ContextGraph data structures.

## Installation

```bash
pnpm add @contextgraph/ontology
```

## Overview

The ontology package provides:

- Schema definitions for entities and claims
- Schema versioning and migration
- Validation of data against schemas
- Code generation from schemas

## Defining Schemas

```typescript
import { defineSchema, SchemaBuilder } from '@contextgraph/ontology';

const personSchema = defineSchema({
  name: 'person',
  version: '1.0.0',
  fields: {
    firstName: { type: 'string', required: true },
    lastName: { type: 'string', required: true },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', min: 0, max: 150 },
    department: { type: 'string', enum: ['Engineering', 'Product', 'Sales'] },
  },
});
```

## Validation

```typescript
import { validate } from '@contextgraph/ontology';

const result = validate(personSchema, {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  age: 30,
});

if (!result.valid) {
  console.log('Validation errors:', result.errors);
}
```

## Schema Versioning

```typescript
import { SchemaRegistry } from '@contextgraph/ontology';

const registry = new SchemaRegistry(storage);

// Register schema
await registry.register(personSchema);

// Get latest version
const latest = await registry.getLatest('person');

// Get specific version
const v1 = await registry.get('person', '1.0.0');

// List all versions
const versions = await registry.listVersions('person');
```

## Schema Migration

```typescript
import { createMigration } from '@contextgraph/ontology';

const migration = createMigration({
  from: '1.0.0',
  to: '2.0.0',
  schema: 'person',
  up: (data) => ({
    ...data,
    fullName: `${data.firstName} ${data.lastName}`,
  }),
  down: (data) => {
    const [firstName, lastName] = data.fullName.split(' ');
    return { ...data, firstName, lastName };
  },
});

await registry.registerMigration(migration);
```

## Field Types

| Type | Description |
|------|-------------|
| `string` | Text values |
| `number` | Numeric values |
| `boolean` | True/false |
| `array` | Array of items |
| `object` | Nested object |
| `date` | ISO 8601 date |
| `timestamp` | ISO 8601 timestamp |
| `entityRef` | Reference to entity |

## Field Options

```typescript
{
  type: 'string',
  required: true,
  default: 'default value',
  min: 1,              // min length for string
  max: 100,            // max length for string
  pattern: '^[A-Z]+$', // regex pattern
  format: 'email',     // built-in formats
  enum: ['a', 'b'],    // allowed values
}
```

## Code Generation

Generate TypeScript types from schemas:

```typescript
import { generateTypes } from '@contextgraph/ontology';

const code = generateTypes(personSchema);
// Outputs TypeScript interface
```
