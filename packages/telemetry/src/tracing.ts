/**
 * Tracing
 *
 * Distributed tracing with spans and context propagation.
 */

import { createTimestamp } from '@contextgraph/core';
import type { Timestamp } from '@contextgraph/core';
import type {
  SpanContext,
  SpanData,
  SpanEvent,
  SpanLink,
  SpanKind,
  SpanStatus,
  SpanOptions,
  Attributes,
  AttributeValue,
} from './types.js';

/**
 * Generate a random ID
 */
function generateId(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate trace ID (32 hex chars)
 */
function generateTraceId(): string {
  return generateId(32);
}

/**
 * Generate span ID (16 hex chars)
 */
function generateSpanId(): string {
  return generateId(16);
}

/**
 * Span class
 */
export class Span {
  private readonly _name: string;
  private readonly _context: SpanContext;
  private readonly _parentSpanId: string | undefined;
  private readonly _kind: SpanKind;
  private readonly _startTime: Timestamp;
  private _endTime?: Timestamp;
  private _status: SpanStatus = 'unset';
  private _statusMessage?: string;
  private readonly _attributes: Map<string, AttributeValue> = new Map();
  private readonly _events: SpanEvent[] = [];
  private readonly _links: readonly SpanLink[] = [];
  private _ended = false;

  constructor(
    name: string,
    traceId: string,
    parentSpanId?: string,
    options: SpanOptions = {}
  ) {
    this._name = name;
    this._context = {
      traceId,
      spanId: generateSpanId(),
      traceFlags: 1, // Sampled
    };
    this._parentSpanId = parentSpanId;
    this._kind = options.kind ?? 'internal';
    this._startTime = createTimestamp();
    if (options.links !== undefined) {
      this._links = options.links;
    }

    if (options.attributes !== undefined) {
      for (const [key, value] of Object.entries(options.attributes)) {
        this._attributes.set(key, value);
      }
    }
  }

  /**
   * Get span context
   */
  get context(): SpanContext {
    return this._context;
  }

  /**
   * Get span name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Check if span has ended
   */
  get ended(): boolean {
    return this._ended;
  }

  /**
   * Set an attribute
   */
  setAttribute(key: string, value: AttributeValue): this {
    if (!this._ended) {
      this._attributes.set(key, value);
    }
    return this;
  }

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: Attributes): this {
    if (!this._ended) {
      for (const [key, value] of Object.entries(attributes)) {
        this._attributes.set(key, value);
      }
    }
    return this;
  }

  /**
   * Add an event
   */
  addEvent(name: string, attributes?: Attributes): this {
    if (!this._ended) {
      this._events.push({
        name,
        timestamp: createTimestamp(),
        ...(attributes !== undefined ? { attributes } : {}),
      });
    }
    return this;
  }

  /**
   * Set status
   */
  setStatus(status: SpanStatus, message?: string): this {
    if (!this._ended) {
      this._status = status;
      if (message !== undefined) {
        this._statusMessage = message;
      }
    }
    return this;
  }

  /**
   * Record an exception
   */
  recordException(error: Error): this {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack ?? '',
    });
    this.setStatus('error', error.message);
    return this;
  }

  /**
   * End the span
   */
  end(): void {
    if (!this._ended) {
      this._endTime = createTimestamp();
      this._ended = true;
    }
  }

  /**
   * Convert to span data
   */
  toSpanData(): SpanData {
    const attributes: Record<string, AttributeValue> = {};
    for (const [key, value] of this._attributes) {
      attributes[key] = value;
    }

    return {
      name: this._name,
      context: this._context,
      ...(this._parentSpanId !== undefined ? { parentSpanId: this._parentSpanId } : {}),
      kind: this._kind,
      startTime: this._startTime,
      ...(this._endTime !== undefined ? { endTime: this._endTime } : {}),
      status: this._status,
      ...(this._statusMessage !== undefined ? { statusMessage: this._statusMessage } : {}),
      attributes,
      events: [...this._events],
      links: this._links,
    };
  }

  /**
   * Get duration in milliseconds
   */
  getDuration(): number | undefined {
    if (this._endTime === undefined) {
      return undefined;
    }
    return this._endTime - this._startTime;
  }
}

