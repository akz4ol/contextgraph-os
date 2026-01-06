import { describe, it, expect } from 'vitest';
import {
  createEntityId,
  createClaimId,
  createTimestamp,
  createTimeInterval,
  createOntologyVersion,
  createConfidence,
  isWithinInterval,
  ok,
  err,
  isOk,
  isErr,
  deepFreeze,
  invariant,
  ValidationError,
  type Timestamp,
} from './index.js';

describe('Core ID Generation', () => {
  it('should create unique EntityIds', () => {
    const id1 = createEntityId();
    const id2 = createEntityId();
    expect(id1).not.toBe(id2);
  });

  it('should create EntityId from provided value', () => {
    const id = createEntityId('test-entity-123');
    expect(id).toBe('test-entity-123');
  });

  it('should create unique ClaimIds', () => {
    const id1 = createClaimId();
    const id2 = createClaimId();
    expect(id1).not.toBe(id2);
  });
});

describe('Time Types', () => {
  it('should create timestamp from Date', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const ts = createTimestamp(date);
    expect(ts).toBe(date.getTime());
  });

  it('should create timestamp from number', () => {
    const ts = createTimestamp(1704067200000);
    expect(ts).toBe(1704067200000);
  });

  it('should create current timestamp when no value provided', () => {
    const before = Date.now();
    const ts = createTimestamp();
    const after = Date.now();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('should create time interval', () => {
    const start = createTimestamp(1000);
    const end = createTimestamp(2000);
    const interval = createTimeInterval(start, end);
    expect(interval.start).toBe(1000);
    expect(interval.end).toBe(2000);
  });

  it('should create unbounded time interval', () => {
    const start = createTimestamp(1000);
    const interval = createTimeInterval(start);
    expect(interval.start).toBe(1000);
    expect(interval.end).toBeNull();
  });

  it('should check if timestamp is within interval', () => {
    const interval = createTimeInterval(createTimestamp(1000), createTimestamp(2000));
    expect(isWithinInterval(createTimestamp(500) as Timestamp, interval)).toBe(false);
    expect(isWithinInterval(createTimestamp(1000) as Timestamp, interval)).toBe(true);
    expect(isWithinInterval(createTimestamp(1500) as Timestamp, interval)).toBe(true);
    expect(isWithinInterval(createTimestamp(2000) as Timestamp, interval)).toBe(true);
    expect(isWithinInterval(createTimestamp(2500) as Timestamp, interval)).toBe(false);
  });

  it('should handle unbounded interval correctly', () => {
    const interval = createTimeInterval(createTimestamp(1000));
    expect(isWithinInterval(createTimestamp(500) as Timestamp, interval)).toBe(false);
    expect(isWithinInterval(createTimestamp(1000) as Timestamp, interval)).toBe(true);
    expect(isWithinInterval(createTimestamp(999999999) as Timestamp, interval)).toBe(true);
  });
});

describe('Ontology Version', () => {
  it('should create valid ontology version', () => {
    const version = createOntologyVersion('0.1.0');
    expect(version).toBe('0.1.0');
  });

  it('should reject invalid ontology version', () => {
    expect(() => createOntologyVersion('1.0')).toThrow('Invalid ontology version format');
    expect(() => createOntologyVersion('v1.0.0')).toThrow('Invalid ontology version format');
    expect(() => createOntologyVersion('invalid')).toThrow('Invalid ontology version format');
  });
});

describe('Confidence', () => {
  it('should create valid confidence', () => {
    const conf = createConfidence(0.8);
    expect(conf).toBe(0.8);
  });

  it('should accept boundary values', () => {
    expect(createConfidence(0)).toBe(0);
    expect(createConfidence(1)).toBe(1);
  });

  it('should reject invalid confidence values', () => {
    expect(() => createConfidence(-0.1)).toThrow('Confidence must be between 0 and 1');
    expect(() => createConfidence(1.1)).toThrow('Confidence must be between 0 and 1');
  });
});

describe('Result Type', () => {
  it('should create Ok result', () => {
    const result = ok('success');
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe('success');
    }
  });

  it('should create Err result', () => {
    const error = new Error('failed');
    const result = err(error);
    expect(isOk(result)).toBe(false);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('failed');
    }
  });
});

describe('Utilities', () => {
  it('should deep freeze objects', () => {
    const obj = { a: 1, nested: { b: 2 } };
    const frozen = deepFreeze(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
  });

  it('should throw on invariant violation', () => {
    expect(() => invariant(false, 'test condition')).toThrow('Invariant violation: test condition');
    expect(() => invariant(true, 'should not throw')).not.toThrow();
  });
});

describe('ValidationError', () => {
  it('should create validation error with field and code', () => {
    const error = new ValidationError('Invalid value', 'email', 'INVALID_FORMAT');
    expect(error.message).toBe('Invalid value');
    expect(error.field).toBe('email');
    expect(error.code).toBe('INVALID_FORMAT');
    expect(error.name).toBe('ValidationError');
  });
});
