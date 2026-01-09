# Contributing

Thank you for your interest in contributing to ContextGraph OS!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Build: `pnpm -r build`
5. Run tests: `pnpm -r test`

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commits:

```
feat: add new visualization format
fix: resolve policy evaluation order
docs: update SDK documentation
refactor: simplify storage interface
test: add CKG integration tests
```

### Pull Requests

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Update documentation
5. Submit PR with description

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- 100% test coverage for new code

## Testing

```bash
# Run all tests
pnpm -r test

# Run specific package tests
pnpm --filter @contextgraph/sdk test

# Run with coverage
pnpm -r test:coverage
```

## Documentation

- Update relevant docs for any API changes
- Add JSDoc comments to public APIs
- Include examples in documentation

## Questions?

Open an issue for questions or discussions.
