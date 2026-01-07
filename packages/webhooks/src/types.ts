/**
 * Webhook Types
 *
 * Type definitions for the webhook delivery system.
 */

import type { Timestamp } from '@contextgraph/core';

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'entity.created'
  | 'entity.updated'
  | 'entity.deleted'
  | 'claim.added'
  | 'claim.revoked'
  | 'agent.created'
  | 'agent.updated'
  | 'agent.suspended'
  | 'decision.proposed'
  | 'decision.approved'
  | 'decision.rejected'
  | 'decision.executed'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.archived'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed';

/**
 * Webhook status
 */
export type WebhookStatus = 'active' | 'inactive' | 'failed';

/**
 * Webhook delivery status
 */
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

/**
 * Webhook registration data
 */
export interface WebhookData {
  readonly id: string;
  readonly url: string;
  readonly secret: string;
  readonly events: readonly WebhookEventType[];
  readonly status: WebhookStatus;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly lastDeliveryAt?: Timestamp;
  readonly failureCount: number;
}

/**
 * Webhook registration input
 */
export interface CreateWebhookInput {
  readonly url: string;
  readonly events: readonly WebhookEventType[];
  readonly secret?: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Webhook update input
 */
export interface UpdateWebhookInput {
  readonly url?: string;
  readonly events?: readonly WebhookEventType[];
  readonly secret?: string;
  readonly description?: string;
  readonly status?: WebhookStatus;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Webhook event payload
 */
export interface WebhookEvent<T = unknown> {
  readonly id: string;
  readonly type: WebhookEventType;
  readonly timestamp: Timestamp;
  readonly data: T;
}

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
  readonly id: string;
  readonly webhookId: string;
  readonly eventId: string;
  readonly eventType: WebhookEventType;
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
 * Webhook delivery attempt
 */
export interface DeliveryAttempt {
  readonly deliveryId: string;
  readonly attemptNumber: number;
  readonly timestamp: Timestamp;
  readonly statusCode?: number;
  readonly responseBody?: string;
  readonly errorMessage?: string;
  readonly durationMs: number;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Maximum retry attempts (default: 5) */
  readonly maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  readonly initialRetryDelay?: number;
  /** Maximum retry delay in ms (default: 3600000 = 1 hour) */
  readonly maxRetryDelay?: number;
  /** Retry backoff multiplier (default: 2) */
  readonly backoffMultiplier?: number;
  /** Request timeout in ms (default: 30000) */
  readonly requestTimeout?: number;
  /** Number of consecutive failures before marking webhook as failed (default: 10) */
  readonly failureThreshold?: number;
}

/**
 * Webhook delivery options
 */
export interface DeliveryOptions {
  /** Skip queue and deliver immediately */
  readonly immediate?: boolean;
  /** Custom headers to include */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Webhook query options
 */
export interface WebhookQueryOptions {
  readonly status?: WebhookStatus;
  readonly event?: WebhookEventType;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Delivery query options
 */
export interface DeliveryQueryOptions {
  readonly webhookId?: string;
  readonly eventType?: WebhookEventType;
  readonly status?: DeliveryStatus;
  readonly since?: Timestamp;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Webhook statistics
 */
export interface WebhookStats {
  readonly totalWebhooks: number;
  readonly activeWebhooks: number;
  readonly totalDeliveries: number;
  readonly successfulDeliveries: number;
  readonly failedDeliveries: number;
  readonly pendingDeliveries: number;
}
