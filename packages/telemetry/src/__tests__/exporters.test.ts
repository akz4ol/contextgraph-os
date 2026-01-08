/**
 * Exporters Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConsoleExporter,
  MemoryExporter,
  NoopExporter,
  MultiExporter,
  OTLPJsonExporter,
} from '../exporters.js';
import type { SpanData, MetricData, LogRecord } from '../types.js';

const createTestSpan = (name: string): SpanData => ({
  name,
  context: {
    traceId: 'abc123def456abc123def456abc12345',
    spanId: '1234567890abcdef',
    traceFlags: 1,
  },
  kind: 'internal',
  startTime: Date.now() - 100,
  endTime: Date.now(),
  status: 'ok',
  attributes: { key: 'value' },
  events: [{ name: 'event', timestamp: Date.now() }],
  links: [],
});

const createTestMetric = (name: string): MetricData => ({
  name,
  type: 'counter',
  description: 'Test metric',
  unit: 'ops',
  dataPoints: [{ timestamp: Date.now(), value: 42 }],
});

const createTestLog = (message: string): LogRecord => ({
  timestamp: Date.now(),
  level: 'info',
  message,
  traceId: 'trace123',
  spanId: 'span456',
  attributes: { key: 'value' },
});

describe('ConsoleExporter', () => {
  let exporter: ConsoleExporter;

  beforeEach(() => {
    exporter = new ConsoleExporter();
  });

  it('should have name', () => {
    expect(exporter.name).toBe('console');
  });

  it('should export spans to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await exporter.exportSpans([createTestSpan('test-span')]);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[SPAN] test-span'));

    logSpy.mockRestore();
  });

  it('should export metrics to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await exporter.exportMetrics([createTestMetric('test.metric')]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[METRIC] test.metric'));

    logSpy.mockRestore();
  });

  it('should export logs to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await exporter.exportLogs([createTestLog('Test message')]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[LOG]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));

    logSpy.mockRestore();
  });

  it('should shutdown without error', async () => {
    await expect(exporter.shutdown()).resolves.toBeUndefined();
  });
});

describe('MemoryExporter', () => {
  let exporter: MemoryExporter;

  beforeEach(() => {
    exporter = new MemoryExporter();
  });

  it('should have name', () => {
    expect(exporter.name).toBe('memory');
  });

  it('should store spans', async () => {
    const span = createTestSpan('test-span');
    await exporter.exportSpans([span]);

    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0]).toEqual(span);
  });

  it('should store metrics', async () => {
    const metric = createTestMetric('test.metric');
    await exporter.exportMetrics([metric]);

    expect(exporter.metrics).toHaveLength(1);
    expect(exporter.metrics[0]).toEqual(metric);
  });

  it('should store logs', async () => {
    const log = createTestLog('Test message');
    await exporter.exportLogs([log]);

    expect(exporter.logs).toHaveLength(1);
    expect(exporter.logs[0]).toEqual(log);
  });

  it('should accumulate data', async () => {
    await exporter.exportSpans([createTestSpan('span1')]);
    await exporter.exportSpans([createTestSpan('span2')]);

    expect(exporter.spans).toHaveLength(2);
  });

  it('should clear data', async () => {
    await exporter.exportSpans([createTestSpan('span1')]);
    await exporter.exportMetrics([createTestMetric('metric1')]);
    await exporter.exportLogs([createTestLog('log1')]);

    exporter.clear();

    expect(exporter.spans).toHaveLength(0);
    expect(exporter.metrics).toHaveLength(0);
    expect(exporter.logs).toHaveLength(0);
  });
});

describe('NoopExporter', () => {
  let exporter: NoopExporter;

  beforeEach(() => {
    exporter = new NoopExporter();
  });

  it('should have name', () => {
    expect(exporter.name).toBe('noop');
  });

  it('should discard spans', async () => {
    await expect(exporter.exportSpans([createTestSpan('test')])).resolves.toBeUndefined();
  });

  it('should discard metrics', async () => {
    await expect(exporter.exportMetrics([createTestMetric('test')])).resolves.toBeUndefined();
  });

  it('should discard logs', async () => {
    await expect(exporter.exportLogs([createTestLog('test')])).resolves.toBeUndefined();
  });
});

describe('MultiExporter', () => {
  it('should forward to multiple exporters', async () => {
    const exporter1 = new MemoryExporter();
    const exporter2 = new MemoryExporter();
    const multi = new MultiExporter([exporter1, exporter2]);

    expect(multi.name).toBe('multi');

    await multi.exportSpans([createTestSpan('test')]);

    expect(exporter1.spans).toHaveLength(1);
    expect(exporter2.spans).toHaveLength(1);
  });

  it('should forward metrics to all exporters', async () => {
    const exporter1 = new MemoryExporter();
    const exporter2 = new MemoryExporter();
    const multi = new MultiExporter([exporter1, exporter2]);

    await multi.exportMetrics([createTestMetric('test')]);

    expect(exporter1.metrics).toHaveLength(1);
    expect(exporter2.metrics).toHaveLength(1);
  });

  it('should forward logs to all exporters', async () => {
    const exporter1 = new MemoryExporter();
    const exporter2 = new MemoryExporter();
    const multi = new MultiExporter([exporter1, exporter2]);

    await multi.exportLogs([createTestLog('test')]);

    expect(exporter1.logs).toHaveLength(1);
    expect(exporter2.logs).toHaveLength(1);
  });

  it('should shutdown all exporters', async () => {
    const exporter1 = new MemoryExporter();
    const exporter2 = new MemoryExporter();
    const shutdown1 = vi.spyOn(exporter1, 'shutdown');
    const shutdown2 = vi.spyOn(exporter2, 'shutdown');
    const multi = new MultiExporter([exporter1, exporter2]);

    await multi.shutdown();

    expect(shutdown1).toHaveBeenCalled();
    expect(shutdown2).toHaveBeenCalled();
  });
});

describe('OTLPJsonExporter', () => {
  let exporter: OTLPJsonExporter;

  beforeEach(() => {
    exporter = new OTLPJsonExporter('test-service', '1.0.0');
  });

  it('should have name', () => {
    expect(exporter.name).toBe('otlp-json');
  });

  it('should create OTLP span payload', async () => {
    await exporter.exportSpans([createTestSpan('test-span')]);

    expect(exporter.payloads).toHaveLength(1);
    expect(exporter.payloads[0]!.type).toBe('spans');

    const payload = exporter.payloads[0]!.data as {
      resourceSpans: Array<{
        resource: { attributes: unknown[] };
        scopeSpans: Array<{
          spans: Array<{
            name: string;
            traceId: string;
            spanId: string;
          }>;
        }>;
      }>;
    };
    expect(payload.resourceSpans).toHaveLength(1);
    expect(payload.resourceSpans[0]!.resource.attributes).toEqual([
      { key: 'service.name', value: { stringValue: 'test-service' } },
      { key: 'service.version', value: { stringValue: '1.0.0' } },
    ]);

    const span = payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.name).toBe('test-span');
    expect(span.traceId).toBe('abc123def456abc123def456abc12345');
  });

  it('should create OTLP metrics payload', async () => {
    await exporter.exportMetrics([createTestMetric('test.metric')]);

    expect(exporter.payloads).toHaveLength(1);
    expect(exporter.payloads[0]!.type).toBe('metrics');

    const payload = exporter.payloads[0]!.data as {
      resourceMetrics: Array<{
        scopeMetrics: Array<{
          metrics: Array<{ name: string }>;
        }>;
      }>;
    };
    expect(payload.resourceMetrics).toHaveLength(1);

    const metric = payload.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;
    expect(metric.name).toBe('test.metric');
  });

  it('should create OTLP logs payload', async () => {
    await exporter.exportLogs([createTestLog('Test message')]);

    expect(exporter.payloads).toHaveLength(1);
    expect(exporter.payloads[0]!.type).toBe('logs');

    const payload = exporter.payloads[0]!.data as {
      resourceLogs: Array<{
        scopeLogs: Array<{
          logRecords: Array<{
            body: { stringValue: string };
            severityText: string;
          }>;
        }>;
      }>;
    };
    expect(payload.resourceLogs).toHaveLength(1);

    const log = payload.resourceLogs[0]!.scopeLogs[0]!.logRecords[0]!;
    expect(log.body.stringValue).toBe('Test message');
    expect(log.severityText).toBe('INFO');
  });

  it('should convert attribute types correctly', async () => {
    const span: SpanData = {
      ...createTestSpan('test'),
      attributes: {
        stringVal: 'hello',
        intVal: 42,
        floatVal: 3.14,
        boolVal: true,
        arrayVal: ['a', 'b'],
      },
    };

    await exporter.exportSpans([span]);

    const payload = exporter.payloads[0]!.data as {
      resourceSpans: Array<{
        scopeSpans: Array<{
          spans: Array<{
            attributes: Array<{ key: string; value: unknown }>;
          }>;
        }>;
      }>;
    };
    const attrs = payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.attributes;

    expect(attrs.find((a) => a.key === 'stringVal')!.value).toEqual({ stringValue: 'hello' });
    expect(attrs.find((a) => a.key === 'intVal')!.value).toEqual({ intValue: '42' });
    expect(attrs.find((a) => a.key === 'floatVal')!.value).toEqual({ doubleValue: 3.14 });
    expect(attrs.find((a) => a.key === 'boolVal')!.value).toEqual({ boolValue: true });
    expect(attrs.find((a) => a.key === 'arrayVal')!.value).toEqual({
      arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] },
    });
  });

  it('should map span kinds correctly', async () => {
    const kinds: Array<{ kind: SpanData['kind']; expected: number }> = [
      { kind: 'internal', expected: 1 },
      { kind: 'server', expected: 2 },
      { kind: 'client', expected: 3 },
      { kind: 'producer', expected: 4 },
      { kind: 'consumer', expected: 5 },
    ];

    for (const { kind, expected } of kinds) {
      exporter.clear();
      await exporter.exportSpans([{ ...createTestSpan('test'), kind }]);

      const payload = exporter.payloads[0]!.data as {
        resourceSpans: Array<{
          scopeSpans: Array<{
            spans: Array<{ kind: number }>;
          }>;
        }>;
      };
      expect(payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.kind).toBe(expected);
    }
  });

  it('should map log levels to severity numbers', async () => {
    const levels: Array<{ level: LogRecord['level']; expected: number }> = [
      { level: 'debug', expected: 5 },
      { level: 'info', expected: 9 },
      { level: 'warn', expected: 13 },
      { level: 'error', expected: 17 },
    ];

    for (const { level, expected } of levels) {
      exporter.clear();
      await exporter.exportLogs([{ ...createTestLog('test'), level }]);

      const payload = exporter.payloads[0]!.data as {
        resourceLogs: Array<{
          scopeLogs: Array<{
            logRecords: Array<{ severityNumber: number }>;
          }>;
        }>;
      };
      expect(payload.resourceLogs[0]!.scopeLogs[0]!.logRecords[0]!.severityNumber).toBe(expected);
    }
  });

  it('should clear payloads', async () => {
    await exporter.exportSpans([createTestSpan('test')]);
    exporter.clear();

    expect(exporter.payloads).toHaveLength(0);
  });
});
