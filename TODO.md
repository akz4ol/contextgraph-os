# ContextGraph OS - Roadmap & TODO

This document tracks planned features and improvements for ContextGraph OS.

## Completed (v0.1.0)

- [x] E0: Project setup and core types
- [x] E1: Storage abstraction (SQLite + in-memory)
- [x] E2: Ontology and schema validation
- [x] E3: Contextual Knowledge Graph (CKG)
- [x] E4: Provenance ledger with hash chain
- [x] E5: Exceptions and overrides
- [x] E6: Policy and rights ledger
- [x] E7: Agent and problem-space graphs
- [x] E8: Retrieval and context assembly
- [x] E9: Agent execution framework
- [x] E10: SDK (TypeScript)
- [x] E11: CLI and REPL
- [x] E12-13: Demos and integration tests
- [x] Documentation (README, DEVELOPMENT.md, demos README)
- [x] Dual licensing (AGPL-3.0 + Commercial)

---

## Phase 1: API Layer (E14)

### REST API ✅
- [x] Set up Express server in `@contextgraph/api`
- [x] Implement entity endpoints
  - [x] `POST /entities` - Create entity
  - [x] `GET /entities` - List entities (with filtering)
  - [x] `GET /entities/:id` - Get entity by ID
  - [x] `PUT /entities/:id` - Update entity
  - [x] `DELETE /entities/:id` - Delete entity
- [x] Implement claim endpoints
  - [x] `POST /entities/:id/claims` - Add claim
  - [x] `GET /entities/:id/claims` - Get claims for entity
- [x] Implement agent endpoints
  - [x] `POST /agents` - Create agent
  - [x] `GET /agents` - List agents
  - [x] `GET /agents/:id` - Get agent by ID
  - [x] `POST /agents/:id/execute` - Execute action
- [x] Implement decision endpoints
  - [x] `POST /decisions` - Record decision
  - [x] `GET /decisions` - List decisions (with status filter)
  - [x] `GET /decisions/:id` - Get decision by ID
  - [x] `POST /decisions/:id/approve` - Approve decision
  - [x] `POST /decisions/:id/reject` - Reject decision (stub)
- [x] Implement policy endpoints
  - [x] `POST /policies` - Create policy
  - [x] `GET /policies` - List policies
  - [x] `GET /policies/:id` - Get policy by ID
  - [x] `PUT /policies/:id` - Update policy
  - [x] `DELETE /policies/:id` - Archive policy
- [x] Implement system endpoints
  - [x] `GET /health` - Health check
  - [x] `GET /stats` - System statistics
  - [x] `GET /audit` - Audit trail
  - [x] `GET /provenance` - Query provenance
  - [x] `POST /provenance/verify` - Verify chain integrity
- [x] Add authentication middleware (API keys)
- [x] Add rate limiting
- [x] Add request validation (Zod schemas)
- [ ] Add OpenAPI/Swagger documentation
- [x] Write API tests (26 tests)

### Webhook Support
- [ ] Create `@contextgraph/webhooks` package
- [ ] Implement webhook registration
  - [ ] `POST /webhooks` - Register webhook
  - [ ] `GET /webhooks` - List webhooks
  - [ ] `DELETE /webhooks/:id` - Remove webhook
- [ ] Implement webhook delivery
  - [ ] Event queue for reliable delivery
  - [ ] Retry logic with exponential backoff
  - [ ] Signature verification (HMAC)
- [ ] Supported events:
  - [ ] `entity.created`, `entity.updated`, `entity.deleted`
  - [ ] `claim.added`, `claim.revoked`
  - [ ] `agent.created`, `agent.updated`
  - [ ] `decision.proposed`, `decision.approved`, `decision.rejected`
  - [ ] `policy.created`, `policy.updated`
  - [ ] `execution.completed`, `execution.failed`
- [ ] Add webhook logs and debugging
- [ ] Write webhook tests

### Import/Export
- [ ] Add to `@contextgraph/sdk`:
  - [ ] `exportToJSON()` - Full graph export
  - [ ] `importFromJSON()` - Full graph import
  - [ ] `exportEntities()` - Export entities to CSV
  - [ ] `importEntities()` - Import entities from CSV
  - [ ] `exportClaims()` - Export claims to CSV
  - [ ] `importClaims()` - Import claims from CSV
- [ ] Add CLI commands:
  - [ ] `contextgraph export --format json --output backup.json`
  - [ ] `contextgraph import --format json --input backup.json`
  - [ ] `contextgraph export entities --format csv`
  - [ ] `contextgraph import entities --format csv`
- [ ] Support incremental exports (since timestamp)
- [ ] Validate imports before applying
- [ ] Write import/export tests

---

## Phase 2: Enterprise Features (E15)

### Role-Based Access Control (RBAC)
- [ ] Create `@contextgraph/rbac` package
- [ ] Define built-in roles:
  - [ ] `admin` - Full system access
  - [ ] `operator` - Manage agents and policies
  - [ ] `analyst` - Read-only access + queries
  - [ ] `agent` - Execute actions only
  - [ ] `auditor` - Read audit trails and provenance
