# Commercial Hosted Architecture

Technical architecture for the ContextGraph OS commercial hosted product.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Customer Applications                            │
│   (LangChain · AutoGen · Custom Agents · Internal Tools)                │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ SDK / REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ContextGraph Cloud Platform                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         API Gateway                              │   │
│  │           (Rate Limiting · Auth · Tenant Routing)                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│       ┌────────────────────────────┼────────────────────────────┐       │
│       ▼                            ▼                            ▼       │
│  ┌──────────┐              ┌──────────────┐              ┌──────────┐  │
│  │  Auth    │              │  Core API    │              │ Dashboard │  │
│  │ Service  │              │   Service    │              │  (React)  │  │
│  └──────────┘              └──────────────┘              └──────────┘  │
│       │                            │                            │       │
│       │     ┌──────────────────────┼──────────────────────┐     │       │
│       │     ▼                      ▼                      ▼     │       │
│       │ ┌────────┐          ┌──────────────┐        ┌────────┐  │       │
│       │ │ Policy │          │   Decision   │        │ Report │  │       │
│       │ │ Engine │          │   Processor  │        │ Worker │  │       │
│       │ └────────┘          └──────────────┘        └────────┘  │       │
│       │     │                      │                      │     │       │
│       └─────┼──────────────────────┼──────────────────────┼─────┘       │
│             │                      │                      │             │
│             ▼                      ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL (Multi-Tenant)                   │   │
│  │     Claims · Decisions · Policies · Provenance · Agents          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         Redis Cluster                            │   │
│  │           (Sessions · Cache · Real-time Events)                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Gateway

**Technology:** NGINX / Kong / AWS API Gateway

**Responsibilities:**
- Request routing to services
- Rate limiting per tenant
- API key validation
- Request/response logging
- SSL termination

```yaml
# Rate limits per tier
rate_limits:
  team:
    requests_per_minute: 1000
    burst: 100
  enterprise:
    requests_per_minute: 10000
    burst: 500
```

### 2. Authentication Service

**Technology:** Node.js + Passport.js / Auth0

**Features:**
- API key management
- SSO/SAML integration (Team+)
- JWT token issuance
- Role-based access control
- Multi-factor authentication (Enterprise)

```typescript
interface TenantAuth {
  tenantId: string;
  plan: 'team' | 'enterprise';
  apiKeys: ApiKey[];
  ssoConfig?: SSOConfig;
  users: User[];
  roles: Role[];
}
```

### 3. Core API Service

**Technology:** Node.js + TypeScript + Express/Fastify

**Endpoints:**
- `/api/v1/claims` - CRUD for claims
- `/api/v1/decisions` - Decision lifecycle
- `/api/v1/policies` - Policy management
- `/api/v1/agents` - Agent registry
- `/api/v1/provenance` - Audit trail queries

**Multi-tenancy:**
```typescript
// Every request is tenant-scoped
app.use((req, res, next) => {
  const tenantId = extractTenantId(req);
  req.context = { tenantId };
  next();
});

// Queries are automatically filtered
const claims = await ckg.query({
  tenantId: req.context.tenantId,  // Enforced
  entityId: 'report_123',
});
```

### 4. Policy Engine Service

**Technology:** Node.js + @contextgraph/policy

**Features:**
- Real-time policy evaluation
- Policy simulation/dry-run
- Template management
- Policy versioning

### 5. Decision Processor

**Technology:** Node.js + Bull Queue

**Responsibilities:**
- Async decision processing
- Human review queue management
- Webhook delivery
- Status transitions

```typescript
// Decision processing flow
queue.process('decision', async (job) => {
  const { decisionId, tenantId } = job.data;

  // Evaluate policies
  const result = await policyEngine.evaluate(decision);

  if (result.effect === 'deny' && result.requiresApproval) {
    await notifyReviewers(tenantId, decision);
    return { status: 'needs_review' };
  }

  // Auto-approve
  await dtg.transition(decisionId, 'approved');
  return { status: 'approved' };
});
```

### 6. Report Worker

**Technology:** Node.js + PDFKit + Bull Queue

**Features:**
- Scheduled report generation
- On-demand compliance exports
- PDF/CSV/JSON formats
- Email delivery

### 7. Dashboard (Web UI)

**Technology:** React + TypeScript + TailwindCSS

**Features:**
- Real-time decision monitoring
- Policy editor (visual + YAML)
- Agent status & capabilities
- Compliance report generation
- Team management
- Audit log viewer

