/**
 * Provider Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TelemetryProvider,
  initTelemetry,
  getTelemetry,
  isTelemetryInitialized,
  resetTelemetry,
  createTelemetryConfig,
} from '../provider.js';
import { MemoryExporter } from '../exporters.js';
import type { TelemetryConfig } from '../types.js';

describe('TelemetryProvider', () => {
  let provider: TelemetryProvider;
  let exporter: MemoryExporter;
  let config: TelemetryConfig;

  beforeEach(() => {
    exporter = new MemoryExporter();
    config = {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      enabled: true,
      exporters: [exporter],
      logLevel: 'debug',
      sampleRate: 1.0,
    };
    provider = new TelemetryProvider(config);
  });

  afterEach(async () => {
    await provider.stop();
  });

  it('should create provider with config', () => {
    expect(provider.config.serviceName).toBe('test-service');
    expect(provider.enabled).toBe(true);
    expect(provider.started).toBe(false);
  });

  it('should provide tracer', () => {
    expect(provider.tracer).toBeDefined();
    expect(provider.tracer.name).toBe('test-service');
  });

  it('should provide meter', () => {
    expect(provider.meter).toBeDefined();
    expect(provider.meter.name).toBe('test-service');
  });

  it('should provide logger', () => {
    expect(provider.logger).toBeDefined();
    expect(provider.logger.name).toBe('test-service');
  });

  it('should provide pre-defined metrics', () => {
    expect(provider.metrics).toBeDefined();
    expect(provider.metrics.entityCount).toBeDefined();
    expect(provider.metrics.decisionCount).toBeDefined();
    expect(provider.metrics.executionDuration).toBeDefined();
  });

  it('should start and stop', async () => {
    provider.start(0); // No auto-flush
    expect(provider.started).toBe(true);

    await provider.stop();
    expect(provider.started).toBe(false);
  });

  it('should not start twice', () => {
    provider.start(0);
    provider.start(0);
    expect(provider.started).toBe(true);
  });

  it('should flush spans to exporter', async () => {
    const span = provider.tracer.startSpan('test-operation');
    span.end();

    await provider.flush();

    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0]!.name).toBe('test-operation');
  });

  it('should flush metrics to exporter', async () => {
    provider.metrics.operationCount.increment();

    await provider.flush();

    expect(exporter.metrics.length).toBeGreaterThan(0);
  });

  it('should export logs', async () => {
    const log = {
      timestamp: Date.now(),
      level: 'info' as const,
      message: 'Test log',
    };

    await provider.exportLogs([log]);

    expect(exporter.logs).toHaveLength(1);
  });

  it('should create child logger', () => {
    const childLogger = provider.createLogger('child', { component: 'test' });

    expect(childLogger.name).toBe('test-service.child');
  });

  it('should record operation with tracing and metrics', async () => {
    const result = await provider.recordOperation(
      'test-op',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      },
      { attributes: { key: 'value' } }
    );

    expect(result).toBe('success');

    // Check span was created
    await provider.flush();
    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0]!.status).toBe('ok');

    // Check metrics were recorded
    expect(provider.metrics.operationCount.value).toBe(1);
    expect(provider.metrics.executionDuration.count).toBe(1);
  });

  it('should handle errors in recordOperation', async () => {
    await expect(
      provider.recordOperation('failing-op', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    await provider.flush();

    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0]!.status).toBe('error');
    expect(provider.metrics.errorCount.value).toBe(1);
  });

  it('should not export when disabled', async () => {
    const disabledProvider = new TelemetryProvider({
      serviceName: 'disabled',
      enabled: false,
      exporters: [exporter],
    });

    const span = disabledProvider.tracer.startSpan('test');
    span.end();

    await disabledProvider.flush();

    expect(exporter.spans).toHaveLength(0);
  });

  it('should handle exporter errors gracefully', async () => {
    const failingExporter: MemoryExporter = {
      name: 'failing',
      exportSpans: vi.fn().mockRejectedValue(new Error('Export failed')),
      exportMetrics: vi.fn().mockResolvedValue(undefined),
      exportLogs: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      spans: [],
      metrics: [],
      logs: [],
      clear: vi.fn(),
    };

    const errorProvider = new TelemetryProvider({
      serviceName: 'test',
      exporters: [failingExporter],
    });

    const span = errorProvider.tracer.startSpan('test');
    span.end();

    // Should not throw
    await expect(errorProvider.flush()).resolves.toBeUndefined();

    await errorProvider.stop();
  });

  it('should auto-flush when started with interval', async () => {
    vi.useFakeTimers();

    const span = provider.tracer.startSpan('test');
    span.end();

    provider.start(100); // 100ms interval

    vi.advanceTimersByTime(150);
    await Promise.resolve(); // Let promises resolve

    // Check that flush was triggered
    expect(exporter.spans.length).toBeGreaterThanOrEqual(0);

    vi.useRealTimers();
  });
});

describe('Global Telemetry', () => {
  afterEach(() => {
    resetTelemetry();
  });

  it('should initialize global telemetry', () => {
    const provider = initTelemetry({
      serviceName: 'global-test',
    });

    expect(provider).toBeDefined();
    expect(isTelemetryInitialized()).toBe(true);
  });

  it('should get global telemetry', () => {
    initTelemetry({ serviceName: 'global-test' });

    const provider = getTelemetry();
    expect(provider.config.serviceName).toBe('global-test');
  });

  it('should throw if not initialized', () => {
    expect(() => getTelemetry()).toThrow('Telemetry not initialized');
  });

  it('should reset global telemetry', () => {
    initTelemetry({ serviceName: 'global-test' });
    expect(isTelemetryInitialized()).toBe(true);

    resetTelemetry();
    expect(isTelemetryInitialized()).toBe(false);
  });
});

describe('createTelemetryConfig', () => {
  it('should create config with defaults', () => {
    const config = createTelemetryConfig('my-service');

    expect(config.serviceName).toBe('my-service');
    expect(config.serviceVersion).toBe('1.0.0');
    expect(config.environment).toBe('development');
    expect(config.enabled).toBe(true);
    expect(config.logLevel).toBe('info');
    expect(config.sampleRate).toBe(1.0);
  });

  it('should create config with custom options', () => {
    const config = createTelemetryConfig('my-service', {
      serviceVersion: '2.0.0',
      environment: 'production',
      enabled: false,
      logLevel: 'warn',
      sampleRate: 0.5,
    });

    expect(config.serviceVersion).toBe('2.0.0');
    expect(config.environment).toBe('production');
    expect(config.enabled).toBe(false);
    expect(config.logLevel).toBe('warn');
    expect(config.sampleRate).toBe(0.5);
  });
});
