/**
 * Telemetry Exporters
 *
 * Export telemetry data to various backends.
 */

import type {
  TelemetryExporter,
  SpanData,
  MetricData,
  LogRecord,
} from './types.js';

/**
 * Console exporter - outputs to console (for development)
 */
export class ConsoleExporter implements TelemetryExporter {
  readonly name = 'console';

  async exportSpans(spans: readonly SpanData[]): Promise<void> {
    for (const span of spans) {
      const duration = span.endTime !== undefined
        ? `${span.endTime - span.startTime}ms`
        : 'ongoing';

      console.log(
        `[SPAN] ${span.name} (${span.context.traceId.slice(0, 8)}) ` +
        `status=${span.status} duration=${duration}`
      );

      if (Object.keys(span.attributes).length > 0) {
        console.log(`  attributes: ${JSON.stringify(span.attributes)}`);
      }

      for (const event of span.events) {
        console.log(`  event: ${event.name} at ${new Date(event.timestamp).toISOString()}`);
      }
    }
  }

  async exportMetrics(metrics: readonly MetricData[]): Promise<void> {
    for (const metric of metrics) {
      const latest = metric.dataPoints[metric.dataPoints.length - 1];
      console.log(
        `[METRIC] ${metric.name} (${metric.type}) = ${latest?.value ?? 'N/A'}` +
        (metric.unit !== undefined ? ` ${metric.unit}` : '')
      );
    }
  }

  async exportLogs(logs: readonly LogRecord[]): Promise<void> {
    for (const log of logs) {
      const timestamp = new Date(log.timestamp).toISOString();
      console.log(`[LOG] ${timestamp} ${log.level.toUpperCase()} ${log.message}`);
    }
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}

/**
 * Memory exporter - stores in memory (for testing)
 */
export class MemoryExporter implements TelemetryExporter {
  readonly name = 'memory';

  private readonly _spans: SpanData[] = [];
  private readonly _metrics: MetricData[] = [];
  private readonly _logs: LogRecord[] = [];

  get spans(): readonly SpanData[] {
    return this._spans;
  }

  get metrics(): readonly MetricData[] {
    return this._metrics;
  }

  get logs(): readonly LogRecord[] {
    return this._logs;
  }

  async exportSpans(spans: readonly SpanData[]): Promise<void> {
    this._spans.push(...spans);
  }

  async exportMetrics(metrics: readonly MetricData[]): Promise<void> {
    this._metrics.push(...metrics);
  }

  async exportLogs(logs: readonly LogRecord[]): Promise<void> {
    this._logs.push(...logs);
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  clear(): void {
    this._spans.length = 0;
    this._metrics.length = 0;
    this._logs.length = 0;
  }
}

/**
 * No-op exporter - discards all data
 */
export class NoopExporter implements TelemetryExporter {
  readonly name = 'noop';

  async exportSpans(_spans: readonly SpanData[]): Promise<void> {
    // Discard
  }

  async exportMetrics(_metrics: readonly MetricData[]): Promise<void> {
    // Discard
  }

  async exportLogs(_logs: readonly LogRecord[]): Promise<void> {
    // Discard
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}

/**
 * Multi exporter - forwards to multiple exporters
 */
export class MultiExporter implements TelemetryExporter {
  readonly name = 'multi';
  private readonly _exporters: TelemetryExporter[];

  constructor(exporters: readonly TelemetryExporter[]) {
    this._exporters = [...exporters];
  }

  async exportSpans(spans: readonly SpanData[]): Promise<void> {
    await Promise.all(this._exporters.map((e) => e.exportSpans(spans)));
  }

  async exportMetrics(metrics: readonly MetricData[]): Promise<void> {
    await Promise.all(this._exporters.map((e) => e.exportMetrics(metrics)));
  }

  async exportLogs(logs: readonly LogRecord[]): Promise<void> {
    await Promise.all(this._exporters.map((e) => e.exportLogs(logs)));
  }

  async shutdown(): Promise<void> {
    await Promise.all(this._exporters.map((e) => e.shutdown()));
  }
}

/**
 * OTLP JSON exporter format (for Jaeger, Prometheus, etc.)
 * This creates the JSON payload format - actual HTTP sending would need a runtime
 */
export class OTLPJsonExporter implements TelemetryExporter {
  readonly name = 'otlp-json';
  private readonly _serviceName: string;
  private readonly _serviceVersion: string;
  private readonly _payloads: { type: string; data: unknown }[] = [];

