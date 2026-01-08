/**
 * Telemetry Provider
 *
 * Central telemetry management for ContextGraph.
 */

import type {
  TelemetryConfig,
  TelemetryExporter,
  SpanData,
  MetricData,
  LogRecord,
  Attributes,
} from './types.js';
import { Tracer } from './tracing.js';
import { Meter, createContextGraphMetrics } from './metrics.js';
import { Logger, createLogger, consoleLogHandler, jsonLogHandler } from './logging.js';
import { ConsoleExporter, NoopExporter } from './exporters.js';

/**
 * Telemetry provider - central manager for all telemetry
 */
export class TelemetryProvider {
  private readonly _config: TelemetryConfig;
  private readonly _tracer: Tracer;
  private readonly _meter: Meter;
  private readonly _logger: Logger;
  private readonly _exporters: TelemetryExporter[];
  private readonly _contextGraphMetrics: ReturnType<typeof createContextGraphMetrics>;
  private _flushInterval: ReturnType<typeof setInterval> | undefined;
  private _started = false;

  constructor(config: TelemetryConfig) {
    this._config = config;

    // Initialize tracer
    this._tracer = new Tracer(
      config.serviceName,
      config.serviceVersion ?? '1.0.0',
      config.defaultAttributes ?? {},
      config.sampleRate ?? 1.0
    );

    // Initialize meter
    this._meter = new Meter(config.serviceName, config.serviceVersion ?? '1.0.0');

    // Initialize pre-defined metrics
    this._contextGraphMetrics = createContextGraphMetrics(this._meter);

    // Initialize logger
    this._logger = createLogger(config.serviceName, {
      level: config.logLevel ?? 'info',
      ...(config.defaultAttributes !== undefined ? { attributes: config.defaultAttributes } : {}),
      handlers: [],
    });

    // Add default log handler based on environment
    if (config.environment === 'production') {
      this._logger.addHandler(jsonLogHandler);
    } else {
      this._logger.addHandler(consoleLogHandler);
    }

    // Initialize exporters
    if (config.enabled === false) {
      this._exporters = [new NoopExporter()];
    } else if (config.exporters !== undefined && config.exporters.length > 0) {
      this._exporters = [...config.exporters];
    } else {
      this._exporters = [new ConsoleExporter()];
    }
  }

  /**
   * Get the config
   */
  get config(): TelemetryConfig {
    return this._config;
  }

  /**
   * Get the tracer
   */
  get tracer(): Tracer {
    return this._tracer;
  }

  /**
   * Get the meter
   */
  get meter(): Meter {
    return this._meter;
  }

  /**
   * Get the logger
   */
  get logger(): Logger {
    return this._logger;
  }

  /**
   * Get pre-defined ContextGraph metrics
   */
  get metrics(): ReturnType<typeof createContextGraphMetrics> {
    return this._contextGraphMetrics;
  }

  /**
   * Check if telemetry is enabled
   */
  get enabled(): boolean {
    return this._config.enabled !== false;
  }

  /**
   * Check if provider has started
   */
  get started(): boolean {
    return this._started;
  }

  /**
   * Start the provider with automatic flushing
   */
  start(flushIntervalMs: number = 30000): void {
    if (this._started) {
      return;
    }

    this._started = true;

    if (this.enabled && flushIntervalMs > 0) {
      this._flushInterval = setInterval(() => {
        void this.flush();
      }, flushIntervalMs);
    }
  }

  /**
   * Stop the provider
   */
  async stop(): Promise<void> {
    if (!this._started) {
      return;
    }

    this._started = false;

    if (this._flushInterval !== undefined) {
      clearInterval(this._flushInterval);
      this._flushInterval = undefined;
    }

    // Final flush
    await this.flush();

    // Shutdown exporters
    await this.shutdown();
  }

  /**
   * Flush telemetry data to exporters
   */
  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const spans = this._tracer.flush();
    const metrics = this._meter.getMetrics();

