/**
 * Webhook Delivery System
 *
 * Handles reliable delivery of webhook events with retry logic.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Timestamp } from '@contextgraph/core';
import type { StorageInterface, StorageRecord } from '@contextgraph/storage';
import type {
  WebhookData,
  WebhookEvent,
  WebhookDelivery as WebhookDeliveryData,
  DeliveryAttempt,
  WebhookConfig,
  DeliveryStatus,
  DeliveryQueryOptions,
  WebhookEventType,
} from './types.js';
import {
  generateSignature,
  generateDeliveryId,
  calculateRetryDelay,
  formatWebhookHeaders,
} from './utils.js';
import { WebhookManager } from './manager.js';

/**
 * Delivery record in storage
 */
interface DeliveryRecord extends StorageRecord {
  readonly id: string;
  readonly webhookId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly payload: string; // JSON
  readonly status: DeliveryStatus;
  readonly statusCode?: number;
  readonly responseBody?: string;
  readonly errorMessage?: string;
  readonly attempts: number;
  readonly nextRetryAt?: Timestamp;
  readonly createdAt: Timestamp;
  readonly deliveredAt?: Timestamp;
}

/**
 * Attempt record in storage
 */
interface AttemptRecord extends StorageRecord {
  readonly id: string;
  readonly deliveryId: string;
  readonly attemptNumber: number;
  readonly timestamp: Timestamp;
  readonly createdAt: Timestamp;
  readonly statusCode?: number;
  readonly responseBody?: string;
  readonly errorMessage?: string;
  readonly durationMs: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<WebhookConfig> = {
  maxRetries: 5,
  initialRetryDelay: 1000,
  maxRetryDelay: 3600000, // 1 hour
  backoffMultiplier: 2,
  requestTimeout: 30000, // 30 seconds
  failureThreshold: 10,
};

/**
 * HTTP fetch function type (for testing)
 */
type FetchFunction = (url: string, options: RequestInit) => Promise<Response>;

/**
 * Webhook Delivery Service
 */
export class WebhookDeliveryService {
  private readonly storage: StorageInterface;
  private readonly webhookManager: WebhookManager;
  private readonly config: Required<WebhookConfig>;
  private readonly deliveryCollection = 'webhook_deliveries';
  private readonly attemptCollection = 'webhook_attempts';
  private readonly fetchFn: FetchFunction;
  private processingTimer: NodeJS.Timeout | null = null;

  constructor(
    storage: StorageInterface,
    webhookManager: WebhookManager,
    config: WebhookConfig = {},
    fetchFn?: FetchFunction
  ) {
    this.storage = storage;
    this.webhookManager = webhookManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /**
   * Initialize delivery storage
   */
  async initialize(): Promise<Result<void, Error>> {
    return this.storage.initialize();
  }

  /**
   * Queue an event for delivery to all subscribed webhooks
   */
  async queueEvent<T>(event: WebhookEvent<T>): Promise<Result<readonly WebhookDeliveryData[], Error>> {
    const webhooksResult = await this.webhookManager.getByEvent(event.type);
    if (!webhooksResult.ok) {
      return err(webhooksResult.error);
    }

    const deliveries: WebhookDeliveryData[] = [];
    const payload = JSON.stringify(event);

    for (const webhook of webhooksResult.value) {
      const deliveryResult = await this.createDelivery(webhook, event.id, event.type, payload);
      if (deliveryResult.ok) {
        deliveries.push(deliveryResult.value);
      }
    }

    return ok(deliveries);
  }

  /**
   * Create a delivery record
   */
  private async createDelivery(
    webhook: WebhookData,
    eventId: string,
    eventType: WebhookEventType,
    payload: string
  ): Promise<Result<WebhookDeliveryData, Error>> {
    const now = createTimestamp();
    const id = generateDeliveryId();

    const record: DeliveryRecord = {
      id,
      webhookId: webhook.id,
      eventId,
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: now,
    };

    const result = await this.storage.insert(this.deliveryCollection, record);
    if (!result.ok) {
      return err(result.error);
    }

    return ok(this.recordToDelivery(record));
  }

  /**
   * Deliver a webhook immediately
   */
  async deliver(deliveryId: string): Promise<Result<WebhookDeliveryData, Error>> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery.ok) {
      return err(delivery.error);
    }
    if (delivery.value === null) {
      return err(new Error(`Delivery not found: ${deliveryId}`));
    }

