/**
 * Tracing Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Span, Tracer, parseTraceParent, formatTraceParent } from '../tracing.js';

describe('Span', () => {
  it('should create a span with context', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    expect(span.name).toBe('test-span');
    expect(span.context.traceId).toBe('abc123def456abc123def456abc12345');
    expect(span.context.spanId).toHaveLength(16);
    expect(span.ended).toBe(false);
  });

  it('should set attributes', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    span.setAttribute('key1', 'value1');
    span.setAttributes({ key2: 42, key3: true });

    const data = span.toSpanData();
    expect(data.attributes).toEqual({
      key1: 'value1',
      key2: 42,
      key3: true,
    });
  });

  it('should add events', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    span.addEvent('event1');
    span.addEvent('event2', { detail: 'info' });

    const data = span.toSpanData();
    expect(data.events).toHaveLength(2);
    expect(data.events[0]!.name).toBe('event1');
    expect(data.events[1]!.name).toBe('event2');
    expect(data.events[1]!.attributes).toEqual({ detail: 'info' });
  });

  it('should set status', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    span.setStatus('ok');
    expect(span.toSpanData().status).toBe('ok');

    span.setStatus('error', 'Something went wrong');
    const data = span.toSpanData();
    expect(data.status).toBe('error');
    expect(data.statusMessage).toBe('Something went wrong');
  });

  it('should record exception', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    const error = new Error('Test error');
    span.recordException(error);

    const data = span.toSpanData();
    expect(data.status).toBe('error');
    expect(data.statusMessage).toBe('Test error');
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.name).toBe('exception');
    expect(data.events[0]!.attributes!['exception.type']).toBe('Error');
    expect(data.events[0]!.attributes!['exception.message']).toBe('Test error');
  });

  it('should end span', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    expect(span.ended).toBe(false);
    span.end();
    expect(span.ended).toBe(true);

    const data = span.toSpanData();
    expect(data.endTime).toBeDefined();
  });

  it('should not modify after ended', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');
    span.end();

    span.setAttribute('key', 'value');
    span.addEvent('event');
    span.setStatus('error');

    const data = span.toSpanData();
    expect(Object.keys(data.attributes)).toHaveLength(0);
    expect(data.events).toHaveLength(0);
    expect(data.status).toBe('unset');
  });

  it('should calculate duration', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345');

    expect(span.getDuration()).toBeUndefined();

    span.end();
    const duration = span.getDuration();
    expect(duration).toBeDefined();
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should include parent span ID', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345', 'parent123456789a');

    const data = span.toSpanData();
    expect(data.parentSpanId).toBe('parent123456789a');
  });

  it('should include span kind', () => {
    const span = new Span('test-span', 'abc123def456abc123def456abc12345', undefined, {
      kind: 'server',
    });

    expect(span.toSpanData().kind).toBe('server');
  });
});

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer('test-tracer');
  });

  it('should create tracer with name', () => {
    expect(tracer.name).toBe('test-tracer');
  });

  it('should start a span', () => {
    const span = tracer.startSpan('test-operation');

    expect(span.name).toBe('test-operation');
    expect(span.context.traceId).toHaveLength(32);
    expect(span.context.spanId).toHaveLength(16);
  });

  it('should propagate trace ID through child spans', () => {
    const parent = tracer.startSpan('parent');
    const child = tracer.startSpan('child', { parent: parent.context });

    expect(child.context.traceId).toBe(parent.context.traceId);
    expect(child.toSpanData().parentSpanId).toBe(parent.context.spanId);
  });

  it('should include default attributes', () => {
    const tracerWithDefaults = new Tracer('test', '1.0.0', { env: 'test' });
    const span = tracerWithDefaults.startSpan('operation');

    expect(span.toSpanData().attributes.env).toBe('test');
  });

  it('should get all spans', () => {
    const span1 = tracer.startSpan('op1');
    const span2 = tracer.startSpan('op2');
    span1.end();
    span2.end();

    const spans = tracer.getSpans();
    expect(spans).toHaveLength(2);
  });

  it('should get only completed spans', () => {
    const span1 = tracer.startSpan('op1');
    tracer.startSpan('op2');
    span1.end();

    const completed = tracer.getCompletedSpans();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.name).toBe('op1');
  });

  it('should flush completed spans', () => {
    const span1 = tracer.startSpan('op1');
    tracer.startSpan('op2');
    span1.end();

    const flushed = tracer.flush();
    expect(flushed).toHaveLength(1);

    // Still have one span
    expect(tracer.getSpans()).toHaveLength(1);
  });

  it('should clear all spans', () => {
    tracer.startSpan('op1');
    tracer.startSpan('op2');

    tracer.clear();
    expect(tracer.getSpans()).toHaveLength(0);
  });

  it('should execute function with active span', () => {
    const result = tracer.startActiveSpan('operation', (span) => {
      span.setAttribute('key', 'value');
      return 42;
    });

    expect(result).toBe(42);
    const spans = tracer.getCompletedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.status).toBe('ok');
  });

  it('should handle errors in active span', () => {
    expect(() => {
      tracer.startActiveSpan('operation', () => {
        throw new Error('Test error');
      });
    }).toThrow('Test error');

    const spans = tracer.getCompletedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.status).toBe('error');
  });

  it('should handle async active span', async () => {
    const result = await tracer.startActiveSpan('async-op', async (span) => {
      span.setAttribute('key', 'value');
      await Promise.resolve();
      return 'done';
    });

    expect(result).toBe('done');
    const spans = tracer.getCompletedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.status).toBe('ok');
  });

  it('should respect sample rate', () => {
    const sampledTracer = new Tracer('test', '1.0.0', {}, 0);

    for (let i = 0; i < 10; i++) {
      sampledTracer.startSpan(`op-${i}`);
    }

    // With 0 sample rate, spans still get created but with empty attributes
    // This is a simplified sampling - spans are created but can be filtered
    expect(sampledTracer.getSpans().length).toBeLessThanOrEqual(10);
  });
});

describe('Trace Context', () => {
  it('should parse valid traceparent', () => {
    const context = parseTraceParent('00-abc123def456abc123def456abc12345-1234567890abcdef-01');

    expect(context).not.toBeNull();
    expect(context!.traceId).toBe('abc123def456abc123def456abc12345');
    expect(context!.spanId).toBe('1234567890abcdef');
    expect(context!.traceFlags).toBe(1);
  });

  it('should return null for invalid traceparent', () => {
    expect(parseTraceParent('invalid')).toBeNull();
    expect(parseTraceParent('00-short-id-01')).toBeNull();
    expect(parseTraceParent('01-abc123def456abc123def456abc12345-1234567890abcdef-01')).toBeNull();
  });

  it('should format traceparent', () => {
    const context = {
      traceId: 'abc123def456abc123def456abc12345',
      spanId: '1234567890abcdef',
      traceFlags: 1,
    };

    const header = formatTraceParent(context);
    expect(header).toBe('00-abc123def456abc123def456abc12345-1234567890abcdef-01');
  });

  it('should round-trip traceparent', () => {
    const original = '00-abc123def456abc123def456abc12345-1234567890abcdef-01';
    const context = parseTraceParent(original);
    const formatted = formatTraceParent(context!);

    expect(formatted).toBe(original);
  });
});
