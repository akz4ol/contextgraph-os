# @contextgraph/api

REST API server with authentication and rate limiting.

## Installation

```bash
pnpm add @contextgraph/api
```

## Starting the Server

```bash
# Default configuration
npx contextgraph-api

# Custom port and API key
PORT=8080 API_KEY=your-secret npx contextgraph-api
```

## API Endpoints

### Health

```
GET /api/v1/health
```

### Statistics

```
GET /api/v1/stats
```

### Entities

```
GET    /api/v1/entities           # List entities
POST   /api/v1/entities           # Create entity
GET    /api/v1/entities/:id       # Get entity
PUT    /api/v1/entities/:id       # Update entity
DELETE /api/v1/entities/:id       # Delete entity
GET    /api/v1/entities/:id/claims # Get entity claims
POST   /api/v1/entities/:id/claims # Add claim
```

### Agents

```
GET    /api/v1/agents             # List agents
POST   /api/v1/agents             # Create agent
GET    /api/v1/agents/:id         # Get agent
POST   /api/v1/agents/:id/execute # Execute action
```

### Decisions

```
GET    /api/v1/decisions           # List decisions
POST   /api/v1/decisions           # Record decision
GET    /api/v1/decisions/:id       # Get decision
POST   /api/v1/decisions/:id/approve # Approve
POST   /api/v1/decisions/:id/reject  # Reject
```

### Policies

```
GET    /api/v1/policies           # List policies
POST   /api/v1/policies           # Create policy
```

### Provenance

```
GET    /api/v1/provenance         # Query provenance
POST   /api/v1/provenance/verify  # Verify chain
```

### Audit

```
GET    /api/v1/audit              # Query audit trail
```

## Authentication

Set `API_KEY` environment variable:

```bash
API_KEY=your-secret-key npx contextgraph-api
```

Include in requests:

```bash
curl -H "X-API-Key: your-secret-key" http://localhost:3000/api/v1/entities
```

## Example Requests

### Create Entity

```bash
curl -X POST http://localhost:3000/api/v1/entities \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "type": "person",
    "name": "Alice",
    "properties": {"department": "Engineering"}
  }'
```

### Add Claim

```bash
curl -X POST http://localhost:3000/api/v1/entities/ent_xxx/claims \
  -H "Content-Type: application/json" \
  -d '{"predicate": "has_skill", "value": "TypeScript"}'
```

### Verify Provenance

```bash
curl -X POST http://localhost:3000/api/v1/provenance/verify
```

## Rate Limiting

Default: 100 requests per minute per IP.

Configure via environment:

```bash
RATE_LIMIT=200 RATE_WINDOW=60000 npx contextgraph-api
```

## CORS

Enable CORS for web clients:

```bash
CORS_ORIGIN=https://myapp.com npx contextgraph-api
```
