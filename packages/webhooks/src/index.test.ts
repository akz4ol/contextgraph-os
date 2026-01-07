/**
 * Webhook System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import {
  WebhookManager,
  WebhookDeliveryService,
  generateSecret,
  generateSignature,
  verifySignature,
  generateEventId,
  calculateRetryDelay,
} from './index.js';
import type { WebhookEvent, WebhookEventType } from './types.js';

describe('Webhook Utilities', () => {
  describe('generateSecret', () => {
    it('generates a random secret', () => {
      const secret1 = generateSecret();
      const secret2 = generateSecret();
      expect(secret1).not.toBe(secret2);
      expect(secret1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('generates secret with custom length', () => {
      const secret = generateSecret(16);
      expect(secret.length).toBe(32); // 16 bytes = 32 hex chars
    });
  });

  describe('generateSignature', () => {
    it('generates HMAC signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const signature = generateSignature(payload, secret);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('generates consistent signatures', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const sig1 = generateSignature(payload, secret);
      const sig2 = generateSignature(payload, secret);
      expect(sig1).toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('verifies valid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const signature = generateSignature(payload, secret);
      expect(verifySignature(payload, signature, secret)).toBe(true);
    });

    it('rejects invalid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      expect(verifySignature(payload, 'sha256=invalid', secret)).toBe(false);
    });

    it('rejects tampered payload', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const signature = generateSignature(payload, secret);
      expect(verifySignature('{"test": "tampered"}', signature, secret)).toBe(false);
    });
  });

  describe('generateEventId', () => {
    it('generates unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^evt_\d+_[a-f0-9]+$/);
    });
  });

  describe('calculateRetryDelay', () => {
    it('calculates exponential backoff', () => {
      const delay1 = calculateRetryDelay(1, 1000, 3600000, 2);
      const delay2 = calculateRetryDelay(2, 1000, 3600000, 2);
      const delay3 = calculateRetryDelay(3, 1000, 3600000, 2);

      // Approximate due to jitter
      expect(delay1).toBeGreaterThan(800);
      expect(delay1).toBeLessThan(1200);
      expect(delay2).toBeGreaterThan(1600);
      expect(delay2).toBeLessThan(2400);
      expect(delay3).toBeGreaterThan(3200);
      expect(delay3).toBeLessThan(4800);
    });

    it('respects max delay', () => {
      const delay = calculateRetryDelay(10, 1000, 5000, 2);
      expect(delay).toBeLessThanOrEqual(5500); // max + jitter
    });
  });
});

describe('WebhookManager', () => {
  let storage: InMemoryStorage;
  let manager: WebhookManager;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    manager = new WebhookManager(storage);
    await manager.initialize();
  });

  describe('create', () => {
    it('creates a webhook', async () => {
      const result = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created', 'entity.updated'],
        description: 'Test webhook',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.url).toBe('https://example.com/webhook');
        expect(result.value.events).toEqual(['entity.created', 'entity.updated']);
        expect(result.value.status).toBe('active');
        expect(result.value.secret).toBeDefined();
        expect(result.value.failureCount).toBe(0);
      }
    });

    it('creates webhook with custom secret', async () => {
      const result = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
        secret: 'my-custom-secret',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.secret).toBe('my-custom-secret');
      }
    });

    it('rejects invalid URL', async () => {
      const result = await manager.create({
        url: 'not-a-valid-url',
        events: ['entity.created'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid webhook URL');
      }
    });

    it('rejects empty events', async () => {
      const result = await manager.create({
        url: 'https://example.com/webhook',
        events: [],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('At least one event type');
      }
    });
  });

  describe('get', () => {
    it('retrieves webhook by ID', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await manager.get(created.value.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.id).toBe(created.value.id);
      }
    });

    it('returns null for non-existent webhook', async () => {
      const result = await manager.get('whk_nonexistent');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('update', () => {
    it('updates webhook properties', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await manager.update(created.value.id, {
        url: 'https://new-url.com/webhook',
        events: ['entity.created', 'entity.deleted'],
        description: 'Updated description',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.url).toBe('https://new-url.com/webhook');
        expect(result.value.events).toContain('entity.deleted');
        expect(result.value.description).toBe('Updated description');
      }
    });

    it('updates webhook status', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await manager.update(created.value.id, {
        status: 'inactive',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('inactive');
      }
    });
  });

  describe('delete', () => {
    it('deletes webhook (soft delete)', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const deleteResult = await manager.delete(created.value.id);
      expect(deleteResult.ok).toBe(true);

      // Soft delete marks as inactive
      const getResult = await manager.get(created.value.id);
      expect(getResult.ok).toBe(true);
      if (getResult.ok && getResult.value) {
        expect(getResult.value.status).toBe('inactive');
      }
    });
  });

  describe('list', () => {
    it('lists all webhooks', async () => {
      await manager.create({
        url: 'https://example.com/webhook1',
        events: ['entity.created'],
      });
      await manager.create({
        url: 'https://example.com/webhook2',
        events: ['entity.updated'],
      });

      const result = await manager.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('filters by status', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await manager.update(created.value.id, { status: 'inactive' });

      const activeResult = await manager.list({ status: 'active' });
      expect(activeResult.ok).toBe(true);
      if (activeResult.ok) {
        expect(activeResult.value.length).toBe(0);
      }

      const inactiveResult = await manager.list({ status: 'inactive' });
      expect(inactiveResult.ok).toBe(true);
      if (inactiveResult.ok) {
        expect(inactiveResult.value.length).toBe(1);
      }
    });

    it('filters by event type', async () => {
      await manager.create({
        url: 'https://example.com/webhook1',
        events: ['entity.created', 'entity.updated'],
      });
      await manager.create({
        url: 'https://example.com/webhook2',
        events: ['agent.created'],
      });

      const result = await manager.list({ event: 'entity.created' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.events).toContain('entity.created');
      }
    });
  });

  describe('getByEvent', () => {
    it('gets active webhooks subscribed to event', async () => {
      await manager.create({
        url: 'https://example.com/webhook1',
        events: ['entity.created', 'entity.updated'],
      });
      await manager.create({
        url: 'https://example.com/webhook2',
        events: ['entity.created'],
      });
      await manager.create({
        url: 'https://example.com/webhook3',
        events: ['agent.created'],
      });

      const result = await manager.getByEvent('entity.created');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });
  });

  describe('recordFailure', () => {
    it('increments failure count', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await manager.recordFailure(created.value.id);
      await manager.recordFailure(created.value.id);

      const result = await manager.get(created.value.id);
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.failureCount).toBe(2);
      }
    });
  });

  describe('resetFailures', () => {
    it('resets failure count and reactivates', async () => {
      const created = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await manager.recordFailure(created.value.id);
      await manager.recordFailure(created.value.id);
      await manager.update(created.value.id, { status: 'failed' });

      const result = await manager.resetFailures(created.value.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.failureCount).toBe(0);
        expect(result.value.status).toBe('active');
      }
    });
  });
});

describe('WebhookDeliveryService', () => {
  let storage: InMemoryStorage;
  let manager: WebhookManager;
  let delivery: WebhookDeliveryService;
  let mockFetch: ReturnType<typeof createMockFetch>;

  function createMockFetch(statusCode: number = 200, responseBody: string = 'OK') {
    return async (_url: string, _options: RequestInit): Promise<Response> => {
      return new Response(responseBody, {
        status: statusCode,
        headers: { 'Content-Type': 'text/plain' },
      });
    };
  }

  beforeEach(async () => {
    storage = new InMemoryStorage();
    manager = new WebhookManager(storage);
    await manager.initialize();

    mockFetch = createMockFetch();
    delivery = new WebhookDeliveryService(storage, manager, {}, mockFetch);
    await delivery.initialize();
  });

  describe('queueEvent', () => {
    it('queues event for delivery', async () => {
      await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const result = await delivery.queueEvent(event);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.status).toBe('pending');
      }
    });

    it('queues to multiple webhooks', async () => {
      await manager.create({
        url: 'https://example.com/webhook1',
        events: ['entity.created'],
      });
      await manager.create({
        url: 'https://example.com/webhook2',
        events: ['entity.created'],
      });

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const result = await delivery.queueEvent(event);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });
  });

  describe('deliver', () => {
    it('delivers webhook successfully', async () => {
      const webhook = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(webhook.ok).toBe(true);
      if (!webhook.ok) return;

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const queued = await delivery.queueEvent(event);
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;

      const result = await delivery.deliver(queued.value[0]!.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('delivered');
        expect(result.value.statusCode).toBe(200);
        expect(result.value.attempts).toBe(1);
      }
    });

    it('marks as retrying on failure', async () => {
      // Override with failing fetch
      const failingFetch = createMockFetch(500, 'Server Error');
      delivery = new WebhookDeliveryService(storage, manager, { maxRetries: 3 }, failingFetch);
      await delivery.initialize();

      const webhook = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(webhook.ok).toBe(true);
      if (!webhook.ok) return;

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const queued = await delivery.queueEvent(event);
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;

      const result = await delivery.deliver(queued.value[0]!.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('retrying');
        expect(result.value.statusCode).toBe(500);
        expect(result.value.nextRetryAt).toBeDefined();
      }
    });

    it('marks as failed after max retries', async () => {
      const failingFetch = createMockFetch(500, 'Server Error');
      delivery = new WebhookDeliveryService(storage, manager, { maxRetries: 1 }, failingFetch);
      await delivery.initialize();

      const webhook = await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });
      expect(webhook.ok).toBe(true);
      if (!webhook.ok) return;

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const queued = await delivery.queueEvent(event);
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;

      const result = await delivery.deliver(queued.value[0]!.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('failed');
      }
    });
  });

  describe('listDeliveries', () => {
    it('lists all deliveries', async () => {
      await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });

      const event1: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_1' },
      };

      const event2: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_2' },
      };

      await delivery.queueEvent(event1);
      await delivery.queueEvent(event2);

      const result = await delivery.listDeliveries();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('filters by status', async () => {
      await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const queued = await delivery.queueEvent(event);
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;

      // Deliver one
      await delivery.deliver(queued.value[0]!.id);

      const deliveredResult = await delivery.listDeliveries({ status: 'delivered' });
      expect(deliveredResult.ok).toBe(true);
      if (deliveredResult.ok) {
        expect(deliveredResult.value.length).toBe(1);
      }
    });
  });

  describe('getAttempts', () => {
    it('retrieves delivery attempts', async () => {
      await manager.create({
        url: 'https://example.com/webhook',
        events: ['entity.created'],
      });

      const event: WebhookEvent = {
        id: generateEventId(),
        type: 'entity.created',
        timestamp: Date.now(),
        data: { entityId: 'ent_123' },
      };

      const queued = await delivery.queueEvent(event);
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;

      await delivery.deliver(queued.value[0]!.id);

      const result = await delivery.getAttempts(queued.value[0]!.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.attemptNumber).toBe(1);
        expect(result.value[0]!.statusCode).toBe(200);
      }
    });
  });
});