## Database Schema (PostgreSQL)

```sql
-- Multi-tenant partitioning
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL,  -- 'team' | 'enterprise'
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All tables include tenant_id
CREATE TABLE claims (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  entity_id TEXT NOT NULL,
  attribute TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence DECIMAL(3,2),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  provenance_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Partition by tenant for isolation
  CONSTRAINT claims_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_claims_tenant_entity ON claims(tenant_id, entity_id);
CREATE INDEX idx_claims_valid_range ON claims(tenant_id, valid_from, valid_until);

-- Row-level security for tenant isolation
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON claims
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

## Infrastructure Requirements

### Team Tier (Managed)

| Component | Specification |
|-----------|---------------|
| API Servers | 2x (load balanced) |
| Database | PostgreSQL RDS (db.t3.medium) |
| Redis | ElastiCache (cache.t3.micro) |
| Storage | S3 for reports |
| CDN | CloudFront for dashboard |

**Estimated Cost:** ~$200-400/month base infrastructure

### Enterprise Tier (Self-Hosted)

| Component | Specification |
|-----------|---------------|
| Kubernetes | 3-node cluster minimum |
| Database | PostgreSQL (dedicated, encrypted) |
| Redis | 3-node cluster |
| Storage | Local or cloud storage |
| Monitoring | Prometheus + Grafana |

**Deployment Options:**
- AWS EKS / GCP GKE / Azure AKS
- On-premise Kubernetes
- Docker Compose (small scale)

## Deployment Architecture

### Kubernetes Deployment

```yaml
# Helm chart structure
contextgraph-cloud/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── auth-deployment.yaml
│   ├── dashboard-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   └── secrets.yaml
```

```yaml
# values.yaml
replicaCount:
  api: 3
  auth: 2
  dashboard: 2
  worker: 2

postgresql:
  enabled: true
  auth:
    database: contextgraph
  primary:
    persistence:
      size: 100Gi

redis:
  enabled: true
  architecture: replication

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.contextgraph.io
      paths:
        - path: /
          pathType: Prefix
```

### Docker Compose (Development/Small Scale)

```yaml
version: '3.8'

services:
  api:
    build: ./packages/cloud-api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/contextgraph
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  dashboard:
    build: ./packages/cloud-dashboard
    ports:
      - "3001:80"

  worker:
    build: ./packages/cloud-worker
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/contextgraph
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=contextgraph
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

## Security Considerations

### Data Isolation

- **Row-Level Security:** PostgreSQL RLS enforces tenant isolation
- **Encryption at Rest:** AES-256 for all stored data
- **Encryption in Transit:** TLS 1.3 for all connections
- **API Key Hashing:** bcrypt for stored API keys

### Compliance

| Standard | Features |
|----------|----------|
| SOC 2 | Audit logging, access controls, encryption |
| HIPAA | BAA available, PHI handling procedures |
| GDPR | Data export, deletion, consent tracking |
| ISO 27001 | Security controls, incident response |

### Audit Trail

```typescript
// All operations are logged
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;       // 'claim.create', 'decision.approve', etc.
  resource: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ip: string;
  userAgent: string;
  timestamp: Date;
}
```

## Monitoring & Observability

### Metrics (Prometheus)

```yaml
# Key metrics
- contextgraph_decisions_total{tenant, status}
- contextgraph_policy_evaluations_total{tenant, effect}
- contextgraph_api_latency_seconds{endpoint, method}
- contextgraph_claims_count{tenant}
- contextgraph_agents_active{tenant}
```

### Logging (Structured JSON)

```json
{
  "level": "info",
  "timestamp": "2024-03-15T10:30:00Z",
  "service": "api",
  "tenantId": "tenant_123",
  "requestId": "req_abc",
  "message": "Decision approved",
  "decisionId": "dec_xyz",
  "duration_ms": 45
}
```

### Alerting

| Alert | Threshold |
|-------|-----------|
| API Error Rate | > 1% for 5 min |
| API Latency P99 | > 500ms for 5 min |
| Database Connections | > 80% pool |
| Queue Backlog | > 1000 jobs |
| Decision Failure Rate | > 5% for 10 min |

## Next Steps

1. **Phase 1:** Core API + PostgreSQL multi-tenancy
2. **Phase 2:** Dashboard MVP + Basic auth
3. **Phase 3:** SSO integration + Advanced policies
4. **Phase 4:** Self-hosted Helm chart
5. **Phase 5:** Compliance certifications