    const webhook = await this.webhookManager.get(delivery.value.webhookId);
    if (!webhook.ok) {
      return err(webhook.error);
    }
    if (webhook.value === null) {
      return err(new Error(`Webhook not found: ${delivery.value.webhookId}`));
    }

    return this.attemptDelivery(delivery.value, webhook.value);
  }

  /**
   * Attempt to deliver a webhook
   */
  private async attemptDelivery(
    delivery: WebhookDeliveryData,
    webhook: WebhookData
  ): Promise<Result<WebhookDeliveryData, Error>> {
    const attemptNumber = delivery.attempts + 1;
    const startTime = Date.now();

    // Get the payload from storage
    const record = await this.storage.findById<DeliveryRecord>(this.deliveryCollection, delivery.id);
    if (!record.ok || record.value === null) {
      return err(new Error('Delivery record not found'));
    }

    const payload = record.value.payload;
    const signature = generateSignature(payload, webhook.secret);
    const now = createTimestamp();
    const headers = formatWebhookHeaders(
      delivery.eventId,
      delivery.eventType,
      signature,
      now
    );

    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout);

      const response = await this.fetchFn(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      statusCode = response.status;

      try {
        responseBody = await response.text();
      } catch {
        responseBody = '';
      }

      // Consider 2xx status codes as success
      success = statusCode >= 200 && statusCode < 300;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const durationMs = Date.now() - startTime;

    // Record the attempt
    await this.recordAttempt(delivery.id, attemptNumber, statusCode, responseBody, errorMessage, durationMs);

    // Build updated record
    const updatedNow = createTimestamp();
    let newStatus: DeliveryStatus;
    let nextRetryAt: Timestamp | undefined;

    if (success) {
      newStatus = 'delivered';
      // Update webhook last delivery
      await this.webhookManager.recordDelivery(webhook.id);
    } else if (attemptNumber >= this.config.maxRetries) {
      newStatus = 'failed';
      // Record failure on webhook
      await this.webhookManager.recordFailure(webhook.id);
    } else {
      newStatus = 'retrying';
      const retryDelay = calculateRetryDelay(
        attemptNumber,
        this.config.initialRetryDelay,
        this.config.maxRetryDelay,
        this.config.backoffMultiplier
      );
      nextRetryAt = (updatedNow + retryDelay) as Timestamp;
    }

    const updatedRecord: DeliveryRecord = {
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
      payload: record.value.payload,
      status: newStatus,
      attempts: attemptNumber,
      createdAt: delivery.createdAt,
      ...(statusCode !== undefined ? { statusCode } : {}),
      ...(responseBody !== undefined ? { responseBody: responseBody.substring(0, 1000) } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
      ...(nextRetryAt !== undefined ? { nextRetryAt } : {}),
      ...(newStatus === 'delivered' ? { deliveredAt: updatedNow } : {}),
    };

    await this.storage.upsert(this.deliveryCollection, updatedRecord);

    return ok(this.recordToDelivery(updatedRecord));
  }

  /**
   * Record a delivery attempt
   */
  private async recordAttempt(
    deliveryId: string,
    attemptNumber: number,
    statusCode: number | undefined,
    responseBody: string | undefined,
    errorMessage: string | undefined,
    durationMs: number
  ): Promise<void> {
    const now = createTimestamp();
    const record: AttemptRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      deliveryId,
      attemptNumber,
      timestamp: now,
      createdAt: now,
      durationMs,
      ...(statusCode !== undefined ? { statusCode } : {}),
      ...(responseBody !== undefined ? { responseBody: responseBody.substring(0, 1000) } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    };

    await this.storage.insert(this.attemptCollection, record);
  }

  /**
   * Get a delivery by ID
   */
  async getDelivery(id: string): Promise<Result<WebhookDeliveryData | null, Error>> {
    const result = await this.storage.findById<DeliveryRecord>(this.deliveryCollection, id);
    if (!result.ok) {
      return err(result.error);
    }

    if (result.value === null) {
      return ok(null);
    }

    return ok(this.recordToDelivery(result.value));
  }

  /**
   * List deliveries with optional filtering
   */
  async listDeliveries(options: DeliveryQueryOptions = {}): Promise<Result<readonly WebhookDeliveryData[], Error>> {
    const query: Record<string, unknown> = {};

    if (options.webhookId !== undefined) {
      query['webhookId'] = options.webhookId;
    }
    if (options.eventType !== undefined) {
      query['eventType'] = options.eventType;
    }
    if (options.status !== undefined) {
      query['status'] = options.status;
    }

    const queryOptions: { limit: number; offset?: number } = {
      limit: options.limit ?? 100,
    };
    if (options.offset !== undefined) {
      queryOptions.offset = options.offset;
    }
    const result = await this.storage.find<DeliveryRecord>(this.deliveryCollection, query, queryOptions);

    if (!result.ok) {
      return err(result.error);
    }

    let deliveries = result.value.items.map((record) => this.recordToDelivery(record));

    // Filter by timestamp if specified
    if (options.since !== undefined) {
      deliveries = deliveries.filter((d) => d.createdAt >= options.since!);
    }

    return ok(deliveries);
  }

  /**
   * Get attempts for a delivery
   */
  async getAttempts(deliveryId: string): Promise<Result<readonly DeliveryAttempt[], Error>> {
    const result = await this.storage.find<AttemptRecord>(
      this.attemptCollection,
      { deliveryId },
      { limit: 100 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value.items.map((record) => this.recordToAttempt(record)));
  }

  /**
   * Get pending deliveries that are ready for retry
   */
  async getPendingRetries(): Promise<Result<readonly WebhookDeliveryData[], Error>> {
    const now = createTimestamp();
    const result = await this.storage.find<DeliveryRecord>(
      this.deliveryCollection,
      { status: 'retrying' },
      { limit: 100 }
    );

    if (!result.ok) {
      return err(result.error);
    }

    const ready = result.value.items
      .filter((r) => r.nextRetryAt === undefined || r.nextRetryAt <= now)
      .map((record) => this.recordToDelivery(record));

    return ok(ready);
  }

  /**
   * Process all pending retries
   */
  async processRetries(): Promise<Result<number, Error>> {
    const pendingResult = await this.getPendingRetries();
    if (!pendingResult.ok) {
      return err(pendingResult.error);
    }

    let processed = 0;
    for (const delivery of pendingResult.value) {
      const result = await this.deliver(delivery.id);
      if (result.ok) {
        processed++;
      }
    }

    return ok(processed);
  }

  /**
   * Start background retry processing
   */
  startRetryProcessor(intervalMs: number = 60000): void {
    if (this.processingTimer !== null) {
      return;
    }

    this.processingTimer = setInterval(async () => {
      await this.processRetries();
    }, intervalMs);
  }

  /**
   * Stop background retry processing
   */
  stopRetryProcessor(): void {
    if (this.processingTimer !== null) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Convert storage record to delivery
   */
  private recordToDelivery(record: DeliveryRecord): WebhookDeliveryData {
    const delivery: WebhookDeliveryData = {
      id: record.id,
      webhookId: record.webhookId,
      eventId: record.eventId,
      eventType: record.eventType as WebhookEventType,
      status: record.status,
      attempts: record.attempts,
      createdAt: record.createdAt,
      ...(record.statusCode !== undefined ? { statusCode: record.statusCode } : {}),
      ...(record.responseBody !== undefined ? { responseBody: record.responseBody } : {}),
      ...(record.errorMessage !== undefined ? { errorMessage: record.errorMessage } : {}),
      ...(record.nextRetryAt !== undefined ? { nextRetryAt: record.nextRetryAt } : {}),
      ...(record.deliveredAt !== undefined ? { deliveredAt: record.deliveredAt } : {}),
    };

    return delivery;
  }

  /**
   * Convert storage record to attempt
   */
  private recordToAttempt(record: AttemptRecord): DeliveryAttempt {
    const attempt: DeliveryAttempt = {
      deliveryId: record.deliveryId,
      attemptNumber: record.attemptNumber,
      timestamp: record.timestamp,
      durationMs: record.durationMs,
      ...(record.statusCode !== undefined ? { statusCode: record.statusCode } : {}),
      ...(record.responseBody !== undefined ? { responseBody: record.responseBody } : {}),
      ...(record.errorMessage !== undefined ? { errorMessage: record.errorMessage } : {}),
    };

    return attempt;
  }
}
