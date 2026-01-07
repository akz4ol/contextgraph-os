/**
 * Webhook Utilities
 *
 * Helper functions for webhook operations.
 */

import * as crypto from 'node:crypto';

/**
 * Generate a random webhook secret
 */
export function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate HMAC signature for webhook payload
 */
export function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify HMAC signature
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateSignature(payload, secret);

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `evt_${timestamp}_${random}`;
}

/**
 * Generate a unique delivery ID
 */
export function generateDeliveryId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `dlv_${timestamp}_${random}`;
}

/**
 * Calculate next retry delay using exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  initialDelay: number = 1000,
  maxDelay: number = 3600000,
  multiplier: number = 2
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  // Add some jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Format webhook headers
 */
export function formatWebhookHeaders(
  eventId: string,
  eventType: string,
  signature: string,
  timestamp: number
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Webhook-ID': eventId,
    'X-Webhook-Event': eventType,
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp.toString(),
  };
}