  constructor(serviceName: string, serviceVersion: string = '1.0.0') {
    this._serviceName = serviceName;
    this._serviceVersion = serviceVersion;
  }

  get payloads(): readonly { type: string; data: unknown }[] {
    return this._payloads;
  }

  async exportSpans(spans: readonly SpanData[]): Promise<void> {
    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this._serviceName } },
              { key: 'service.version', value: { stringValue: this._serviceVersion } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: this._serviceName, version: this._serviceVersion },
              spans: spans.map((span) => ({
                traceId: span.context.traceId,
                spanId: span.context.spanId,
                parentSpanId: span.parentSpanId,
                name: span.name,
                kind: this.spanKindToOTLP(span.kind),
                startTimeUnixNano: String(span.startTime * 1_000_000),
                endTimeUnixNano: span.endTime !== undefined ? String(span.endTime * 1_000_000) : undefined,
                attributes: this.attributesToOTLP(span.attributes),
                events: span.events.map((e) => ({
                  name: e.name,
                  timeUnixNano: String(e.timestamp * 1_000_000),
                  attributes: e.attributes !== undefined ? this.attributesToOTLP(e.attributes) : [],
                })),
                status: {
                  code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
                  message: span.statusMessage,
                },
              })),
            },
          ],
        },
      ],
    };

    this._payloads.push({ type: 'spans', data: payload });
  }

  async exportMetrics(metrics: readonly MetricData[]): Promise<void> {
    const payload = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this._serviceName } },
              { key: 'service.version', value: { stringValue: this._serviceVersion } },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: this._serviceName, version: this._serviceVersion },
              metrics: metrics.map((metric) => ({
                name: metric.name,
                description: metric.description,
                unit: metric.unit,
                [metric.type === 'counter' ? 'sum' : metric.type === 'gauge' ? 'gauge' : 'histogram']: {
                  dataPoints: metric.dataPoints.map((dp) => ({
                    timeUnixNano: String(dp.timestamp * 1_000_000),
                    asDouble: dp.value,
                    attributes: dp.attributes !== undefined ? this.attributesToOTLP(dp.attributes) : [],
                  })),
                },
              })),
            },
          ],
        },
      ],
    };

    this._payloads.push({ type: 'metrics', data: payload });
  }

  async exportLogs(logs: readonly LogRecord[]): Promise<void> {
    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this._serviceName } },
              { key: 'service.version', value: { stringValue: this._serviceVersion } },
            ],
          },
          scopeLogs: [
            {
              scope: { name: this._serviceName, version: this._serviceVersion },
              logRecords: logs.map((log) => ({
                timeUnixNano: String(log.timestamp * 1_000_000),
                severityNumber: this.logLevelToSeverity(log.level),
                severityText: log.level.toUpperCase(),
                body: { stringValue: log.message },
                attributes: log.attributes !== undefined ? this.attributesToOTLP(log.attributes) : [],
                traceId: log.traceId,
                spanId: log.spanId,
              })),
            },
          ],
        },
      ],
    };

    this._payloads.push({ type: 'logs', data: payload });
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  private spanKindToOTLP(kind: string): number {
    switch (kind) {
      case 'internal': return 1;
      case 'server': return 2;
      case 'client': return 3;
      case 'producer': return 4;
      case 'consumer': return 5;
      default: return 0;
    }
  }

  private logLevelToSeverity(level: string): number {
    switch (level) {
      case 'debug': return 5;
      case 'info': return 9;
      case 'warn': return 13;
      case 'error': return 17;
      default: return 0;
    }
  }

  private attributesToOTLP(attributes: Record<string, unknown>): { key: string; value: unknown }[] {
    return Object.entries(attributes).map(([key, value]) => ({
      key,
      value: this.valueToOTLP(value),
    }));
  }

  private valueToOTLP(value: unknown): unknown {
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { intValue: String(value) };
      }
      return { doubleValue: value };
    }
    if (typeof value === 'boolean') {
      return { boolValue: value };
    }
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map((v) => this.valueToOTLP(v)) } };
    }
    return { stringValue: String(value) };
  }

  clear(): void {
    this._payloads.length = 0;
  }
}
