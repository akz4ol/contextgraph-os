# Enterprise Deployment Architecture

A production-grade reference architecture for deploying ContextGraph OS with agents, RAG, policies, and human review workflows.

## Architectural Philosophy

ContextGraph OS is **not** another agent framework. It is the **governance spine** that sits *between* agent cognition and real-world action.

The architecture enforces a simple but powerful rule:

> **No agent action is valid unless it is context-justified, policy-evaluated, and decision-traceable.**

This is achieved by separating **four planes**:

| Plane | Purpose |
|-------|---------|
| **Cognition Plane** | Where agents think |
| **Knowledge Plane** | Where claims live (with provenance + time) |
| **Governance Plane** | Where policies, risk, and approvals exist |
| **Execution Plane** | Where actions actually occur |

## High-Level System Diagram

```
┌───────────────────────────────────────────────────────────┐
│                   Enterprise Interfaces                   │
│  (Dashboards · Audit · Compliance · Admin · CLI · API)    │
└───────────────────────────────────────────────────────────┘
                ▲                        ▲
                │                        │
        Human Review Plane        Audit / Export Plane
                │                        │
┌───────────────────────────────────────────────────────────┐
│               ContextGraph OS (Core)                       │
│                                                           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ Knowledge     │   │ Policy Engine│   │ Decision     │  │
│  │ (Claims + KG) │◄──┤ (Deny-first) │──►│ Trace Graph  │  │
│  └──────────────┘   └──────────────┘   └──────────────┘  │
│           ▲                   ▲                   │      │
│           │                   │                   │      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────┐ │
│  │ Provenance   │     │ Exceptions   │     │ Telemetry│ │
│  │ Ledger       │     │ & Approvals  │     │ & RBAC   │ │
│  └──────────────┘     └──────────────┘     └──────────┘ │
└───────────────────────────────────────────────────────────┘
                ▲
                │
┌───────────────────────────────────────────────────────────┐
│              Agent Runtime Layer                           │
│  (LangChain / AutoGen / Custom Agents / Tools)             │
└───────────────────────────────────────────────────────────┘
                ▲
                │
┌───────────────────────────────────────────────────────────┐
│            Data + RAG Infrastructure                       │
│  (Vector DB · Search · Docs · APIs · OSINT · Internal)     │
└───────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Agent Runtime Layer (Pluggable)

**Supported Frameworks:**
- LangChain / LangGraph
- CrewAI / AutoGen
- Custom internal agents
- Deterministic tools (APIs, scripts, workflows)

**Key Rule:** Agents **never execute tools directly**. They submit **Action Intents** to ContextGraph OS.

```typescript
// Agent submits intent, not execution
agent.requestAction({
  type: "publish_report",
  target: "external_audience",
  risk: "HIGH",
  contextQuery: {
    entityId: reportId,
    minConfidence: 0.8,
  }
});
```

### Knowledge Plane (Contextual RAG + Claims)

This is where ContextGraph OS diverges sharply from typical RAG.

**Instead of:** "Here are top-k chunks"

**ContextGraph stores:** Claims with full context:

```json
{
  "entity": "Market_Analysis_Q4",
  "claim": "Revenue growth projected at 15%",
  "validFrom": "2024-10-01",
  "validUntil": "2024-12-31",
  "confidence": 0.85,
  "source": "Internal Finance Report",
  "provenanceHash": "0x9af3..."
}
```

**This enables:**
- Time-travel queries ("What did we know in March?")
- Contradiction coexistence (multiple sources, different claims)
- Evidence-weighted reasoning
- Audit-ready provenance

### Policy Engine (Deny-First by Design)

Policies are evaluated **before any execution**.

```yaml
policy:
  name: external_publish_guard
  effect: deny
  when:
    action: publish
    target: external_audience
    risk: [HIGH, CRITICAL]
  then:
    require_approval: true
    approvers: [role:compliance_officer, role:legal]
```

**Policy evaluation flow:**

```
Action Intent → Policy Engine → DENY (needs approval)
                    │
                    └──→ Exception Queue → Human Review → APPROVE/REJECT
                                                │
                                                └──→ Execution (if approved)
```

### Human Review & Exception Workflow

When a policy denies an action:

1. Decision enters **Exception Queue**
2. Human reviewer sees:
   - Proposed action details
   - Evidence used (claims, entities)
   - Confidence levels
   - Policy that triggered denial
   - Risk assessment
3. Reviewer can:
   - **Approve** (with justification)
   - **Reject** (with reason)
   - **Request more evidence**

All outcomes are written into the **Decision Trace Graph** for permanent audit.

### Execution Plane (Controlled Dispatch)

Execution only occurs after:
- Policy ALLOW, or
- Human approval for denied actions

```typescript
// Execution is side-effect isolated and traceable
const result = await executor.dispatch({
  decisionId: approvedDecision.id,
  action: action,
  context: assembledContext,
});

// Full execution logged to provenance
```

### Audit & Compliance Plane

**Outputs:**
- Quarterly AI decision reports
- Evidence summaries per decision
- Policy override logs
- Provenance verification hashes
- GDPR data subject reports

**Export formats:**
- JSON (machine-readable)
- PDF (human-readable)
- CSV (spreadsheet analysis)

## Deployment Models

### Option A: Central Governance Service (Recommended)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Agent A    │  │  Agent B    │  │  Agent C    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────▼─────────┐
              │  ContextGraph OS  │
              │  (Central Service)│
              └───────────────────┘
```

**Benefits:**
- Strongest audit posture
- Unified policy enforcement
- Cross-agent visibility
- Single source of truth

### Option B: Embedded Mode

```
┌─────────────────────────┐
│        Agent A          │
│  ┌───────────────────┐  │
│  │  ContextGraph OS  │  │
│  │    (Embedded)     │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

**Benefits:**
- Lower latency
- No network dependency
- Simpler deployment

**Trade-offs:**
- Reduced cross-org visibility
- Per-app audit silos

### Option C: Hybrid

```
┌─────────────────────────────────────────┐
│     Central Policy + Provenance         │
└─────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │ Agent A │    │ Agent B │    │ Agent C │
    │ (Local  │    │ (Local  │    │ (Local  │
    │  Cache) │    │  Cache) │    │  Cache) │
    └─────────┘    └─────────┘    └─────────┘
```

**Benefits:**
- Central governance
- Local performance
- Scalable architecture

## Security Considerations

### Data Classification

| Data Type | Storage | Encryption |
|-----------|---------|------------|
| Claims | Persistent | AES-256 at rest |
| Decisions | Persistent | AES-256 at rest |
| Provenance | Immutable | Hash-chained |
| Policies | Versioned | Signed |

### Access Control

- RBAC for all operations
- Policy-based action control
- Audit logging for all access
- SSO/SAML integration (Enterprise)

### Network Security

- TLS 1.3 for all connections
- mTLS for service-to-service
- API key + JWT authentication
- Rate limiting

## Next Steps

- [Governance Deep Dive](./governance.md)
- [Policy Configuration](./policy-configuration.md)
- [Decision Trace Graph](./decision-trace.md)
- [Compliance Reporting](./compliance-reporting.md)
