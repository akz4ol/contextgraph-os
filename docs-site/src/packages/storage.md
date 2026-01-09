# @contextgraph/storage

Storage abstraction layer with SQLite and in-memory implementations.

## Installation

```bash
pnpm add @contextgraph/storage
```

## Storage Interface

All storage backends implement the `StorageInterface`:

```typescript
interface StorageInterface {
  // Basic operations
  get<T>(key: string): Promise<Result<T | null>>;
  set<T>(key: string, value: T): Promise<Result<void>>;
  delete(key: string): Promise<Result<void>>;
  has(key: string): Promise<Result<boolean>>;

  // Batch operations
  getMany<T>(keys: string[]): Promise<Result<Map<string, T>>>;
  setMany<T>(entries: Map<string, T>): Promise<Result<void>>;
  deleteMany(keys: string[]): Promise<Result<void>>;

  // List and query
  list<T>(prefix: string, options?: ListOptions): Promise<Result<T[]>>;
  query<T>(query: Query): Promise<Result<T[]>>;
  count(prefix: string): Promise<Result<number>>;

  // Lifecycle
  initialize(): Promise<Result<void>>;
  close(): Promise<Result<void>>;
  clear(): Promise<Result<void>>;
}
```

## In-Memory Storage

Fast, ephemeral storage ideal for testing and development:

```typescript
import { createInMemoryStorage } from '@contextgraph/storage';

const storage = createInMemoryStorage();
await storage.initialize();

// Use storage
await storage.set('key', { name: 'value' });
const result = await storage.get('key');
```

### Features

- Zero dependencies
- Fast operations
- Perfect for testing
- Data lost on restart

## SQLite Storage

Persistent storage for production use:

```typescript
import { createSQLiteStorage } from '@contextgraph/storage';

const storage = createSQLiteStorage({
  path: './contextgraph.db',
  // Optional configuration
  wal: true,
  busyTimeout: 5000,
});

await storage.initialize();
```

### Features

- ACID compliance
- Persistent storage
- WAL mode support
- Full-text search (planned)

### Configuration

```typescript
interface SQLiteStorageConfig {
  path: string;
  wal?: boolean;           // Enable WAL mode (default: true)
  busyTimeout?: number;    // Busy timeout in ms (default: 5000)
  pageSize?: number;       // Page size (default: 4096)
}
```

## Queries

### List with Prefix

```typescript
// List all entities
const entities = await storage.list('entity:');

// List with options
const recent = await storage.list('entity:', {
  limit: 10,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

### Query with Filters

```typescript
const results = await storage.query({
  prefix: 'entity:',
  filters: [
    { field: 'type', operator: 'eq', value: 'person' },
    { field: 'createdAt', operator: 'gt', value: timestamp },
  ],
  limit: 50,
});
```

### Query Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equals |
| `ne` | Not equals |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `in` | In array |
| `nin` | Not in array |
| `contains` | Contains substring |
| `startsWith` | Starts with |
| `endsWith` | Ends with |

## Batch Operations

```typescript
// Get multiple keys
const entries = await storage.getMany(['key1', 'key2', 'key3']);

// Set multiple entries
await storage.setMany(new Map([
  ['key1', value1],
  ['key2', value2],
]));

// Delete multiple keys
await storage.deleteMany(['key1', 'key2']);
```

## Indexing

The storage layer supports indexes for optimized queries:

```typescript
// Create index (SQLite)
await storage.createIndex('entity:type', {
  fields: ['type', 'createdAt'],
  unique: false,
});
```

## Query Optimization

For frequent query patterns, use the query optimizer:

```typescript
import { QueryOptimizer } from '@contextgraph/storage';

const optimizer = new QueryOptimizer(storage);

// Optimize query
const optimizedQuery = optimizer.optimize({
  prefix: 'entity:',
  filters: [...],
  limit: 100,
});
```

## Custom Storage Backends

Implement `StorageInterface` for custom backends:

```typescript
import type { StorageInterface, Result } from '@contextgraph/storage';

class RedisStorage implements StorageInterface {
  constructor(private client: RedisClient) {}

  async get<T>(key: string): Promise<Result<T | null>> {
    const value = await this.client.get(key);
    return ok(value ? JSON.parse(value) : null);
  }

  async set<T>(key: string, value: T): Promise<Result<void>> {
    await this.client.set(key, JSON.stringify(value));
    return ok(undefined);
  }

  // Implement remaining methods...
}
```

## Storage Factory

Use the factory for flexible configuration:

```typescript
import { createStorage } from '@contextgraph/storage';

// Memory
const memStorage = createStorage({ type: 'memory' });

// SQLite
const sqliteStorage = createStorage({
  type: 'sqlite',
  path: './data.db',
});
```
