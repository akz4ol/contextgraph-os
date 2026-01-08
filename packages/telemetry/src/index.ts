/**
 * @contextgraph/telemetry
 *
 * OpenTelemetry-compatible telemetry for ContextGraph OS.
 * Provides tracing, metrics, and structured logging.
 */

// Types
export type {
  LogLevel,
  SpanStatus,
  SpanKind,
  AttributeValue,
  Attributes,
  SpanContext,
  SpanEvent,
  SpanLink,
  SpanData,
  MetricType,
  MetricDataPoint,
  HistogramBucket,
  HistogramData,
  MetricData,
  LogRecord,
  TelemetryExporter,
  TelemetryConfig,
  SpanOptions,
  CounterOptions,
  HistogramOptions,
  GaugeOptions,
} from './types.js';

// Tracing
export {
  Span,
  Tracer,
  parseTraceParent,
  formatTraceParent,
} from './tracing.js';

// Metrics
export {
  Counter,
  Gauge,
  Histogram,
  Meter,
  createContextGraphMetrics,
} from './metrics.js';

// Logging
export type { LogHandler } from './logging.js';
export {
  Logger,
  MemoryLogHandler,
  consoleLogHandler,
  jsonLogHandler,
  noopLogHandler,
  createLogger,
} from './logging.js';

// Exporters
export {
  ConsoleExporter,
  MemoryExporter,
  NoopExporter,
  MultiExporter,
  OTLPJsonExporter,
} from './exporters.js';

// Provider
export {
  TelemetryProvider,
  initTelemetry,
  getTelemetry,
  isTelemetryInitialized,
  resetTelemetry,
  createTelemetryConfig,
} from './provider.js';