    if (spans.length > 0 || metrics.length > 0) {
      await this.exportSpans(spans);
      await this.exportMetrics(metrics);
    }
  }

  /**
   * Export spans
   */
  async exportSpans(spans: readonly SpanData[]): Promise<void> {
    if (!this.enabled || spans.length === 0) {
      return;
    }

    await Promise.all(
      this._exporters.map((exporter) =>
        exporter.exportSpans(spans).catch((error) => {
          this._logger.error(`Failed to export spans to ${exporter.name}`, {
            error: String(error),
          });
        })
      )
    );
  }

  /**
   * Export metrics
   */
  async exportMetrics(metrics: readonly MetricData[]): Promise<void> {
    if (!this.enabled || metrics.length === 0) {
      return;
    }

    await Promise.all(
      this._exporters.map((exporter) =>
        exporter.exportMetrics(metrics).catch((error) => {
          this._logger.error(`Failed to export metrics to ${exporter.name}`, {
            error: String(error),
          });
        })
      )
    );
  }

  /**
   * Export logs
   */
  async exportLogs(logs: readonly LogRecord[]): Promise<void> {
    if (!this.enabled || logs.length === 0) {
      return;
    }

    await Promise.all(
      this._exporters.map((exporter) =>
        exporter.exportLogs(logs).catch((error) => {
          this._logger.error(`Failed to export logs to ${exporter.name}`, {
            error: String(error),
          });
        })
      )
    );
  }

  /**
   * Shutdown all exporters
   */
  async shutdown(): Promise<void> {
    await Promise.all(
      this._exporters.map((exporter) =>
        exporter.shutdown().catch((error) => {
          console.error(`Failed to shutdown exporter ${exporter.name}:`, error);
        })
      )
    );
  }

  /**
   * Create a child logger
   */
  createLogger(name: string, attributes?: Attributes): Logger {
    return this._logger.child(name, attributes);
  }

  /**
   * Record an operation with tracing and metrics
   */
  async recordOperation<T>(
    name: string,
    operation: () => Promise<T>,
    options: {
      attributes?: Attributes;
      recordDuration?: boolean;
    } = {}
  ): Promise<T> {
    const span = this._tracer.startSpan(name, options.attributes !== undefined ? { attributes: options.attributes } : {});
    const startTime = Date.now();

    try {
      const result = await operation();
      span.setStatus('ok');
      this._contextGraphMetrics.operationCount.increment({ operation: name });

      if (options.recordDuration !== false) {
        this._contextGraphMetrics.executionDuration.record(Date.now() - startTime, {
          operation: name,
        });
      }

      return result;
    } catch (error) {
      span.recordException(error as Error);
      this._contextGraphMetrics.errorCount.increment({ operation: name });
      throw error;
    } finally {
      span.end();
    }
  }
}

/**
 * Global telemetry instance
 */
let globalProvider: TelemetryProvider | undefined;

/**
 * Initialize global telemetry
 */
export function initTelemetry(config: TelemetryConfig): TelemetryProvider {
  globalProvider = new TelemetryProvider(config);
  return globalProvider;
}

/**
 * Get global telemetry provider
 */
export function getTelemetry(): TelemetryProvider {
  if (globalProvider === undefined) {
    throw new Error('Telemetry not initialized. Call initTelemetry() first.');
  }
  return globalProvider;
}

/**
 * Check if telemetry is initialized
 */
export function isTelemetryInitialized(): boolean {
  return globalProvider !== undefined;
}

/**
 * Reset global telemetry (for testing)
 */
export function resetTelemetry(): void {
  globalProvider = undefined;
}

/**
 * Create a default telemetry config
 */
export function createTelemetryConfig(
  serviceName: string,
  options: Partial<Omit<TelemetryConfig, 'serviceName'>> = {}
): TelemetryConfig {
  return {
    serviceName,
    serviceVersion: options.serviceVersion ?? '1.0.0',
    environment: options.environment ?? 'development',
    enabled: options.enabled ?? true,
    ...(options.exporters !== undefined ? { exporters: options.exporters } : {}),
    ...(options.defaultAttributes !== undefined ? { defaultAttributes: options.defaultAttributes } : {}),
    logLevel: options.logLevel ?? 'info',
    sampleRate: options.sampleRate ?? 1.0,
  };
}
