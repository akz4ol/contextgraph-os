/**
 * Logging
 *
 * Structured JSON logging with levels and correlation IDs.
 */

import { createTimestamp } from '@contextgraph/core';
import type {
  LogLevel,
  LogRecord,
  Attributes,
  SpanContext,
} from './types.js';

/**
 * Log level priority
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Log handler function
 */
export type LogHandler = (record: LogRecord) => void;

/**
 * Console log handler
 */
export function consoleLogHandler(record: LogRecord): void {
  const timestamp = new Date(record.timestamp).toISOString();
  const level = record.level.toUpperCase().padEnd(5);
  const trace = record.traceId !== undefined ? ` [trace=${record.traceId.slice(0, 8)}]` : '';
  const span = record.spanId !== undefined ? ` [span=${record.spanId.slice(0, 8)}]` : '';

  const attrs = record.attributes !== undefined
    ? ` ${JSON.stringify(record.attributes)}`
    : '';

  const message = `${timestamp} ${level}${trace}${span} ${record.message}${attrs}`;

  switch (record.level) {
    case 'debug':
      console.debug(message);
      break;
    case 'info':
      console.info(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'error':
      console.error(message);
      break;
  }
}

/**
 * JSON log handler (for production)
 */
export function jsonLogHandler(record: LogRecord): void {
  const output = JSON.stringify({
    timestamp: new Date(record.timestamp).toISOString(),
    level: record.level,
    message: record.message,
    ...(record.traceId !== undefined ? { traceId: record.traceId } : {}),
    ...(record.spanId !== undefined ? { spanId: record.spanId } : {}),
    ...(record.attributes !== undefined ? { attributes: record.attributes } : {}),
  });

  switch (record.level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

/**
 * No-op log handler (for testing or disabling logs)
 */
export function noopLogHandler(_record: LogRecord): void {
  // Do nothing
}

/**
 * Memory log handler (stores logs for testing)
 */
export class MemoryLogHandler {
  private readonly _records: LogRecord[] = [];

  handle(record: LogRecord): void {
    this._records.push(record);
  }

  get records(): readonly LogRecord[] {
    return this._records;
  }

  clear(): void {
    this._records.length = 0;
  }

  getHandler(): LogHandler {
    return (record) => this.handle(record);
  }
}

/**
 * Logger class
 */
export class Logger {
  private readonly _name: string;
  private readonly _handlers: LogHandler[] = [];
  private readonly _defaultAttributes: Attributes;
  private _level: LogLevel;
  private _spanContext: SpanContext | undefined;

  constructor(
    name: string,
    level: LogLevel = 'info',
    defaultAttributes: Attributes = {}
  ) {
    this._name = name;
    this._level = level;
    this._defaultAttributes = defaultAttributes;
  }

  get name(): string {
    return this._name;
  }

  get level(): LogLevel {
    return this._level;
  }

  set level(level: LogLevel) {
    this._level = level;
  }

  /**
   * Add a log handler
   */
  addHandler(handler: LogHandler): void {
    this._handlers.push(handler);
  }

  /**
   * Remove a log handler
   */
  removeHandler(handler: LogHandler): void {
    const index = this._handlers.indexOf(handler);
    if (index !== -1) {
      this._handlers.splice(index, 1);
    }
  }

  /**
   * Set span context for correlation
   */
  setSpanContext(context: SpanContext | undefined): void {
    this._spanContext = context;
  }

  /**
   * Create a child logger with additional default attributes
   */
  child(name: string, attributes: Attributes = {}): Logger {
    const childLogger = new Logger(
      `${this._name}.${name}`,
      this._level,
      { ...this._defaultAttributes, ...attributes }
    );

    // Copy handlers
    for (const handler of this._handlers) {
      childLogger.addHandler(handler);
    }

    // Copy span context
    childLogger._spanContext = this._spanContext;

    return childLogger;
  }

  /**
   * Check if a level is enabled
   */
  isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this._level];
  }

  /**
   * Log a message
   */
  log(level: LogLevel, message: string, attributes?: Attributes): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const record: LogRecord = {
      timestamp: createTimestamp(),
      level,
      message,
      ...(attributes !== undefined || Object.keys(this._defaultAttributes).length > 0
        ? { attributes: { ...this._defaultAttributes, ...attributes } }
        : {}),
      ...(this._spanContext?.traceId !== undefined ? { traceId: this._spanContext.traceId } : {}),
      ...(this._spanContext?.spanId !== undefined ? { spanId: this._spanContext.spanId } : {}),
    };

    for (const handler of this._handlers) {
      try {
        handler(record);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, attributes?: Attributes): void {
    this.log('debug', message, attributes);
  }

  /**
   * Log info message
   */
  info(message: string, attributes?: Attributes): void {
    this.log('info', message, attributes);
  }

  /**
   * Log warning message
   */
  warn(message: string, attributes?: Attributes): void {
    this.log('warn', message, attributes);
  }

  /**
   * Log error message
   */
  error(message: string, attributes?: Attributes): void {
    this.log('error', message, attributes);
  }

  /**
   * Log an error with exception details
   */
  exception(error: Error, message?: string, attributes?: Attributes): void {
    this.error(message ?? error.message, {
      ...attributes,
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack ?? '',
    });
  }

  /**
   * Create a timing log helper
   */
  time(label: string, attributes?: Attributes): () => void {
    const start = createTimestamp();
    this.debug(`${label} started`, attributes);
    return () => {
      const duration = createTimestamp() - start;
      this.debug(`${label} completed`, { ...attributes, duration_ms: duration });
    };
  }
}

/**
 * Create a root logger with default configuration
 */
export function createLogger(
  name: string,
  options: {
    level?: LogLevel;
    handlers?: readonly LogHandler[];
    attributes?: Attributes;
    useConsole?: boolean;
    useJson?: boolean;
  } = {}
): Logger {
  const logger = new Logger(
    name,
    options.level ?? 'info',
    options.attributes ?? {}
  );

  if (options.handlers !== undefined) {
    for (const handler of options.handlers) {
      logger.addHandler(handler);
    }
  } else if (options.useJson === true) {
    logger.addHandler(jsonLogHandler);
  } else if (options.useConsole !== false) {
    logger.addHandler(consoleLogHandler);
  }

  return logger;
}
