/**
 * Metrics
 *
 * Counters, gauges, and histograms for measuring application behavior.
 */

import { createTimestamp } from '@contextgraph/core';
import type { Timestamp } from '@contextgraph/core';
import type {
  MetricData,
  MetricDataPoint,
  MetricType,
  Attributes,
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  HistogramBucket,
  HistogramData,
} from './types.js';

/**
 * Base metric class
 */
abstract class BaseMetric {
  protected readonly _name: string;
  protected readonly _description?: string;
  protected readonly _unit?: string;
  protected readonly _dataPoints: MetricDataPoint[] = [];

  constructor(name: string, options: { description?: string; unit?: string } = {}) {
    this._name = name;
    if (options.description !== undefined) {
      this._description = options.description;
    }
    if (options.unit !== undefined) {
      this._unit = options.unit;
    }
  }

  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get unit(): string | undefined {
    return this._unit;
  }

  abstract get type(): MetricType;

  toMetricData(): MetricData {
    return {
      name: this._name,
      ...(this._description !== undefined ? { description: this._description } : {}),
      ...(this._unit !== undefined ? { unit: this._unit } : {}),
      type: this.type,
      dataPoints: [...this._dataPoints],
    };
  }

  clear(): void {
    this._dataPoints.length = 0;
  }
}

/**
 * Counter metric - monotonically increasing value
 */
export class Counter extends BaseMetric {
  private _value = 0;

  constructor(name: string, options: CounterOptions = {}) {
    super(name, options);
  }

  get type(): MetricType {
    return 'counter';
  }

  get value(): number {
    return this._value;
  }

  /**
   * Add to the counter
   */
  add(value: number = 1, attributes?: Attributes): void {
    if (value < 0) {
      throw new Error('Counter can only be incremented');
    }
    this._value += value;
    this._dataPoints.push({
      timestamp: createTimestamp(),
      value: this._value,
      ...(attributes !== undefined ? { attributes } : {}),
    });
  }

  /**
   * Increment by 1
   */
  increment(attributes?: Attributes): void {
    this.add(1, attributes);
  }

  /**
   * Reset the counter (for testing)
   */
  reset(): void {
    this._value = 0;
    this.clear();
  }
}

/**
 * Gauge metric - value that can go up and down
 */
export class Gauge extends BaseMetric {
  private _value = 0;

  constructor(name: string, options: GaugeOptions = {}) {
    super(name, options);
  }

  get type(): MetricType {
    return 'gauge';
  }

  get value(): number {
    return this._value;
  }

  /**
   * Set the gauge value
   */
  set(value: number, attributes?: Attributes): void {
    this._value = value;
    this._dataPoints.push({
      timestamp: createTimestamp(),
      value: this._value,
      ...(attributes !== undefined ? { attributes } : {}),
    });
  }

  /**
   * Add to the gauge
   */
  add(delta: number, attributes?: Attributes): void {
    this._value += delta;
    this._dataPoints.push({
      timestamp: createTimestamp(),
      value: this._value,
      ...(attributes !== undefined ? { attributes } : {}),
    });
  }

  /**
   * Subtract from the gauge
   */
  subtract(delta: number, attributes?: Attributes): void {
    this.add(-delta, attributes);
  }

  /**
   * Reset the gauge
   */
  reset(): void {
    this._value = 0;
    this.clear();
  }
}

/**
 * Histogram metric - distribution of values
 */
export class Histogram extends BaseMetric {
  private readonly _boundaries: readonly number[];
  private readonly _buckets: number[];
  private _count = 0;
  private _sum = 0;
  private _min = Infinity;
  private _max = -Infinity;

  constructor(name: string, options: HistogramOptions = {}) {
    super(name, options);
    // Default boundaries for millisecond latencies
    this._boundaries = options.boundaries ?? [0, 5, 10, 25, 50, 75, 100, 250, 500, 1000, 2500, 5000, 10000];
    this._buckets = new Array(this._boundaries.length + 1).fill(0);
  }

  get type(): MetricType {
    return 'histogram';
  }

  get count(): number {
    return this._count;
  }

  get sum(): number {
    return this._sum;
  }

  get min(): number {
    return this._min === Infinity ? 0 : this._min;
  }

  get max(): number {
    return this._max === -Infinity ? 0 : this._max;
  }

  get mean(): number {
    return this._count === 0 ? 0 : this._sum / this._count;
  }

  /**
   * Record a value
   */
  record(value: number, attributes?: Attributes): void {
    this._count++;
    this._sum += value;
    this._min = Math.min(this._min, value);
    this._max = Math.max(this._max, value);

    // Find bucket
    let bucketIndex = this._boundaries.length;
    for (let i = 0; i < this._boundaries.length; i++) {
      if (value <= this._boundaries[i]!) {
        bucketIndex = i;
        break;
      }
    }
    this._buckets[bucketIndex]!++;

