/**
 * Webhook Manager
 *
 * Manages webhook registrations and provides CRUD operations.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface, StorageRecord } from '@contextgraph/storage';
import type {
  WebhookData,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookQueryOptions,
  WebhookEventType,
  WebhookStatus,
} from './types.js';
import { generateSecret } from './utils.js';

/**
 * Webhook record in storage
 */
interface WebhookRecord extends StorageRecord {
  readonly id: string;
  readonly url: string;
  readonly secret: string;
  readonly events: string; // JSON array
  readonly status: WebhookStatus;
  readonly description?: string;
  readonly metadata?: string; // JSON object
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly lastDeliveryAt?: Timestamp;
  readonly failureCount: number;
}

/**
 * Webhook Manager class
 */
export class WebhookManager {
  private readonly storage: StorageInterface;
  private readonly collection = 'webhooks';

  constructor(storage: StorageInterface) {
    this.storage = storage;
  }

  /**
   * Initialize webhook storage
   */
  async initialize(): Promise<Result<void, Error>> {
    return this.storage.initialize();
  }

  /**
   * Create a new webhook
   */
  async create(input: CreateWebhookInput): Promise<Result<WebhookData, Error>> {
    // Validate URL
    try {
      new URL(input.url);
    } catch {
      return err(new Error(`Invalid webhook URL: ${input.url}`));
    }

    // Validate events
    if (input.events.length === 0) {
      return err(new Error('At least one event type is required'));
    }

    const now = createTimestamp();
    const id = `whk_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const secret = input.secret ?? generateSecret();

    const record: WebhookRecord = {
      id,
      url: input.url,
      secret,
      events: JSON.stringify(input.events),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      failureCount: 0,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.metadata !== undefined ? { metadata: JSON.stringify(input.metadata) } : {}),
    };

    const result = await this.storage.insert(this.collection, record);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(record));
  }

  /**
   * Get webhook by ID
   */
  async get(id: string): Promise<Result<WebhookData | null, Error>> {
    const result = await this.storage.findById<WebhookRecord>(this.collection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(this.recordToData(result.value));
  }

  /**
   * Update a webhook
   */
  async update(id: string, input: UpdateWebhookInput): Promise<Result<WebhookData, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return err(new Error(`Webhook not found: ${id}`));
    }

    // Validate URL if provided
    if (input.url !== undefined) {
      try {
        new URL(input.url);
      } catch {
        return err(new Error(`Invalid webhook URL: ${input.url}`));
      }
    }

    const now = createTimestamp();

    const updatedRecord: WebhookRecord = {
      id,
      url: input.url ?? existing.value.url,
      secret: input.secret ?? existing.value.secret,
      events: input.events !== undefined ? JSON.stringify(input.events) : JSON.stringify(existing.value.events),
      status: input.status ?? existing.value.status,
      createdAt: existing.value.createdAt,
      updatedAt: now,
      failureCount: existing.value.failureCount,
      ...(input.description !== undefined ? { description: input.description } : existing.value.description !== undefined ? { description: existing.value.description } : {}),
      ...(input.metadata !== undefined ? { metadata: JSON.stringify(input.metadata) } : existing.value.metadata !== undefined ? { metadata: JSON.stringify(existing.value.metadata) } : {}),
      ...(existing.value.lastDeliveryAt !== undefined ? { lastDeliveryAt: existing.value.lastDeliveryAt } : {}),
    };

    const result = await this.storage.upsert(this.collection, updatedRecord);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(updatedRecord));
  }

  /**
   * Delete a webhook (marks as inactive since storage may be append-only)
   */
  async delete(id: string): Promise<Result<boolean, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return ok(false);
    }

    // Mark as inactive (soft delete) since raw SQL delete may not be supported
    const updateResult = await this.update(id, { status: 'inactive' });
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok(true);
  }

  /**
   * List webhooks with optional filtering
   */
  async list(options: WebhookQueryOptions = {}): Promise<Result<readonly WebhookData[], Error>> {
    const query: Record<string, unknown> = {};

    if (options.status !== undefined) {
      query['status'] = options.status;
    }

    const queryOptions: { limit: number; offset?: number } = {
      limit: options.limit ?? 100,
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }
    const result = await this.storage.find<WebhookRecord>(this.collection, query, queryOptions);

    if (!result.ok) {
      return err(result.error);
    }

    let webhooks = result.value.items.map((record) => this.recordToData(record));

    // Filter by event type if specified (post-query filter since events is JSON)
    if (options.event !== undefined) {
      webhooks = webhooks.filter((w) => w.events.includes(options.event!));
    }

    return ok(webhooks);
  }

  /**
   * Get webhooks subscribed to a specific event
   */
  async getByEvent(eventType: WebhookEventType): Promise<Result<readonly WebhookData[], Error>> {
    const result = await this.storage.find<WebhookRecord>(this.collection, { status: 'active' }, { limit: 1000 });
    if (!result.ok) {
      return err(result.error);
    }

    const webhooks = result.value.items
      .map((record) => this.recordToData(record))
      .filter((w) => w.events.includes(eventType));

    return ok(webhooks);
  }

  /**
   * Update webhook failure count
   */
  async recordFailure(id: string): Promise<Result<WebhookData, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return err(new Error(`Webhook not found: ${id}`));
    }

    const now = createTimestamp();
    const newFailureCount = existing.value.failureCount + 1;

    const updatedRecord: WebhookRecord = {
      id,
      url: existing.value.url,
      secret: existing.value.secret,
      events: JSON.stringify(existing.value.events),
      status: existing.value.status,
      createdAt: existing.value.createdAt,
      updatedAt: now,
      failureCount: newFailureCount,
      ...(existing.value.description !== undefined ? { description: existing.value.description } : {}),
      ...(existing.value.metadata !== undefined ? { metadata: JSON.stringify(existing.value.metadata) } : {}),
      ...(existing.value.lastDeliveryAt !== undefined ? { lastDeliveryAt: existing.value.lastDeliveryAt } : {}),
    };

    const result = await this.storage.upsert(this.collection, updatedRecord);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(updatedRecord));
  }

  /**
   * Reset webhook failure count and reactivate
   */
  async resetFailures(id: string): Promise<Result<WebhookData, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return err(new Error(`Webhook not found: ${id}`));
    }

    const now = createTimestamp();

    const updatedRecord: WebhookRecord = {
      id,
      url: existing.value.url,
      secret: existing.value.secret,
      events: JSON.stringify(existing.value.events),
      status: 'active',
      createdAt: existing.value.createdAt,
      updatedAt: now,
      failureCount: 0,
      ...(existing.value.description !== undefined ? { description: existing.value.description } : {}),
      ...(existing.value.metadata !== undefined ? { metadata: JSON.stringify(existing.value.metadata) } : {}),
      ...(existing.value.lastDeliveryAt !== undefined ? { lastDeliveryAt: existing.value.lastDeliveryAt } : {}),
    };

    const result = await this.storage.upsert(this.collection, updatedRecord);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToData(updatedRecord));
  }

  /**
   * Update last delivery timestamp
   */
  async recordDelivery(id: string): Promise<Result<void, Error>> {
    const existing = await this.get(id);
    if (!existing.ok) {
      return err(existing.error);
    }
    if (existing.value === null) {
      return err(new Error(`Webhook not found: ${id}`));
    }

    const now = createTimestamp();

    const updatedRecord: WebhookRecord = {
      id,
      url: existing.value.url,
      secret: existing.value.secret,
      events: JSON.stringify(existing.value.events),
      status: existing.value.status,
      createdAt: existing.value.createdAt,
      updatedAt: now,
      failureCount: 0, // Reset on successful delivery
      lastDeliveryAt: now,
      ...(existing.value.description !== undefined ? { description: existing.value.description } : {}),
      ...(existing.value.metadata !== undefined ? { metadata: JSON.stringify(existing.value.metadata) } : {}),
    };

    const result = await this.storage.upsert(this.collection, updatedRecord);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(undefined);
  }

  /**
   * Convert storage record to webhook data
   */
  private recordToData(record: WebhookRecord): WebhookData {
    const data: WebhookData = {
      id: record.id,
      url: record.url,
      secret: record.secret,
      events: JSON.parse(record.events) as WebhookEventType[],
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      failureCount: record.failureCount,
      ...(record.description !== undefined ? { description: record.description } : {}),
      ...(record.metadata !== undefined ? { metadata: JSON.parse(record.metadata) } : {}),
      ...(record.lastDeliveryAt !== undefined ? { lastDeliveryAt: record.lastDeliveryAt } : {}),
    };

    return data;
  }
}
