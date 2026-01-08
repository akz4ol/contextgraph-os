/**
 * Compliance Package Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import { createTimestamp } from '@contextgraph/core';
import type { Timestamp } from '@contextgraph/core';
import {
  AuditReportGenerator,
  AccessReportGenerator,
  DecisionReportGenerator,
  ProvenanceReportGenerator,
  GDPRComplianceManager,
  formatAsJSON,
  formatAsCSV,
  parseCSV,
  formatMetadataAsComment,
} from './index.js';

describe('AuditReportGenerator', () => {
  let storage: InMemoryStorage;
  let generator: AuditReportGenerator;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    generator = new AuditReportGenerator(storage);

    // Seed audit data
    const now = createTimestamp();
    await storage.insert('audit_trail', {
      id: 'audit_1',
      timestamp: now - 3000,
      agentId: 'agent_1',
      action: 'read',
      resourceType: 'entity',
      resourceId: 'ent_123',
      outcome: 'allowed',
      createdAt: now - 3000,
    });
    await storage.insert('audit_trail', {
      id: 'audit_2',
      timestamp: now - 2000,
      agentId: 'agent_1',
      action: 'write',
      resourceType: 'entity',
      resourceId: 'ent_456',
      outcome: 'allowed',
      createdAt: now - 2000,
    });
    await storage.insert('audit_trail', {
      id: 'audit_3',
      timestamp: now - 1000,
      agentId: 'agent_2',
      action: 'delete',
      resourceType: 'policy',
      outcome: 'denied',
      reason: 'Insufficient permissions',
      createdAt: now - 1000,
    });

    // Seed agent data for name resolution
    await storage.insert('agents', {
      id: 'agent_1',
      name: 'TestAgent',
      createdAt: now,
    });
  });

  it('should generate an audit report', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(3);
      expect(result.value.metadata.reportType).toBe('audit');
      expect(result.value.summary.totalActions).toBe(3);
    }
  });

  it('should include agent names when available', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const agent1Entry = result.value.entries.find((e) => e.agentId === 'agent_1');
      expect(agent1Entry?.agentName).toBe('TestAgent');
    }
  });

  it('should filter by agent', async () => {
    const result = await generator.generate({ agentId: 'agent_1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(2);
      expect(result.value.entries.every((e) => e.agentId === 'agent_1')).toBe(true);
    }
  });

  it('should filter by action', async () => {
    const result = await generator.generate({ action: 'read' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(1);
      expect(result.value.entries[0]?.action).toBe('read');
    }
  });

  it('should filter by outcome', async () => {
    const result = await generator.generate({ outcome: 'denied' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(1);
      expect(result.value.entries[0]?.outcome).toBe('denied');
    }
  });

  it('should calculate summary correctly', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.allowedActions).toBe(2);
      expect(result.value.summary.deniedActions).toBe(1);
      expect(result.value.summary.uniqueAgents).toBe(2);
      expect(result.value.summary.actionCounts['read']).toBe(1);
      expect(result.value.summary.actionCounts['write']).toBe(1);
      expect(result.value.summary.actionCounts['delete']).toBe(1);
    }
  });
});

describe('AccessReportGenerator', () => {
  let storage: InMemoryStorage;
  let generator: AccessReportGenerator;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    generator = new AccessReportGenerator(storage);

    // Seed audit data
    const now = createTimestamp();
    await storage.insert('audit_trail', {
      id: 'audit_1',
      timestamp: now - 2000,
      agentId: 'user_alice',
      action: 'read',
      resourceType: 'document',
      resourceId: 'doc_1',
      outcome: 'allowed',
      createdAt: now - 2000,
    });
    await storage.insert('audit_trail', {
      id: 'audit_2',
      timestamp: now - 1000,
      agentId: 'user_alice',
      action: 'read',
      resourceType: 'document',
      resourceId: 'doc_2',
      outcome: 'allowed',
      createdAt: now - 1000,
    });
    await storage.insert('audit_trail', {
      id: 'audit_3',
      timestamp: now,
      agentId: 'agent_bot',
      action: 'write',
      resourceType: 'document',
      resourceId: 'doc_1',
      outcome: 'denied',
      createdAt: now,
    });
  });

  it('should generate an access report', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(3);
      expect(result.value.metadata.reportType).toBe('access');
    }
  });

  it('should filter by subject', async () => {
    const result = await generator.generate({ subjectId: 'user_alice' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(2);
    }
  });

  it('should calculate access summary', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.totalAccesses).toBe(3);
      expect(result.value.summary.uniqueSubjects).toBe(2);
      expect(result.value.summary.accessByAction['read']).toBe(2);
      expect(result.value.summary.accessByAction['write']).toBe(1);
    }
  });
});

describe('DecisionReportGenerator', () => {
  let storage: InMemoryStorage;
  let generator: DecisionReportGenerator;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    generator = new DecisionReportGenerator(storage);

    // Seed decision data
    const now = createTimestamp();
    await storage.insert('decisions', {
      id: 'dec_1',
      type: 'workflow_step',
      title: 'Deploy to production',
      status: 'approved',
      riskLevel: 'high',
      proposedBy: 'agent_1',
      proposedAt: now - 5000,
      approvedBy: 'admin_1',
      approvedAt: now - 3000,
      createdAt: now - 5000,
    });
    await storage.insert('decisions', {
      id: 'dec_2',
      type: 'claim_creation',
      title: 'Add user data',
      status: 'proposed',
      riskLevel: 'low',
      proposedBy: 'agent_2',
      proposedAt: now - 1000,
      createdAt: now - 1000,
    });
    await storage.insert('decisions', {
      id: 'dec_3',
      type: 'action',
      title: 'Delete records',
      status: 'rejected',
      riskLevel: 'critical',
      proposedBy: 'agent_1',
      proposedAt: now - 4000,
      rejectedBy: 'admin_1',
      rejectedAt: now - 2000,
      rationale: 'Too risky',
      createdAt: now - 4000,
    });
  });

  it('should generate a decision report', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(3);
      expect(result.value.metadata.reportType).toBe('decision');
    }
  });

  it('should filter by status', async () => {
    const result = await generator.generate({ status: 'approved' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(1);
      expect(result.value.entries[0]?.status).toBe('approved');
    }
  });

  it('should filter by risk level', async () => {
    const result = await generator.generate({ riskLevel: 'critical' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(1);
      expect(result.value.entries[0]?.title).toBe('Delete records');
    }
  });

  it('should calculate decision summary', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.totalDecisions).toBe(3);
      expect(result.value.summary.byStatus['approved']).toBe(1);
      expect(result.value.summary.byStatus['proposed']).toBe(1);
      expect(result.value.summary.byStatus['rejected']).toBe(1);
      expect(result.value.summary.byRiskLevel['high']).toBe(1);
      expect(result.value.summary.averageApprovalTime).toBeDefined();
    }
  });
});

describe('ProvenanceReportGenerator', () => {
  let storage: InMemoryStorage;
  let generator: ProvenanceReportGenerator;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    generator = new ProvenanceReportGenerator(storage);

    // Seed provenance data
    const now = createTimestamp();
    await storage.insert('provenance', {
      id: 'prov_1',
      timestamp: now - 3000,
      sourceType: 'agent',
      sourceId: 'agent_1',
      action: 'create',
      entityId: 'ent_1',
      hash: 'hash_1',
      createdAt: now - 3000,
    });
    await storage.insert('provenance', {
      id: 'prov_2',
      timestamp: now - 2000,
      sourceType: 'agent',
      sourceId: 'agent_1',
      action: 'add_claim',
      entityId: 'ent_1',
      claimId: 'claim_1',
      previousHash: 'hash_1',
      hash: 'hash_2',
      createdAt: now - 2000,
    });
    await storage.insert('provenance', {
      id: 'prov_3',
      timestamp: now - 1000,
      sourceType: 'system',
      sourceId: 'system',
      action: 'verify',
      previousHash: 'hash_2',
      hash: 'hash_3',
      createdAt: now - 1000,
    });
  });

  it('should generate a provenance report', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(3);
      expect(result.value.metadata.reportType).toBe('provenance');
    }
  });

  it('should verify chain integrity', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chainIntegrity.valid).toBe(true);
      expect(result.value.chainIntegrity.entriesVerified).toBe(3);
      expect(result.value.chainIntegrity.brokenLinks).toBe(0);
    }
  });

  it('should detect broken links', async () => {
    // Add entry with non-existent previousHash
    const now = createTimestamp();
    await storage.insert('provenance', {
      id: 'prov_broken',
      timestamp: now,
      sourceType: 'agent',
      sourceId: 'agent_2',
      action: 'update',
      previousHash: 'nonexistent_hash',
      hash: 'hash_4',
      createdAt: now,
    });

    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chainIntegrity.valid).toBe(false);
      expect(result.value.chainIntegrity.brokenLinks).toBe(1);
    }
  });

  it('should calculate provenance summary', async () => {
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.totalEntries).toBe(3);
      expect(result.value.summary.bySourceType['agent']).toBe(2);
      expect(result.value.summary.bySourceType['system']).toBe(1);
      expect(result.value.summary.byAction['create']).toBe(1);
      expect(result.value.summary.byAction['add_claim']).toBe(1);
    }
  });
});

describe('GDPRComplianceManager', () => {
  let storage: InMemoryStorage;
  let manager: GDPRComplianceManager;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    manager = new GDPRComplianceManager(storage);

    // Seed data for a subject
    const now = createTimestamp();
    const subjectId = 'user_john';

    await storage.insert('entities', {
      id: subjectId,
      type: 'person',
      name: 'John Doe',
      properties: JSON.stringify({ email: 'john@example.com', phone: '555-1234' }),
      createdAt: now - 10000,
    });

    await storage.insert('claims', {
      id: 'claim_1',
      subjectId,
      predicate: 'has_role',
      value: JSON.stringify('developer'),
      createdAt: now - 8000,
    });

    await storage.insert('claims', {
      id: 'claim_2',
      subjectId,
      predicate: 'works_at',
      value: JSON.stringify('Acme Corp'),
      createdAt: now - 7000,
    });

    await storage.insert('decisions', {
      id: 'dec_1',
      type: 'workflow_step',
      title: 'Approve access request',
      status: 'executed',
      proposedBy: subjectId,
      proposedAt: now - 5000,
      createdAt: now - 5000,
    });

    await storage.insert('audit_trail', {
      id: 'audit_1',
      timestamp: now - 3000,
      agentId: subjectId,
      action: 'login',
      resourceType: 'system',
      outcome: 'allowed',
      createdAt: now - 3000,
    });
  });

  describe('findPersonalData', () => {
    it('should find all personal data for a subject', async () => {
      const result = await manager.findPersonalData({ subjectId: 'user_john' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entities.length).toBe(1);
        expect(result.value.claims.length).toBe(2);
        expect(result.value.decisions.length).toBe(1);
        expect(result.value.auditTrail.length).toBe(1);
      }
    });

    it('should include metadata', async () => {
      const result = await manager.findPersonalData({ subjectId: 'user_john' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.reportType).toBe('gdpr_personal_data');
        expect(result.value.metadata.totalRecords).toBe(5);
      }
    });
  });

  describe('exportPersonalData', () => {
    it('should export as JSON', async () => {
      const result = await manager.exportPersonalData({ subjectId: 'user_john' }, 'json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('json');
        expect(result.value.data).toContain('John Doe');
        expect(result.value.checksum).toBeDefined();
      }
    });

    it('should export as CSV', async () => {
      const result = await manager.exportPersonalData({ subjectId: 'user_john' }, 'csv');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('csv');
        expect(result.value.data).toContain('# Entities');
        expect(result.value.data).toContain('# Claims');
      }
    });
  });

  describe('deletePersonalData', () => {
    it('should anonymize personal data', async () => {
      const result = await manager.deletePersonalData({ subjectId: 'user_john', anonymize: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entitiesDeleted).toBeGreaterThan(0);
        expect(result.value.claimsDeleted).toBeGreaterThan(0);
      }

      // Verify data is anonymized
      const entityResult = await storage.findById('entities', 'user_john');
      expect(entityResult.ok).toBe(true);
      if (entityResult.ok && entityResult.value !== null) {
        expect((entityResult.value as { name: string }).name).toBe('[REDACTED]');
      }
    });
  });
});

describe('Formatters', () => {
  describe('formatAsJSON', () => {
    it('should format with pretty print', () => {
      const data = { name: 'Test', value: 123 };
      const result = formatAsJSON(data, true);
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });

    it('should format without pretty print', () => {
      const data = { name: 'Test', value: 123 };
      const result = formatAsJSON(data, false);
      expect(result).not.toContain('\n');
    });
  });

  describe('formatAsCSV', () => {
    it('should format records as CSV', () => {
      const data = [
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ];
      const result = formatAsCSV(data);
      expect(result).toContain('id,name,age');
      expect(result).toContain('1,Alice,30');
      expect(result).toContain('2,Bob,25');
    });

    it('should escape special characters', () => {
      const data = [{ id: '1', name: 'Alice, the Great', note: 'Line1\nLine2' }];
      const result = formatAsCSV(data);
      expect(result).toContain('"Alice, the Great"');
      expect(result).toContain('"Line1\nLine2"');
    });

    it('should return empty string for empty data', () => {
      const result = formatAsCSV([]);
      expect(result).toBe('');
    });
  });

  describe('parseCSV', () => {
    it('should parse CSV string', () => {
      const csv = 'id,name,age\n1,Alice,30\n2,Bob,25';
      const result = parseCSV<{ id: number; name: string; age: number }>(csv);
      expect(result.length).toBe(2);
      expect(result[0]?.name).toBe('Alice');
      expect(result[0]?.age).toBe(30);
    });

    it('should skip comment lines', () => {
      const csv = '# Header comment\nid,name\n1,Alice';
      const result = parseCSV<{ id: number; name: string }>(csv);
      expect(result.length).toBe(1);
    });

    it('should handle quoted fields', () => {
      const csv = 'id,name\n1,"Alice, the Great"';
      const result = parseCSV<{ id: number; name: string }>(csv);
      expect(result[0]?.name).toBe('Alice, the Great');
    });
  });

  describe('formatMetadataAsComment', () => {
    it('should format metadata as comment block', () => {
      const metadata = {
        reportId: 'report_123',
        reportType: 'audit',
        generatedAt: Date.now(),
        generatedBy: 'system',
        totalRecords: 100,
      };
      const result = formatMetadataAsComment(metadata);
      expect(result).toContain('# Report: audit');
      expect(result).toContain('# Report ID: report_123');
      expect(result).toContain('# Total Records: 100');
    });
  });
});

describe('Integration', () => {
  let storage: InMemoryStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
  });

  it('should generate empty report when no data exists', async () => {
    const generator = new AuditReportGenerator(storage);
    const result = await generator.generate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(0);
      expect(result.value.summary.totalActions).toBe(0);
    }
  });

  it('should apply time range filters', async () => {
    const now = createTimestamp();

    // Insert entries at different times
    await storage.insert('audit_trail', {
      id: 'audit_old',
      timestamp: (now - 100000) as Timestamp,
      agentId: 'agent_1',
      action: 'read',
      resourceType: 'entity',
      outcome: 'allowed',
      createdAt: (now - 100000) as Timestamp,
    });
    await storage.insert('audit_trail', {
      id: 'audit_new',
      timestamp: now,
      agentId: 'agent_1',
      action: 'write',
      resourceType: 'entity',
      outcome: 'allowed',
      createdAt: now,
    });

    const generator = new AuditReportGenerator(storage);

    // Filter for recent entries only
    const result = await generator.generate({
      startTime: (now - 50000) as Timestamp,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(1);
      expect(result.value.entries[0]?.id).toBe('audit_new');
    }
  });
});
