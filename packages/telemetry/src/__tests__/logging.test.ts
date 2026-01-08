/**
 * Logging Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Logger,
  MemoryLogHandler,
  consoleLogHandler,
  jsonLogHandler,
  noopLogHandler,
  createLogger,
} from '../logging.js';

describe('Logger', () => {
  let logger: Logger;
  let memoryHandler: MemoryLogHandler;

  beforeEach(() => {
    logger = new Logger('test-logger', 'info');
    memoryHandler = new MemoryLogHandler();
    logger.addHandler(memoryHandler.getHandler());
  });

  it('should have name and level', () => {
    expect(logger.name).toBe('test-logger');
    expect(logger.level).toBe('info');
  });

  it('should log info messages', () => {
    logger.info('Test message');

    expect(memoryHandler.records).toHaveLength(1);
    expect(memoryHandler.records[0]!.level).toBe('info');
    expect(memoryHandler.records[0]!.message).toBe('Test message');
  });

  it('should log with attributes', () => {
    logger.info('Test message', { key: 'value', count: 42 });

    expect(memoryHandler.records[0]!.attributes).toEqual({ key: 'value', count: 42 });
  });

  it('should respect log level', () => {
    logger.debug('Debug message');
    logger.info('Info message');

    // Debug should be filtered out
    expect(memoryHandler.records).toHaveLength(1);
    expect(memoryHandler.records[0]!.level).toBe('info');
  });

  it('should log all levels when set to debug', () => {
    logger.level = 'debug';

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error');

    expect(memoryHandler.records).toHaveLength(4);
    expect(memoryHandler.records.map((r) => r.level)).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('should log only errors when set to error', () => {
    logger.level = 'error';

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error');

    expect(memoryHandler.records).toHaveLength(1);
    expect(memoryHandler.records[0]!.level).toBe('error');
  });

  it('should include span context when set', () => {
    logger.setSpanContext({
      traceId: 'trace123',
      spanId: 'span456',
      traceFlags: 1,
    });

    logger.info('Test message');

    expect(memoryHandler.records[0]!.traceId).toBe('trace123');
    expect(memoryHandler.records[0]!.spanId).toBe('span456');
  });

  it('should log exceptions', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.ts:1:1';

    logger.exception(error);

    const record = memoryHandler.records[0]!;
    expect(record.level).toBe('error');
    expect(record.message).toBe('Test error');
    expect(record.attributes!['exception.type']).toBe('Error');
    expect(record.attributes!['exception.message']).toBe('Test error');
    expect(record.attributes!['exception.stacktrace']).toContain('Error: Test error');
  });

  it('should log exceptions with custom message', () => {
    const error = new Error('Original error');
    logger.exception(error, 'Custom message', { extra: 'data' });

    const record = memoryHandler.records[0]!;
    expect(record.message).toBe('Custom message');
    expect(record.attributes!.extra).toBe('data');
    expect(record.attributes!['exception.message']).toBe('Original error');
  });

  it('should create child logger', () => {
    const child = logger.child('child', { childAttr: 'value' });

    expect(child.name).toBe('test-logger.child');
    expect(child.level).toBe('info');

    child.info('Child message');

    expect(memoryHandler.records).toHaveLength(1);
    expect(memoryHandler.records[0]!.attributes).toEqual({ childAttr: 'value' });
  });

  it('should inherit span context in child logger', () => {
    logger.setSpanContext({
      traceId: 'trace123',
      spanId: 'span456',
      traceFlags: 1,
    });

    const child = logger.child('child');
    child.info('Child message');

    expect(memoryHandler.records[0]!.traceId).toBe('trace123');
  });

  it('should merge default attributes', () => {
    const loggerWithDefaults = new Logger('test', 'info', { service: 'api' });
    loggerWithDefaults.addHandler(memoryHandler.getHandler());

    loggerWithDefaults.info('Message', { extra: 'data' });

    expect(memoryHandler.records[0]!.attributes).toEqual({
      service: 'api',
      extra: 'data',
    });
  });

  it('should check if level is enabled', () => {
    expect(logger.isEnabled('debug')).toBe(false);
    expect(logger.isEnabled('info')).toBe(true);
    expect(logger.isEnabled('warn')).toBe(true);
    expect(logger.isEnabled('error')).toBe(true);
  });

  it('should time operations', async () => {
    logger.level = 'debug';
    const done = logger.time('operation');

    await new Promise((resolve) => setTimeout(resolve, 10));
    done();

    expect(memoryHandler.records).toHaveLength(2);
    expect(memoryHandler.records[0]!.message).toBe('operation started');
    expect(memoryHandler.records[1]!.message).toBe('operation completed');
    expect(memoryHandler.records[1]!.attributes!.duration_ms).toBeGreaterThan(0);
  });

  it('should handle handler errors gracefully', () => {
    const failingHandler = () => {
      throw new Error('Handler error');
    };

    logger.addHandler(failingHandler);
    logger.info('Test'); // Should not throw
  });

  it('should remove handlers', () => {
    const handler1Records: unknown[] = [];
    const handler1 = (r: unknown) => handler1Records.push(r);

    logger.addHandler(handler1);
    logger.info('Message 1');

    logger.removeHandler(handler1);
    logger.info('Message 2');

    expect(handler1Records).toHaveLength(1);
  });
});

describe('MemoryLogHandler', () => {
  it('should store records', () => {
    const handler = new MemoryLogHandler();
    handler.handle({
      timestamp: Date.now(),
      level: 'info',
      message: 'Test',
    });

    expect(handler.records).toHaveLength(1);
  });

  it('should clear records', () => {
    const handler = new MemoryLogHandler();
    handler.handle({
      timestamp: Date.now(),
      level: 'info',
      message: 'Test',
    });

    handler.clear();
    expect(handler.records).toHaveLength(0);
  });

  it('should provide bound handler function', () => {
    const handler = new MemoryLogHandler();
    const boundHandler = handler.getHandler();

    boundHandler({
      timestamp: Date.now(),
      level: 'info',
      message: 'Test',
    });

    expect(handler.records).toHaveLength(1);
  });
});

describe('consoleLogHandler', () => {
  it('should call console methods', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    consoleLogHandler({ timestamp: Date.now(), level: 'debug', message: 'Debug' });
    consoleLogHandler({ timestamp: Date.now(), level: 'info', message: 'Info' });
    consoleLogHandler({ timestamp: Date.now(), level: 'warn', message: 'Warn' });
    consoleLogHandler({ timestamp: Date.now(), level: 'error', message: 'Error' });

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should format with trace and span', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    consoleLogHandler({
      timestamp: Date.now(),
      level: 'info',
      message: 'Test',
      traceId: 'abc123456789',
      spanId: 'def456',
    });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[trace=abc12345]'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[span=def456]'));

    infoSpy.mockRestore();
  });
});

describe('jsonLogHandler', () => {
  it('should output JSON', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    jsonLogHandler({
      timestamp: Date.now(),
      level: 'info',
      message: 'Test message',
      traceId: 'trace123',
      attributes: { key: 'value' },
    });

    const output = infoSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test message');
    expect(parsed.traceId).toBe('trace123');
    expect(parsed.attributes).toEqual({ key: 'value' });

    infoSpy.mockRestore();
  });
});

describe('noopLogHandler', () => {
  it('should do nothing', () => {
    noopLogHandler({
      timestamp: Date.now(),
      level: 'info',
      message: 'Test',
    });
    // Just ensure it doesn't throw
  });
});

describe('createLogger', () => {
  it('should create logger with defaults', () => {
    const logger = createLogger('test');

    expect(logger.name).toBe('test');
    expect(logger.level).toBe('info');
  });

  it('should create logger with custom level', () => {
    const logger = createLogger('test', { level: 'debug' });

    expect(logger.level).toBe('debug');
  });

  it('should add custom handlers', () => {
    const records: unknown[] = [];
    const customHandler = (r: unknown) => records.push(r);

    const logger = createLogger('test', { handlers: [customHandler] });
    logger.info('Test');

    expect(records).toHaveLength(1);
  });

  it('should add JSON handler when useJson is true', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const logger = createLogger('test', { useJson: true });
    logger.info('Test');

    const output = infoSpy.mock.calls[0]![0] as string;
    expect(() => JSON.parse(output)).not.toThrow();

    infoSpy.mockRestore();
  });
});
