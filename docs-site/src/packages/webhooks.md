# @contextgraph/webhooks

Webhook management with delivery queue and retry logic.

## Installation

```bash
pnpm add @contextgraph/webhooks
```

## Overview

Send HTTP callbacks for system events:

- Webhook registration
- Event filtering
- Delivery queue
- Retry with backoff

## Registering Webhooks

```typescript
import { WebhookManager } from '@contextgraph/webhooks';

const webhooks = new WebhookManager(storage);
await webhooks.initialize();

await webhooks.register({
  url: 'https://example.com/webhook',
  events: ['entity:created', 'decision:approved'],
  secret: 'webhook-secret',
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

## Supported Events

| Event | Description |
|-------|-------------|
| `entity:created` | New entity created |
| `entity:updated` | Entity updated |
| `claim:added` | Claim added |
| `claim:revoked` | Claim revoked |
| `decision:proposed` | Decision recorded |
| `decision:approved` | Decision approved |
| `decision:rejected` | Decision rejected |
| `execution:completed` | Action executed |
| `policy:created` | Policy created |

## Webhook Payload

```json
{
  "event": "entity:created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "id": "ent_abc123",
    "type": "person",
    "name": "Alice"
  }
}
```

## Signature Verification

Webhooks include HMAC signature:

```
X-Webhook-Signature: sha256=abc123...
```

Verify in your handler:

```typescript
import crypto from 'crypto';

function verifySignature(payload: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

## Retry Policy

Failed deliveries are retried:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

## Managing Webhooks

```typescript
// List webhooks
const hooks = await webhooks.list();

// Disable webhook
await webhooks.disable(webhookId);

// Enable webhook
await webhooks.enable(webhookId);

// Delete webhook
await webhooks.delete(webhookId);

// Get delivery history
const history = await webhooks.getDeliveries(webhookId, { limit: 50 });
```
