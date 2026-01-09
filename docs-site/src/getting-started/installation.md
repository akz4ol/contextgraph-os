# Installation

## Requirements

- **Node.js**: 18.0.0 or higher
- **Package Manager**: pnpm (recommended), npm, or yarn
- **TypeScript**: 5.0+ (for development)

## Installation Methods

### From Source (Recommended)

```bash
# Clone the repository
git clone https://github.com/akz4ol/contextgraph-os.git
cd contextgraph-os

# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Verify installation
pnpm -r test
```

### Individual Packages

Install only the packages you need:

```bash
# Core SDK (includes most functionality)
pnpm add @contextgraph/sdk

# Or install individual packages
pnpm add @contextgraph/core
pnpm add @contextgraph/storage
pnpm add @contextgraph/ckg
pnpm add @contextgraph/provenance
```

## Package Dependencies

Here's how packages depend on each other:

```
@contextgraph/core (no dependencies)
    └── @contextgraph/storage
        └── @contextgraph/ontology
            ├── @contextgraph/ckg
            ├── @contextgraph/provenance
            └── @contextgraph/dtg
                ├── @contextgraph/policy
                ├── @contextgraph/agent
                └── @contextgraph/execution
                    └── @contextgraph/sdk
```

## Configuration

### TypeScript Configuration

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  }
}
```

### Storage Configuration

ContextGraph supports multiple storage backends:

#### In-Memory (Default)

```typescript
import { ContextGraph } from '@contextgraph/sdk';

const client = await ContextGraph.create({
  storage: { type: 'memory' }
});
```

#### SQLite

```typescript
const client = await ContextGraph.create({
  storage: {
    type: 'sqlite',
    path: './contextgraph.db'
  }
});
```

## Development Setup

For contributing or modifying ContextGraph:

```bash
# Clone and setup
git clone https://github.com/akz4ol/contextgraph-os.git
cd contextgraph-os
pnpm install

# Build in watch mode
pnpm -r build:watch

# Run tests in watch mode
pnpm -r test:watch

# Run specific package tests
pnpm --filter @contextgraph/sdk test
```

## Docker Setup (Coming Soon)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm -r build

EXPOSE 3000
CMD ["npx", "contextgraph-api"]
```

## Troubleshooting

### Build Errors

If you encounter TypeScript errors:

```bash
# Clean and rebuild
pnpm -r clean
pnpm -r build
```

### Module Resolution Issues

Ensure your project uses ES modules:

```json
// package.json
{
  "type": "module"
}
```

### Missing Dependencies

```bash
# Reinstall all dependencies
rm -rf node_modules
pnpm install
```

## Next Steps

- [Quick Start](./quick-start.md) - Build your first app
- [Architecture](./architecture.md) - Understand the design
