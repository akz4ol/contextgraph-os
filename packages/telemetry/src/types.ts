/**
 * Telemetry Types
 *
 * Core types for tracing, metrics, and logging.
 */

import type { Timestamp } from '@contextgraph/core';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Span status
 */
export type SpanStatus = 'ok' | 'error' | 'unset';

/**
 * Span kind
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

/**
 * Attribute value types
 */
export type AttributeValue = string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];

/**
 * Attributes map
 */
export type Attributes = Readonly<Record<string, AttributeValue>>;

/**
 * Span context for trace propagation
 */
export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
  readonly traceState?: string;
}

/**
 * Span event
 */
export interface SpanEvent {
  readonly name: string;
  readonly timestamp: Timestamp;
  readonly attributes?: Attributes;
}

/**
 * Span link to other spans
 */
export interface SpanLink {
  readonly context: SpanContext;
  readonly attributes?: Attributes;
}

/**
 * Span data
 */
export interface SpanData {
  readonly name: string;
  readonly context: SpanContext;
  readonly parentSpanId?: string;
  readonly kind: SpanKind;
  readonly startTime: Timestamp;
  readonly endTime?: Timestamp;
  readonly status: SpanStatus;
  readonly statusMessage?: string;
  readonly attributes: Attributes;
  readonly events: readonly SpanEvent[];
  readonly links: readonly SpanLink[];
}

/**
 * Metric type
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Metric data point
 */
export interface MetricDataPoint {
  readonly timestamp: Timestamp;
  readonly value: number;
  readonly attributes?: Attributes;
}

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  readonly boundary: number;
  readonly count: number;
}

/**
 * Histogram data
 */
export interface HistogramData {
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly buckets: readonly HistogramBucket[];
}

/**
 * Metric data
 */
export interface MetricData {
  readonly name: string;
  readonly description?: string;
  readonly unit?: string;
  readonly type: MetricType;
  readonly dataPoints: readonly MetricDataPoint[];
}

/**
 * Log record
 */
export interface LogRecord {
  readonly timestamp: Timestamp;
  readonly level: LogLevel;
  readonly message: string;
  readonly attributes?: Attributes;
  readonly traceId?: string;
  readonly spanId?: string;
}

/**
 * Telemetry exporter interface
 */
export interface TelemetryExporter {
  readonly name: string;
  exportSpans(spans: readonly SpanData[]): Promise<void>;
  exportMetrics(metrics: readonly MetricData[]): Promise<void>;
  exportLogs(logs: readonly LogRecord[]): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  readonly serviceName: string;
  readonly serviceVersion?: string;
  readonly environment?: string;
  readonly enabled?: boolean;
  readonly exporters?: readonly TelemetryExporter[];
  readonly defaultAttributes?: Attributes;
  readonly logLevel?: LogLevel;
  readonly sampleRate?: number;
}

/**
 * Span options
 */
export interface SpanOptions {
  readonly kind?: SpanKind;
  readonly attributes?: Attributes;
  readonly links?: readonly SpanLink[];
  readonly parent?: SpanContext;
}

/**
 * Counter options
 */
export interface CounterOptions {
  readonly description?: string;
  readonly unit?: string;
}

/**
 * Histogram options
 */
export interface HistogramOptions {
  readonly description?: string;
  readonly unit?: string;
  readonly boundaries?: readonly number[];
}

/**
 * Gauge options
 */
export interface GaugeOptions {
  readonly description?: string;
  readonly unit?: string;
}
