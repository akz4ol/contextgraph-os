# @contextgraph/telemetry

OpenTelemetry-compatible tracing, metrics, and structured logging.

## Installation

```bash
pnpm add @contextgraph/telemetry
```

## Overview

Observability features:

- Distributed tracing
- Metrics collection
- Structured logging
- Multiple exporters

## Tracing

```typescript
import { Tracer, Span } from '@contextgraph/telemetry';

const tracer = new Tracer('contextgraph-service');

const span = tracer.startSpan('process-request');
span.setAttribute('request.id', requestId);

try {
  await processRequest();
  span.setStatus({ code: 'OK' });
} catch (error) {
  span.setStatus({ code: 'ERROR', message: error.message });
  span.recordException(error);
} finally {
  span.end();
}
```

### Nested Spans

```typescript
const parentSpan = tracer.startSpan('workflow');

const childSpan = tracer.startSpan('step-1', { parent: parentSpan });
await doStep1();
childSpan.end();

const childSpan2 = tracer.startSpan('step-2', { parent: parentSpan });
await doStep2();
childSpan2.end();

parentSpan.end();
```

## Metrics

```typescript
import { Meter, Counter, Histogram, Gauge } from '@contextgraph/telemetry';

const meter = new Meter('contextgraph');

// Counter
const requestCounter = meter.createCounter('requests_total');
requestCounter.add(1, { method: 'GET', path: '/api/entities' });

// Histogram
const latencyHistogram = meter.createHistogram('request_duration_ms');
latencyHistogram.record(45, { method: 'GET' });

// Gauge
const activeConnections = meter.createGauge('active_connections');
activeConnections.set(42);
```

### Pre-defined Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `cg.entities.total` | Gauge | Total entities |
| `cg.claims.total` | Gauge | Total claims |
| `cg.decisions.pending` | Gauge | Pending decisions |
| `cg.executions.total` | Counter | Total executions |
| `cg.policy.evaluations` | Counter | Policy evaluations |

## Logging

```typescript
import { Logger } from '@contextgraph/telemetry';

const logger = new Logger('my-service');

logger.info('Request processed', {
  requestId: '123',
  duration: 45,
});

logger.warn('Rate limit approaching', {
  current: 95,
  limit: 100,
});

logger.error('Failed to process', {
  error: error.message,
  stack: error.stack,
});
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `debug` | Detailed debugging |
| `info` | General information |
| `warn` | Warning conditions |
| `error` | Error conditions |

### Span Correlation

```typescript
// Logs automatically include span context
logger.info('Processing', { spanId: span.context.spanId });
```

## Exporters

### Console Exporter

```typescript
import { ConsoleExporter } from '@contextgraph/telemetry';

const exporter = new ConsoleExporter();
tracer.addExporter(exporter);
```

### Memory Exporter

```typescript
import { MemoryExporter } from '@contextgraph/telemetry';

const exporter = new MemoryExporter();
tracer.addExporter(exporter);

// Get collected spans
const spans = exporter.getSpans();
```

### OTLP Exporter

```typescript
import { OTLPExporter } from '@contextgraph/telemetry';

const exporter = new OTLPExporter({
  endpoint: 'http://collector:4318',
  headers: { 'Authorization': 'Bearer token' },
});
```

### Multi Exporter

```typescript
import { MultiExporter } from '@contextgraph/telemetry';

const multiExporter = new MultiExporter([
  new ConsoleExporter(),
  new OTLPExporter({ endpoint: '...' }),
]);
```
