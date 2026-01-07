# Development Guide

This guide covers setting up a development environment for ContextGraph OS.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** 8+ (package manager)
- **Git**

### Installing pnpm

```bash
npm install -g pnpm
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/akz4ol/contextgraph-os.git
cd contextgraph-os
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build All Packages

```bash
pnpm -r build
```

### 4. Run Tests

```bash
pnpm -r test
```

## Project Structure

```
contextgraph-os/
├── packages/
│   ├── core/           # Branded types, Result pattern, utilities
│   ├── storage/        # Storage abstraction (SQLite, in-memory)
│   ├── ontology/       # Schema definitions and validation
│   ├── ckg/            # Contextual Knowledge Graph
│   ├── provenance/     # Immutable provenance ledger
│   ├── dtg/            # Decision Trace Graph
│   ├── policy/         # Policy rules and evaluation
│   ├── exceptions/     # Exception requests and approvals
│   ├── agent/          # Agent registry and capabilities
│   ├── retrieval/      # Context assembly and filtering
│   ├── execution/      # Action execution framework
│   ├── sdk/            # Unified high-level SDK
│   ├── cli/            # CLI tools and REPL
│   └── demos/          # Demo examples
├── README.md
├── DEVELOPMENT.md      # This file
├── LICENSING.md        # License information
├── LICENSE             # AGPL-3.0 license text
├── package.json        # Root package.json
├── pnpm-workspace.yaml # Workspace configuration
└── tsconfig.json       # Root TypeScript config
```

## Package Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                          demos                               │
│                            │                                 │
│                     ┌──────┴──────┐                         │
│                     ▼             ▼                         │
│                   sdk           cli                         │
│                     │             │                         │
│         ┌───────────┼─────────────┼───────────┐            │
│         ▼           ▼             ▼           ▼            │
│    execution    retrieval     policy    exceptions         │
│         │           │             │           │            │
│         └─────┬─────┴─────────────┴───────────┘            │
│               ▼                                             │
│             agent                                           │
│               │                                             │
│         ┌─────┴─────┐                                      │
│         ▼           ▼                                      │
│       dtg      provenance                                  │
│         │           │                                      │
│         └─────┬─────┘                                      │
│               ▼                                             │
│              ckg                                            │
│               │                                             │
│         ┌─────┼─────┐                                      │
│         ▼     ▼     ▼                                      │
│    ontology storage core                                   │
└─────────────────────────────────────────────────────────────┘
```

## Development Workflow

### Working on a Specific Package

```bash
# Build a specific package
pnpm --filter @contextgraph/sdk build

# Test a specific package
pnpm --filter @contextgraph/sdk test

# Watch mode (if available)
pnpm --filter @contextgraph/sdk test -- --watch
```

### Building Dependencies

When working on a package, ensure its dependencies are built:

```bash
# Build core and its dependents
pnpm --filter @contextgraph/core build
pnpm --filter "@contextgraph/storage" build
# ... etc
```

Or rebuild everything:

```bash
pnpm -r build
```

### Running Demos

```bash
cd packages/demos
pnpm demo:basic    # Basic usage demo
pnpm demo:agent    # Agent workflow demo
```

## TypeScript Configuration

The project uses strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Key TypeScript Patterns

#### Result Type (No Exceptions)

```typescript
import { ok, err, Result } from '@contextgraph/core';

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return err(new Error('Division by zero'));
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // 5
} else {
  console.error(result.error);
}
```

#### Branded Types

```typescript
import { EntityId, ClaimId, createEntityId } from '@contextgraph/core';

// Type-safe IDs prevent mixing different ID types
const entityId: EntityId = createEntityId();
const claimId: ClaimId = createClaimId();

// This would be a compile error:
// const wrong: EntityId = claimId;
```

#### Optional Properties (exactOptionalPropertyTypes)

```typescript
// With exactOptionalPropertyTypes, you can't assign undefined to optional props
interface Options {
  name: string;
  description?: string;  // Can be omitted, but not set to undefined
}

// Correct:
const opts1: Options = { name: 'test' };
const opts2: Options = { name: 'test', description: 'desc' };

// Incorrect (compile error):
// const opts3: Options = { name: 'test', description: undefined };

// To conditionally add optional properties:
const input: Options = { name: 'test' };
if (someCondition) {
  input.description = 'conditional description';
}
```

## Testing

### Running All Tests

```bash
pnpm -r test
```

### Running Specific Tests

```bash
# Run tests in a package
pnpm --filter @contextgraph/core test

# Run a specific test file
pnpm --filter @contextgraph/sdk test -- src/index.test.ts

# Run tests matching a pattern
pnpm --filter @contextgraph/sdk test -- -t "creates entities"
```

### Test Coverage

```bash
pnpm --filter @contextgraph/sdk test -- --coverage
```

## Code Style

### Formatting

The project uses Prettier for formatting:

```bash
# Format all files
pnpm prettier --write .

# Check formatting
pnpm prettier --check .
```

### Linting

ESLint is configured for TypeScript:

```bash
# Lint all files
pnpm eslint packages/*/src

# Fix auto-fixable issues
pnpm eslint packages/*/src --fix
```

## Adding a New Package

1. Create the package directory:

```bash
mkdir -p packages/my-package/src
```

2. Create `package.json`:

```json
{
  "name": "@contextgraph/my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@contextgraph/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

3. Create `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

4. Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.test.ts"]
}
```

5. Create source files in `src/`

6. Install dependencies:

```bash
pnpm install
```

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Demo",
      "program": "${workspaceFolder}/packages/demos/src/basic-usage.ts",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/packages/sdk",
      "console": "integratedTerminal"
    }
  ]
}
```

### Console Debugging

```typescript
import { ContextGraph } from '@contextgraph/sdk';

const result = await ContextGraph.create();
const client = result.value;

// Get detailed stats
const stats = await client.getStats();
console.log(JSON.stringify(stats.value, null, 2));

// Inspect provenance
const prov = await client.queryProvenance({ limit: 10 });
console.log(prov.value);
```

## Common Issues

### "Module not found" Errors

Rebuild all packages:

```bash
pnpm -r build
```

### TypeScript Errors After Pulling

Clear build artifacts and rebuild:

```bash
rm -rf packages/*/dist
pnpm -r build
```

### Test Failures

Ensure you're running the latest build:

```bash
pnpm -r build
pnpm -r test
```

### pnpm Lock File Conflicts

```bash
pnpm install --force
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm -r test`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Resources

- [README.md](./README.md) - Project overview
- [LICENSING.md](./LICENSING.md) - License information
- [packages/demos/README.md](./packages/demos/README.md) - Demo documentation
