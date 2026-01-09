# REST API Reference

Complete REST API reference for ContextGraph.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

Include API key in header:

```
X-API-Key: your-api-key
```

## Endpoints

### Health

#### GET /health

Check service health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Statistics

#### GET /stats

Get system statistics.

**Response:**
```json
{
  "entities": 42,
  "claims": 156,
  "agents": 3,
  "decisions": 12,
  "policies": 5,
  "provenanceEntries": 203
}
```

### Entities

#### GET /entities

List entities.

**Query Parameters:**
- `type` - Filter by entity type
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "ent_abc123",
      "type": "person",
      "name": "Alice",
      "properties": {},
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 42
}
```

#### POST /entities

Create entity.

**Body:**
```json
{
  "type": "person",
  "name": "Alice",
  "properties": {
    "department": "Engineering"
  }
}
```

#### GET /entities/:id

Get entity by ID.

#### PUT /entities/:id

Update entity.

#### DELETE /entities/:id

Delete entity.

#### GET /entities/:id/claims

Get claims for entity.

#### POST /entities/:id/claims

Add claim to entity.

**Body:**
```json
{
  "predicate": "has_skill",
  "value": "TypeScript",
  "context": {
    "confidence": 0.95
  }
}
```

### Agents

#### GET /agents

List agents.

#### POST /agents

Create agent.

**Body:**
```json
{
  "name": "data-processor",
  "description": "Processes data files",
  "capabilities": ["read", "write"]
}
```

#### GET /agents/:id

Get agent by ID or name.

#### POST /agents/:id/execute

Execute action.

**Body:**
```json
{
  "action": "read",
  "resourceType": "csv",
  "resourceId": "data/input.csv",
  "parameters": {}
}
```

### Decisions

#### GET /decisions

List decisions.

**Query Parameters:**
- `status` - Filter by status
- `riskLevel` - Filter by risk

#### POST /decisions

Record decision.

**Body:**
```json
{
  "type": "deployment",
  "title": "Deploy v2.0.0",
  "proposedBy": "agt_123",
  "riskLevel": "medium"
}
```

#### GET /decisions/:id

Get decision.

#### POST /decisions/:id/approve

Approve decision.

**Body:**
```json
{
  "approverId": "agt_456",
  "comment": "Approved"
}
```

#### POST /decisions/:id/reject

Reject decision.

### Policies

#### GET /policies

List policies.

#### POST /policies

Create policy.

**Body:**
```json
{
  "name": "Read Access",
  "version": "1.0.0",
  "effect": "allow",
  "subjects": ["role:analyst"],
  "actions": ["read"],
  "resources": ["reports/*"],
  "priority": 50
}
```

### Audit

#### GET /audit

Query audit trail.

**Query Parameters:**
- `entityId` - Filter by entity
- `agentId` - Filter by agent
- `from` - Start timestamp
- `to` - End timestamp
- `limit` - Max results

### Provenance

#### GET /provenance

Query provenance entries.

#### POST /provenance/verify

Verify provenance chain.

**Response:**
```json
{
  "valid": true,
  "entriesVerified": 203,
  "brokenLinks": 0,
  "invalidHashes": 0
}
```

## Error Responses

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Entity not found"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `PERMISSION_DENIED` | 403 | Access denied |
| `POLICY_DENIED` | 403 | Policy blocked |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

- Default: 100 requests/minute
- Header: `X-RateLimit-Remaining`
- Header: `X-RateLimit-Reset`
