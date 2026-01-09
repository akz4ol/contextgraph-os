# Changelog

All notable changes to ContextGraph OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-09

### Added

#### Phase 2: Enterprise Features (Complete)

**Policy Templates & Simulation** (`@contextgraph/policy`)
- 6 built-in policy templates: `read-only`, `pii-protection`, `approval-required`, `rate-limit`, `time-based`, `jurisdiction`
- `PolicyTemplateManager` for loading and customizing templates with variable substitution
- `PolicySimulator` for testing policies without side effects
- Dry-run mode, scenario testing, and coverage reports
- Policy comparison for analyzing differences

**Agent Hierarchies & Delegation** (`@contextgraph/agent`)
- `AgentHierarchyManager` for parent-child agent relationships
- Capability delegation between agents with audit trails
- Cascade operations: `cascadeSuspend`, `cascadeRevoke`, `cascadeReactivate`
- Ancestor/descendant queries and hierarchy visualization
- Supervision rules with `requiresParentApproval`

#### Phase 3: Developer Experience (Started)

**OpenTelemetry Integration** (`@contextgraph/telemetry`) - NEW PACKAGE
- **Tracing**: `Span` and `Tracer` classes with W3C Trace Context support
- **Metrics**: `Counter`, `Gauge`, `Histogram` with `Meter` factory
- **Logging**: Structured `Logger` with levels, handlers, and span correlation
- **Exporters**:
  - `ConsoleExporter` for development
  - `MemoryExporter` for testing
  - `OTLPJsonExporter` for Jaeger/Prometheus/OTLP backends
  - `MultiExporter` for fan-out to multiple backends
- `TelemetryProvider` for centralized management
- Pre-defined ContextGraph metrics (entities, claims, executions, etc.)
- `recordOperation` helper for easy instrumentation

### Changed

- Total test count: 475 → 646 tests (+171)
- Total packages: 18 → 19 packages

### Fixed

- Policy simulation now works correctly with draft policies
- Agent hierarchy delegation respects capability expiration

---

## [0.1.0] - 2026-01-07

### Added

#### Core Foundation
- `@contextgraph/core`: Branded types, Result pattern, time utilities
- `@contextgraph/storage`: SQLite and in-memory storage implementations
- `@contextgraph/ontology`: Schema definitions and validation

#### Knowledge Layer
- `@contextgraph/ckg`: Contextual Knowledge Graph with entities and claims
- `@contextgraph/provenance`: Immutable provenance ledger with hash chain
- `@contextgraph/retrieval`: Context assembly with temporal filtering

#### Policy & Governance
- `@contextgraph/policy`: Policy ledger with deny-takes-precedence
- `@contextgraph/exceptions`: Exception requests and approvals
- `@contextgraph/dtg`: Decision Trace Graph with lifecycle tracking

#### Agent Layer
- `@contextgraph/agent`: Agent registry and capabilities
- `@contextgraph/execution`: Action execution with policy enforcement

#### Enterprise Features
- `@contextgraph/rbac`: Role-Based Access Control with 5 built-in roles
- `@contextgraph/compliance`: Audit reports, GDPR features (find/export/delete PII)
- `@contextgraph/webhooks`: Event webhooks with retry and HMAC signatures

#### Interface Layer
- `@contextgraph/sdk`: Unified high-level SDK
- `@contextgraph/api`: REST API with Express, auth, rate limiting
- `@contextgraph/cli`: CLI tools and interactive REPL
- `@contextgraph/demos`: Demo examples

### Documentation
- README with quick start and examples
- DEVELOPMENT.md for contributors
- LICENSING.md for dual licensing details
- TODO.md roadmap
