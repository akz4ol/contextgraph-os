/**
 * Database migrations system
 *
 * Manages schema evolution with versioned, ordered migrations.
 * Migrations are append-only and cannot be modified once applied.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { ok, err, type Result } from '@contextgraph/core';
import { StorageError } from './interface.js';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: string;
}

export class MigrationRunner {
  constructor(private readonly db: SqlJsDatabase) {}

  /**
   * Run all pending migrations
   */
  run(migrations: readonly Migration[]): Result<number, StorageError> {
    try {
      // Ensure migrations table exists
      this.db.run(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at INTEGER NOT NULL
        )
      `);

      // Get applied migrations
      const appliedResult = this.db.exec('SELECT version FROM _migrations ORDER BY version');
      const appliedVersions = new Set<number>();
      if (appliedResult.length > 0) {
        for (const row of appliedResult[0]!.values) {
          appliedVersions.add(row[0] as number);
        }
      }

      // Sort migrations by version
      const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

      // Run pending migrations
      let count = 0;
      for (const migration of sortedMigrations) {
        if (appliedVersions.has(migration.version)) {
          continue;
        }

        this.db.run(migration.up);
        this.db.run(
          'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, Date.now()]
        );
        count++;
      }

      return ok(count);
    } catch (error) {
      return err(
        new StorageError(
          `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
          'MIGRATION_FAILED',
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * Get current migration version
   */
  getCurrentVersion(): Result<number, StorageError> {
    try {
      const result = this.db.exec('SELECT MAX(version) as version FROM _migrations');
      if (result.length > 0 && result[0]!.values.length > 0) {
        const version = result[0]!.values[0]![0];
        return ok(typeof version === 'number' ? version : 0);
      }
      return ok(0);
    } catch {
      return ok(0);
    }
  }

  /**
   * Get all applied migrations
   */
  getAppliedMigrations(): Result<readonly { version: number; name: string; appliedAt: number }[], StorageError> {
    try {
      const result = this.db.exec(
        'SELECT version, name, applied_at as appliedAt FROM _migrations ORDER BY version'
      );
      const migrations: { version: number; name: string; appliedAt: number }[] = [];
      if (result.length > 0) {
        for (const row of result[0]!.values) {
          migrations.push({
            version: row[0] as number,
            name: row[1] as string,
            appliedAt: row[2] as number,
          });
        }
      }
      return ok(migrations);
    } catch {
      return ok([]);
    }
  }
}

/**
 * Core migrations for ContextGraph OS
 */
export const coreMigrations: readonly Migration[] = [
  {
    version: 1,
    name: 'create_entities_table',
    up: `
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        aliases TEXT,
        metadata TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_createdAt ON entities(createdAt);
    `,
  },
  {
    version: 2,
    name: 'create_claims_table',
    up: `
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        subjectId TEXT NOT NULL,
        predicate TEXT NOT NULL,
        objectId TEXT,
        objectValue TEXT,
        context TEXT NOT NULL,
        provenanceId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (subjectId) REFERENCES entities(id),
        FOREIGN KEY (objectId) REFERENCES entities(id)
      );
      CREATE INDEX IF NOT EXISTS idx_claims_subjectId ON claims(subjectId);
      CREATE INDEX IF NOT EXISTS idx_claims_objectId ON claims(objectId);
      CREATE INDEX IF NOT EXISTS idx_claims_predicate ON claims(predicate);
      CREATE INDEX IF NOT EXISTS idx_claims_provenanceId ON claims(provenanceId);
      CREATE INDEX IF NOT EXISTS idx_claims_createdAt ON claims(createdAt);
    `,
  },
  {
    version: 3,
    name: 'create_provenance_table',
    up: `
      CREATE TABLE IF NOT EXISTS provenance (
        id TEXT PRIMARY KEY,
        sourceType TEXT NOT NULL,
        sourceId TEXT,
        sourceUri TEXT,
        actor TEXT,
        action TEXT NOT NULL,
        inputRefs TEXT,
        outputRefs TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        hash TEXT NOT NULL,
        previousHash TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_provenance_sourceType ON provenance(sourceType);
      CREATE INDEX IF NOT EXISTS idx_provenance_actor ON provenance(actor);
      CREATE INDEX IF NOT EXISTS idx_provenance_timestamp ON provenance(timestamp);
      CREATE INDEX IF NOT EXISTS idx_provenance_createdAt ON provenance(createdAt);
    `,
  },
  {
    version: 4,
    name: 'create_decisions_table',
    up: `
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed',
        title TEXT NOT NULL,
        description TEXT,
        claimRefs TEXT,
        precedentRefs TEXT,
        policyRefs TEXT,
        proposedBy TEXT NOT NULL,
        proposedAt INTEGER NOT NULL,
        approvedBy TEXT,
        approvedAt INTEGER,
        executedAt INTEGER,
        outcome TEXT,
        provenanceId TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
      CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(type);
      CREATE INDEX IF NOT EXISTS idx_decisions_proposedBy ON decisions(proposedBy);
      CREATE INDEX IF NOT EXISTS idx_decisions_proposedAt ON decisions(proposedAt);
      CREATE INDEX IF NOT EXISTS idx_decisions_createdAt ON decisions(createdAt);
    `,
  },
  {
    version: 5,
    name: 'create_policies_table',
    up: `
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        rules TEXT NOT NULL,
        scope TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        effectiveFrom INTEGER NOT NULL,
        effectiveTo INTEGER,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_policies_name ON policies(name);
      CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled);
      CREATE INDEX IF NOT EXISTS idx_policies_priority ON policies(priority);
      CREATE INDEX IF NOT EXISTS idx_policies_createdAt ON policies(createdAt);
    `,
  },
  {
    version: 6,
    name: 'create_exceptions_table',
    up: `
      CREATE TABLE IF NOT EXISTS exceptions (
        id TEXT PRIMARY KEY,
        decisionId TEXT NOT NULL,
        policyRefs TEXT NOT NULL,
        justification TEXT NOT NULL,
        riskLevel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requestedBy TEXT NOT NULL,
        requestedAt INTEGER NOT NULL,
        approvers TEXT,
        approvedAt INTEGER,
        expiresAt INTEGER,
        provenanceId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (decisionId) REFERENCES decisions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_exceptions_decisionId ON exceptions(decisionId);
      CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
      CREATE INDEX IF NOT EXISTS idx_exceptions_riskLevel ON exceptions(riskLevel);
      CREATE INDEX IF NOT EXISTS idx_exceptions_createdAt ON exceptions(createdAt);
    `,
  },
  {
    version: 7,
    name: 'create_ontology_table',
    up: `
      CREATE TABLE IF NOT EXISTS ontology_versions (
        version TEXT PRIMARY KEY,
        schema TEXT NOT NULL,
        previousVersion TEXT,
        changelog TEXT,
        createdAt INTEGER NOT NULL
      );
    `,
  },
];