- [ ] Implement role management:
  - [ ] `createRole(name, permissions)`
  - [ ] `assignRole(subjectId, roleId)`
  - [ ] `revokeRole(subjectId, roleId)`
  - [ ] `getRoles(subjectId)`
- [ ] Implement permission checking:
  - [ ] `hasPermission(subjectId, action, resource)`
  - [ ] Integrate with policy engine
- [ ] Add role inheritance (role hierarchies)
- [ ] Add resource-level permissions
- [ ] Write RBAC tests

### Compliance Reports
- [ ] Create `@contextgraph/compliance` package
- [ ] Implement report generators:
  - [ ] `generateAuditReport(options)` - Full audit trail report
  - [ ] `generateAccessReport(options)` - Who accessed what
  - [ ] `generateDecisionReport(options)` - Decision audit
  - [ ] `generateProvenanceReport(options)` - Data lineage report
- [ ] Report formats:
  - [ ] PDF export
  - [ ] CSV export
  - [ ] JSON export
- [ ] GDPR compliance features:
  - [ ] `findPersonalData(subjectId)` - Find all PII
  - [ ] `exportPersonalData(subjectId)` - Data portability
  - [ ] `deletePersonalData(subjectId)` - Right to erasure
- [ ] SOC2 compliance features:
  - [ ] Access logging
  - [ ] Change tracking
  - [ ] Encryption at rest verification
- [ ] Add scheduled report generation
- [ ] Write compliance tests

### Policy Templates
- [ ] Create policy template library in `@contextgraph/policy`:
  - [ ] `templates/read-only.json` - Read-only access
  - [ ] `templates/pii-protection.json` - PII data protection
  - [ ] `templates/approval-required.json` - Require approvals
  - [ ] `templates/rate-limit.json` - Rate limiting
  - [ ] `templates/time-based.json` - Time-based access
  - [ ] `templates/jurisdiction.json` - Geographic restrictions
- [ ] Implement template functions:
  - [ ] `loadTemplate(name, variables)`
  - [ ] `listTemplates()`
  - [ ] `validateTemplate(template)`
- [ ] Add CLI commands:
  - [ ] `contextgraph policy templates` - List templates
  - [ ] `contextgraph policy apply <template>` - Apply template
- [ ] Write template tests

### Policy Simulation
- [ ] Add simulation mode to policy engine:
  - [ ] `simulatePolicy(policy, scenarios)` - Test policy
  - [ ] `dryRun(action, context)` - Check without executing
  - [ ] `comparePolices(policy1, policy2)` - Diff policies
- [ ] Implement scenario testing:
  - [ ] Define test scenarios in JSON
  - [ ] Run scenarios against policies
  - [ ] Generate coverage reports
- [ ] Add CLI commands:
  - [ ] `contextgraph policy simulate <file>`
  - [ ] `contextgraph policy dry-run <action>`
- [ ] Write simulation tests

### Agent Hierarchies
- [ ] Extend `@contextgraph/agent`:
  - [ ] Add `parentId` to agent schema
  - [ ] `createChildAgent(parentId, config)`
  - [ ] `getChildAgents(parentId)`
  - [ ] `getAgentHierarchy(rootId)`
- [ ] Implement delegation:
  - [ ] `delegateCapability(fromAgent, toAgent, capability)`
  - [ ] `revokeDelegate(fromAgent, toAgent, capability)`
  - [ ] Automatic capability inheritance
- [ ] Implement supervision:
  - [ ] Parent approval for child actions
  - [ ] Cascade disable/enable
  - [ ] Audit trail for delegation
- [ ] Write hierarchy tests

---

## Phase 3: Developer Experience (E16)

### OpenTelemetry Integration
- [ ] Create `@contextgraph/telemetry` package
- [ ] Implement tracing:
  - [ ] Span for each SDK method
  - [ ] Trace context propagation
  - [ ] Custom attributes (entity IDs, agent IDs)
- [ ] Implement metrics:
  - [ ] `contextgraph.entities.count` - Entity count
  - [ ] `contextgraph.claims.count` - Claim count
  - [ ] `contextgraph.executions.duration` - Execution time
  - [ ] `contextgraph.provenance.verification.duration`
- [ ] Implement logging:
  - [ ] Structured JSON logs
  - [ ] Log levels (debug, info, warn, error)
  - [ ] Correlation IDs
- [ ] Export to:
  - [ ] Jaeger
  - [ ] Prometheus
  - [ ] Console (development)
- [ ] Write telemetry tests

### Query Optimization
- [ ] Add indexing to storage:
  - [ ] Index entities by type
  - [ ] Index claims by subject
  - [ ] Index claims by predicate
  - [ ] Index provenance by timestamp
- [ ] Implement query caching:
  - [ ] LRU cache for frequent queries
  - [ ] Cache invalidation on writes
  - [ ] Configurable TTL
- [ ] Implement query planning:
  - [ ] Analyze query patterns
  - [ ] Optimize complex queries
  - [ ] Explain query execution
- [ ] Add performance benchmarks
- [ ] Write optimization tests

