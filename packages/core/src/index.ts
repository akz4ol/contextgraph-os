/**
 * @contextgraph/core
 *
 * Core types and utilities for ContextGraph OS.
 * This package provides foundational primitives used across all other packages.
 */

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/** Unique identifier for entities */
export type EntityId = Brand<string, 'EntityId'>;

/** Unique identifier for claims */
export type ClaimId = Brand<string, 'ClaimId'>;

/** Unique identifier for decisions */
export type DecisionId = Brand<string, 'DecisionId'>;

/** Unique identifier for provenance records */
export type ProvenanceId = Brand<string, 'ProvenanceId'>;

/** Unique identifier for policies */
export type PolicyId = Brand<string, 'PolicyId'>;

/** Unique identifier for exceptions */
export type ExceptionId = Brand<string, 'ExceptionId'>;

/** Version identifier for ontology */
export type OntologyVersion = Brand<string, 'OntologyVersion'>;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Creates a new EntityId
 */
export function createEntityId(value?: string): EntityId {
  return (value ?? generateUUID()) as EntityId;
}

/**
 * Creates a new ClaimId
 */
export function createClaimId(value?: string): ClaimId {
  return (value ?? generateUUID()) as ClaimId;
}

/**
 * Creates a new DecisionId
 */
export function createDecisionId(value?: string): DecisionId {
  return (value ?? generateUUID()) as DecisionId;
}

/**
 * Creates a new ProvenanceId
 */
export function createProvenanceId(value?: string): ProvenanceId {
  return (value ?? generateUUID()) as ProvenanceId;
}

/**
 * Creates a new PolicyId
 */
export function createPolicyId(value?: string): PolicyId {
  return (value ?? generateUUID()) as PolicyId;
}

/**
 * Creates a new ExceptionId
 */
export function createExceptionId(value?: string): ExceptionId {
  return (value ?? generateUUID()) as ExceptionId;
}

/**
 * Creates a new OntologyVersion
 */
export function createOntologyVersion(value: string): OntologyVersion {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`Invalid ontology version format: ${value}. Expected semver (e.g., 0.1.0)`);
  }
  return value as OntologyVersion;
}

// ============================================================================
// Time Types (Time is First Class)
// ============================================================================

/** Unix timestamp in milliseconds */
export type Timestamp = Brand<number, 'Timestamp'>;

/** Time interval with explicit bounds */
export interface TimeInterval {
  readonly start: Timestamp;
  readonly end: Timestamp | null; // null means ongoing/unbounded
}

/**
 * Creates a Timestamp from various inputs
 */
export function createTimestamp(value?: number | Date): Timestamp {
  if (value === undefined) {
    return Date.now() as Timestamp;
  }
  if (value instanceof Date) {
    return value.getTime() as Timestamp;
  }
  return value as Timestamp;
}

/**
 * Creates a TimeInterval
 */
export function createTimeInterval(start: Timestamp, end?: Timestamp | null): TimeInterval {
  return {
    start,
    end: end ?? null,
  };
}

/**
 * Checks if a timestamp falls within an interval
 */
export function isWithinInterval(timestamp: Timestamp, interval: TimeInterval): boolean {
  if (timestamp < interval.start) return false;
  if (interval.end !== null && timestamp > interval.end) return false;
  return true;
}

// ============================================================================
// Context Dimensions
// ============================================================================

/** Jurisdiction or regulatory domain */
export type Jurisdiction = Brand<string, 'Jurisdiction'>;

/** Organizational scope */
export type Scope = Brand<string, 'Scope'>;

/** Confidence level for claims (0-1) */
export type Confidence = Brand<number, 'Confidence'>;

/**
 * Context dimensions that qualify claims and decisions
 */
export interface ContextDimensions {
  /** When this context is valid */
  readonly temporal: TimeInterval;

  /** Geographic or regulatory jurisdiction */
  readonly jurisdiction?: Jurisdiction;

  /** Organizational scope (e.g., department, project) */
  readonly scope?: Scope;

  /** Confidence level (0-1) */
  readonly confidence?: Confidence;
}

export function createJurisdiction(value: string): Jurisdiction {
  return value as Jurisdiction;
}

export function createScope(value: string): Scope {
  return value as Scope;
}

export function createConfidence(value: number): Confidence {
  if (value < 0 || value > 1) {
    throw new Error(`Confidence must be between 0 and 1, got: ${value}`);
  }
  return value as Confidence;
}

// ============================================================================
// Result Type for Error Handling
// ============================================================================

export type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return !result.ok;
}

// ============================================================================
// Validation Errors
// ============================================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class OntologyViolationError extends Error {
  constructor(
    message: string,
    public readonly entityType?: string,
    public readonly relationName?: string
  ) {
    super(message);
    this.name = 'OntologyViolationError';
  }
}

export class ProvenanceRequiredError extends Error {
  constructor(message: string = 'Provenance reference is required for this operation') {
    super(message);
    this.name = 'ProvenanceRequiredError';
  }
}

export class PolicyViolationError extends Error {
  constructor(
    message: string,
    public readonly policyId: PolicyId,
    public readonly action: string
  ) {
    super(message);
    this.name = 'PolicyViolationError';
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deep freeze an object to ensure immutability
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}

/**
 * Assert a condition, throwing if false
 */
export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}

/**
 * Type guard to check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
