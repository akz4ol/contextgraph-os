/**
 * Metrics Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Counter, Gauge, Histogram, Meter, createContextGraphMetrics } from '../metrics.js';

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('test.counter', { description: 'Test counter', unit: 'ops' });
  });

  it('should start at zero', () => {
    expect(counter.value).toBe(0);
    expect(counter.name).toBe('test.counter');
    expect(counter.description).toBe('Test counter');
    expect(counter.unit).toBe('ops');
    expect(counter.type).toBe('counter');
  });

  it('should increment by 1', () => {
    counter.increment();
    expect(counter.value).toBe(1);
  });

  it('should add value', () => {
    counter.add(5);
    expect(counter.value).toBe(5);

    counter.add(3);
    expect(counter.value).toBe(8);
  });

  it('should reject negative values', () => {
    expect(() => counter.add(-1)).toThrow('Counter can only be incremented');
  });

  it('should record data points', () => {
    counter.increment();
    counter.add(2);

    const data = counter.toMetricData();
    expect(data.dataPoints).toHaveLength(2);
    expect(data.dataPoints[0]!.value).toBe(1);
    expect(data.dataPoints[1]!.value).toBe(3);
  });

  it('should include attributes in data points', () => {
    counter.increment({ operation: 'read' });

    const data = counter.toMetricData();
    expect(data.dataPoints[0]!.attributes).toEqual({ operation: 'read' });
  });

  it('should reset', () => {
    counter.add(10);
    counter.reset();

    expect(counter.value).toBe(0);
    expect(counter.toMetricData().dataPoints).toHaveLength(0);
  });
});

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge('test.gauge', { description: 'Test gauge', unit: 'items' });
  });

  it('should start at zero', () => {
    expect(gauge.value).toBe(0);
    expect(gauge.type).toBe('gauge');
  });

  it('should set value', () => {
    gauge.set(42);
    expect(gauge.value).toBe(42);

    gauge.set(10);
    expect(gauge.value).toBe(10);
  });

  it('should add value', () => {
    gauge.add(5);
    expect(gauge.value).toBe(5);

    gauge.add(3);
    expect(gauge.value).toBe(8);
  });

  it('should subtract value', () => {
    gauge.set(10);
    gauge.subtract(3);
    expect(gauge.value).toBe(7);
  });

  it('should allow negative values', () => {
    gauge.set(-5);
    expect(gauge.value).toBe(-5);
  });

  it('should record data points', () => {
    gauge.set(10);
    gauge.add(5);
    gauge.subtract(3);

    const data = gauge.toMetricData();
    expect(data.dataPoints).toHaveLength(3);
    expect(data.dataPoints[0]!.value).toBe(10);
    expect(data.dataPoints[1]!.value).toBe(15);
    expect(data.dataPoints[2]!.value).toBe(12);
  });

  it('should reset', () => {
    gauge.set(100);
    gauge.reset();

    expect(gauge.value).toBe(0);
    expect(gauge.toMetricData().dataPoints).toHaveLength(0);
  });
});

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram('test.histogram', {
      description: 'Test histogram',
      unit: 'ms',
      boundaries: [0, 10, 50, 100, 500],
    });
  });

  it('should start empty', () => {
    expect(histogram.count).toBe(0);
    expect(histogram.sum).toBe(0);
    expect(histogram.min).toBe(0);
    expect(histogram.max).toBe(0);
    expect(histogram.mean).toBe(0);
    expect(histogram.type).toBe('histogram');
  });

  it('should record values', () => {
    histogram.record(25);
    histogram.record(75);
    histogram.record(150);

    expect(histogram.count).toBe(3);
    expect(histogram.sum).toBe(250);
    expect(histogram.min).toBe(25);
    expect(histogram.max).toBe(150);
    expect(histogram.mean).toBe(250 / 3);
  });

  it('should bucket values correctly', () => {
    // Boundaries: [0, 10, 50, 100, 500]
    // Buckets: <=0, <=10, <=50, <=100, <=500, >500
    histogram.record(0);    // bucket <=0
    histogram.record(5);    // bucket <=10
    histogram.record(25);   // bucket <=50
    histogram.record(25);   // bucket <=50
    histogram.record(75);   // bucket <=100
    histogram.record(200);  // bucket <=500
    histogram.record(1000); // overflow bucket

    const data = histogram.getHistogramData();
    expect(data.buckets[0]!.count).toBe(1);  // <= 0
    expect(data.buckets[1]!.count).toBe(1);  // <= 10
    expect(data.buckets[2]!.count).toBe(2);  // <= 50
    expect(data.buckets[3]!.count).toBe(1);  // <= 100
    expect(data.buckets[4]!.count).toBe(1);  // <= 500
    expect(data.buckets[5]!.count).toBe(1);  // overflow
  });

  it('should use default boundaries if not specified', () => {
    const defaultHistogram = new Histogram('default.histogram');
    expect(defaultHistogram.getHistogramData().buckets.length).toBeGreaterThan(5);
  });

  it('should create timer', async () => {
    const stopTimer = histogram.startTimer();
    await new Promise((resolve) => setTimeout(resolve, 10));
    stopTimer();

    expect(histogram.count).toBe(1);
    expect(histogram.sum).toBeGreaterThan(0);
  });

  it('should reset', () => {
    histogram.record(50);
    histogram.record(100);
    histogram.reset();

    expect(histogram.count).toBe(0);
    expect(histogram.sum).toBe(0);
    expect(histogram.min).toBe(0);
    expect(histogram.max).toBe(0);
    expect(histogram.toMetricData().dataPoints).toHaveLength(0);
  });

  it('should include attributes', () => {
    histogram.record(50, { operation: 'query' });

    const data = histogram.toMetricData();
    expect(data.dataPoints[0]!.attributes).toEqual({ operation: 'query' });
  });
});

describe('Meter', () => {
  let meter: Meter;

  beforeEach(() => {
    meter = new Meter('test-meter', '1.0.0');
  });

  it('should create meter with name', () => {
    expect(meter.name).toBe('test-meter');
  });

  it('should create counter', () => {
    const counter = meter.createCounter('requests', { description: 'Request count' });

    expect(counter.name).toBe('test-meter.requests');
    expect(counter.type).toBe('counter');
  });

  it('should return same counter for same name', () => {
    const counter1 = meter.createCounter('requests');
    const counter2 = meter.createCounter('requests');

    expect(counter1).toBe(counter2);
  });

  it('should create gauge', () => {
    const gauge = meter.createGauge('connections', { description: 'Active connections' });

    expect(gauge.name).toBe('test-meter.connections');
    expect(gauge.type).toBe('gauge');
  });

  it('should create histogram', () => {
    const histogram = meter.createHistogram('latency', { description: 'Request latency' });

    expect(histogram.name).toBe('test-meter.latency');
    expect(histogram.type).toBe('histogram');
  });

  it('should get all metrics', () => {
    const counter = meter.createCounter('requests');
    const gauge = meter.createGauge('connections');
    const histogram = meter.createHistogram('latency');

    counter.increment();
    gauge.set(10);
    histogram.record(50);

    const metrics = meter.getMetrics();
    expect(metrics).toHaveLength(3);

    const types = metrics.map((m) => m.type);
    expect(types).toContain('counter');
    expect(types).toContain('gauge');
    expect(types).toContain('histogram');
  });

  it('should clear all metrics', () => {
    const counter = meter.createCounter('requests');
    const gauge = meter.createGauge('connections');

    counter.add(100);
    gauge.set(50);

    meter.clear();

    expect(counter.value).toBe(0);
    expect(gauge.value).toBe(0);
  });
});

describe('createContextGraphMetrics', () => {
  it('should create all ContextGraph metrics', () => {
    const meter = new Meter('contextgraph');
    const metrics = createContextGraphMetrics(meter);

    expect(metrics.entityCount).toBeDefined();
    expect(metrics.claimCount).toBeDefined();
    expect(metrics.agentCount).toBeDefined();
    expect(metrics.decisionCount).toBeDefined();
    expect(metrics.executionDuration).toBeDefined();
    expect(metrics.provenanceVerificationDuration).toBeDefined();
    expect(metrics.policyEvaluationDuration).toBeDefined();
    expect(metrics.operationCount).toBeDefined();
    expect(metrics.errorCount).toBeDefined();
  });

  it('should have correct metric types', () => {
    const meter = new Meter('contextgraph');
    const metrics = createContextGraphMetrics(meter);

    expect(metrics.entityCount.type).toBe('gauge');
    expect(metrics.decisionCount.type).toBe('counter');
    expect(metrics.executionDuration.type).toBe('histogram');
  });

  it('should be usable', () => {
    const meter = new Meter('contextgraph');
    const metrics = createContextGraphMetrics(meter);

    metrics.entityCount.set(100);
    metrics.decisionCount.increment();
    metrics.executionDuration.record(50);

    expect(metrics.entityCount.value).toBe(100);
    expect(metrics.decisionCount.value).toBe(1);
    expect(metrics.executionDuration.count).toBe(1);
  });
});