### VSCode Extension
- [ ] Create `contextgraph-vscode` repository
- [ ] Implement tree view:
  - [ ] Entities browser
  - [ ] Agents browser
  - [ ] Policies browser
  - [ ] Decisions browser
- [ ] Implement graph visualization:
  - [ ] Entity relationship view
  - [ ] Provenance chain view
  - [ ] Decision tree view
- [ ] Implement code features:
  - [ ] Syntax highlighting for policy DSL
  - [ ] Autocomplete for SDK methods
  - [ ] Hover documentation
- [ ] Implement commands:
  - [ ] Run demos
  - [ ] Execute queries
  - [ ] Verify provenance
- [ ] Publish to VS Code Marketplace

### Type Generation
- [ ] Add to `@contextgraph/ontology`:
  - [ ] `generateTypes(schema)` - Generate TypeScript types
  - [ ] `generateValidators(schema)` - Generate Zod schemas
  - [ ] `generateDocs(schema)` - Generate documentation
- [ ] CLI commands:
  - [ ] `contextgraph codegen types --output types.ts`
  - [ ] `contextgraph codegen validators --output validators.ts`
- [ ] Watch mode for development
- [ ] Write codegen tests

---

## Phase 4: Advanced Capabilities (E17)

### Provenance Visualization
- [ ] Create `@contextgraph/viz` package
- [ ] Implement renderers:
  - [ ] DOT format (Graphviz)
  - [ ] Mermaid diagrams
  - [ ] D3.js JSON format
  - [ ] SVG export
- [ ] Visualization types:
  - [ ] Provenance chain (linear)
  - [ ] Entity relationships (graph)
  - [ ] Decision tree (hierarchical)
  - [ ] Timeline view (temporal)
- [ ] CLI commands:
  - [ ] `contextgraph viz provenance --format dot`
  - [ ] `contextgraph viz entities --format mermaid`
- [ ] Write visualization tests

### Semantic Reasoning
- [ ] Create `@contextgraph/reasoning` package
- [ ] Implement inference rules:
  - [ ] Transitive relations (A→B→C implies A→C)
  - [ ] Symmetric relations (A↔B)
  - [ ] Inverse relations (parent↔child)
- [ ] Implement rule engine:
  - [ ] Define rules in DSL
  - [ ] Forward chaining inference
  - [ ] Materialized views for derived facts
- [ ] Implement queries:
  - [ ] `infer(entityId, relation)` - Inferred relations
  - [ ] `explain(claimId)` - Why this claim exists
- [ ] Write reasoning tests

### Contradiction Detection
- [ ] Add to `@contextgraph/ckg`:
  - [ ] `detectContradictions()` - Find all contradictions
  - [ ] `checkConsistency(claim)` - Check before adding
  - [ ] `resolveContradiction(claimIds, strategy)`
- [ ] Contradiction types:
  - [ ] Direct negation (A is true, A is false)
  - [ ] Mutual exclusion (A is X, A is Y where X≠Y)
  - [ ] Temporal overlap (conflicting validity periods)
- [ ] Resolution strategies:
  - [ ] Latest wins
  - [ ] Highest confidence wins
  - [ ] Manual resolution required
- [ ] Write contradiction tests

### Decision Recommendations
- [ ] Create `@contextgraph/recommendations` package
- [ ] Implement precedent search:
  - [ ] `findSimilarDecisions(context)` - Find similar past decisions
  - [ ] Similarity scoring algorithm
  - [ ] Configurable matching criteria
- [ ] Implement recommendations:
  - [ ] `recommendDecision(context)` - Suggest decision
  - [ ] `explainRecommendation(recommendationId)` - Why suggested
  - [ ] Confidence scoring
- [ ] Implement learning:
  - [ ] Track recommendation accuracy
  - [ ] Feedback loop for improvements
- [ ] Write recommendation tests

---

## Backlog (Future Consideration)

### Infrastructure
- [ ] Distributed storage (multi-node)
- [ ] Event sourcing architecture
- [ ] CQRS pattern implementation
- [ ] Kubernetes deployment manifests
- [ ] Docker compose for local development

### Security
- [ ] Encryption at rest
- [ ] Field-level encryption
- [ ] Audit log tamper detection
- [ ] Security scanning in CI/CD

### Integrations
- [ ] Slack notifications
- [ ] Email notifications
- [ ] PagerDuty alerts
- [ ] Jira issue creation
- [ ] GitHub issue sync

### ML/AI Features
- [ ] Knowledge graph embeddings
- [ ] Anomaly detection
- [ ] Predictive analytics
- [ ] Natural language queries

### Documentation
- [ ] API reference (auto-generated)
- [ ] Architecture deep-dive
- [ ] Security best practices
- [ ] Performance tuning guide
- [ ] Migration guides

---

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md) for development setup and contribution guidelines.

When picking up a task:
1. Create a branch: `git checkout -b feature/task-name`
2. Update this file to mark task as in-progress
3. Implement with tests
4. Submit PR referencing the task

## Priority Legend

- 🔴 Critical - Blocking other work
- 🟠 High - Important for next release
- 🟡 Medium - Nice to have
- 🟢 Low - Future consideration
