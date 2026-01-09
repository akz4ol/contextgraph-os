# Changelog

All notable changes to ContextGraph OS.

## [0.3.0] - 2024

### Added

- **Visualization Package** (`@contextgraph/viz`)
  - DOT/Graphviz renderer
  - Mermaid diagram renderer
  - D3.js JSON format
  - SVG standalone renderer
  - High-level APIs: visualizeProvenance, visualizeEntities, visualizeDecisions

- **Semantic Reasoning** (`@contextgraph/reasoning`)
  - RelationRegistry with transitive, symmetric, inverse relations
  - RuleEngine with forward chaining inference
  - Pattern matching with variable bindings
  - ContradictionDetector for finding and resolving conflicts
  - Built-in rules for common inference patterns

- **Decision Recommendations** (`@contextgraph/recommendations`)
  - Similarity-based precedent matching
  - Configurable matching weights
  - Risk assessment with customizable patterns
  - Feedback loop for accuracy improvement

## [0.2.0] - 2024

### Added

- **Policy Templates & Simulation**
  - 6 built-in templates
  - PolicyTemplateManager
  - PolicySimulator for dry-run testing

- **Agent Hierarchies & Delegation**
  - AgentHierarchyManager
  - Capability delegation
  - Cascade operations

- **OpenTelemetry Integration** (`@contextgraph/telemetry`)
  - Tracing with spans
  - Metrics (Counter, Gauge, Histogram)
  - Structured logging
  - Multiple exporters

## [0.1.0] - 2024

### Added

- Initial release
- Core foundation packages
- Contextual Knowledge Graph
- Provenance ledger
- Decision Trace Graph
- Policy enforcement
- Agent execution framework
- SDK and CLI
- REST API