/**
 * Tracer class
 */
export class Tracer {
  private readonly _name: string;
  private readonly _spans: Span[] = [];
  private readonly _activeSpans: Map<string, Span> = new Map();
  private readonly _defaultAttributes: Attributes;
  private readonly _sampleRate: number;
  private _currentSpan: Span | undefined;

  constructor(
    name: string,
    _version: string = '1.0.0',
    defaultAttributes: Attributes = {},
    sampleRate: number = 1.0
  ) {
    this._name = name;
    this._defaultAttributes = defaultAttributes;
    this._sampleRate = sampleRate;
  }

  /**
   * Get tracer name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get current active span
   */
  get currentSpan(): Span | undefined {
    return this._currentSpan;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options: SpanOptions = {}): Span {
    // Determine trace ID
    const traceId = options.parent?.traceId ?? this._currentSpan?.context.traceId ?? generateTraceId();
    const parentSpanId = options.parent?.spanId ?? this._currentSpan?.context.spanId;

    // Apply sampling
    if (Math.random() > this._sampleRate) {
      // Return a no-op span for non-sampled traces
      return new Span(name, traceId, parentSpanId, { ...options, attributes: {} });
    }

    // Merge default attributes
    const attributes: Record<string, AttributeValue> = { ...this._defaultAttributes };
    if (options.attributes !== undefined) {
      Object.assign(attributes, options.attributes);
    }

    const span = new Span(name, traceId, parentSpanId, { ...options, attributes });
    this._spans.push(span);
    this._activeSpans.set(span.context.spanId, span);

    return span;
  }

  /**
   * Start a span and set it as current
   */
  startActiveSpan<T>(name: string, fn: (span: Span) => T, options: SpanOptions = {}): T {
    const span = this.startSpan(name, options);
    const previousSpan = this._currentSpan;
    this._currentSpan = span;

    try {
      const result = fn(span);

      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then((value) => {
            span.setStatus('ok');
            span.end();
            return value;
          })
          .catch((error) => {
            span.recordException(error as Error);
            span.end();
            throw error;
          })
          .finally(() => {
            this._currentSpan = previousSpan;
            this._activeSpans.delete(span.context.spanId);
          }) as T;
      }

      span.setStatus('ok');
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.end();
      throw error;
    } finally {
      if (!(fn(span) instanceof Promise)) {
        this._currentSpan = previousSpan;
        this._activeSpans.delete(span.context.spanId);
      }
    }
  }

  /**
   * Get all recorded spans
   */
  getSpans(): readonly SpanData[] {
    return this._spans.map((s) => s.toSpanData());
  }

  /**
   * Get completed spans
   */
  getCompletedSpans(): readonly SpanData[] {
    return this._spans.filter((s) => s.ended).map((s) => s.toSpanData());
  }

  /**
   * Clear all spans
   */
  clear(): void {
    this._spans.length = 0;
    this._activeSpans.clear();
  }

  /**
   * Flush completed spans
   */
  flush(): readonly SpanData[] {
    const completed = this.getCompletedSpans();
    // Remove completed spans from the list
    for (let i = this._spans.length - 1; i >= 0; i--) {
      if (this._spans[i]!.ended) {
        this._spans.splice(i, 1);
      }
    }
    return completed;
  }
}

/**
 * Create a trace context from headers (W3C Trace Context format)
 */
export function parseTraceParent(traceparent: string): SpanContext | null {
  // Format: version-traceid-spanid-traceflags
  const parts = traceparent.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, spanId, traceFlags] = parts;
  if (version !== '00' || traceId!.length !== 32 || spanId!.length !== 16) {
    return null;
  }

  return {
    traceId: traceId!,
    spanId: spanId!,
    traceFlags: parseInt(traceFlags!, 16),
  };
}

/**
 * Format span context as traceparent header
 */
export function formatTraceParent(context: SpanContext): string {
  const flags = context.traceFlags.toString(16).padStart(2, '0');
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}