    this._dataPoints.push({
      timestamp: createTimestamp(),
      value,
      ...(attributes !== undefined ? { attributes } : {}),
    });
  }

  /**
   * Record a duration (helper for timing)
   */
  recordDuration(startTime: Timestamp, attributes?: Attributes): void {
    const duration = createTimestamp() - startTime;
    this.record(duration, attributes);
  }

  /**
   * Get histogram data
   */
  getHistogramData(): HistogramData {
    const buckets: HistogramBucket[] = [];
    for (let i = 0; i < this._boundaries.length; i++) {
      buckets.push({
        boundary: this._boundaries[i]!,
        count: this._buckets[i]!,
      });
    }
    // Overflow bucket
    buckets.push({
      boundary: Infinity,
      count: this._buckets[this._boundaries.length]!,
    });

    return {
      count: this._count,
      sum: this._sum,
      min: this.min,
      max: this.max,
      buckets,
    };
  }

  /**
   * Reset the histogram
   */
  reset(): void {
    this._count = 0;
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
    this._buckets.fill(0);
    this.clear();
  }

  /**
   * Create a timer
   */
  startTimer(attributes?: Attributes): () => void {
    const start = createTimestamp();
    return () => this.recordDuration(start, attributes);
  }
}

/**
 * Meter for creating metrics
 */
export class Meter {
  private readonly _name: string;
  private readonly _counters: Map<string, Counter> = new Map();
  private readonly _gauges: Map<string, Gauge> = new Map();
  private readonly _histograms: Map<string, Histogram> = new Map();

  constructor(name: string, _version: string = '1.0.0') {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  /**
   * Create or get a counter
   */
  createCounter(name: string, options: CounterOptions = {}): Counter {
    const fullName = `${this._name}.${name}`;
    let counter = this._counters.get(fullName);
    if (counter === undefined) {
      counter = new Counter(fullName, options);
      this._counters.set(fullName, counter);
    }
    return counter;
  }

  /**
   * Create or get a gauge
   */
  createGauge(name: string, options: GaugeOptions = {}): Gauge {
    const fullName = `${this._name}.${name}`;
    let gauge = this._gauges.get(fullName);
    if (gauge === undefined) {
      gauge = new Gauge(fullName, options);
      this._gauges.set(fullName, gauge);
    }
    return gauge;
  }

  /**
   * Create or get a histogram
   */
  createHistogram(name: string, options: HistogramOptions = {}): Histogram {
    const fullName = `${this._name}.${name}`;
    let histogram = this._histograms.get(fullName);
    if (histogram === undefined) {
      histogram = new Histogram(fullName, options);
      this._histograms.set(fullName, histogram);
    }
    return histogram;
  }

  /**
   * Get all metrics
   */
  getMetrics(): readonly MetricData[] {
    const metrics: MetricData[] = [];

    for (const counter of this._counters.values()) {
      metrics.push(counter.toMetricData());
    }

    for (const gauge of this._gauges.values()) {
      metrics.push(gauge.toMetricData());
    }

    for (const histogram of this._histograms.values()) {
      metrics.push(histogram.toMetricData());
    }

    return metrics;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    for (const counter of this._counters.values()) {
      counter.reset();
    }
    for (const gauge of this._gauges.values()) {
      gauge.reset();
    }
    for (const histogram of this._histograms.values()) {
      histogram.reset();
    }
  }
}

/**
 * Pre-defined ContextGraph metrics
 */
export function createContextGraphMetrics(meter: Meter): {
  entityCount: Gauge;
  claimCount: Gauge;
  agentCount: Gauge;
  decisionCount: Counter;
  executionDuration: Histogram;
  provenanceVerificationDuration: Histogram;
  policyEvaluationDuration: Histogram;
  operationCount: Counter;
  errorCount: Counter;
} {
  return {
    entityCount: meter.createGauge('entities.count', {
      description: 'Total number of entities',
      unit: 'entities',
    }),
    claimCount: meter.createGauge('claims.count', {
      description: 'Total number of claims',
      unit: 'claims',
    }),
    agentCount: meter.createGauge('agents.count', {
      description: 'Total number of agents',
      unit: 'agents',
    }),
    decisionCount: meter.createCounter('decisions.count', {
      description: 'Total number of decisions recorded',
      unit: 'decisions',
    }),
    executionDuration: meter.createHistogram('executions.duration', {
      description: 'Duration of action executions',
      unit: 'ms',
    }),
    provenanceVerificationDuration: meter.createHistogram('provenance.verification.duration', {
      description: 'Duration of provenance chain verification',
      unit: 'ms',
    }),
    policyEvaluationDuration: meter.createHistogram('policy.evaluation.duration', {
      description: 'Duration of policy evaluation',
      unit: 'ms',
    }),
    operationCount: meter.createCounter('operations.count', {
      description: 'Total number of operations',
      unit: 'operations',
    }),
    errorCount: meter.createCounter('errors.count', {
      description: 'Total number of errors',
      unit: 'errors',
    }),
  };
}
