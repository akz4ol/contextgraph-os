/**
 * Decision Trace Graph Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '@contextgraph/storage';
import { ProvenanceLedger } from '@contextgraph/provenance';
import { type EntityId } from '@contextgraph/core';
import {
  Decision,
  DecisionTraceGraph,
  DecisionRepository,
  isValidTransition,
  getValidTransitions,
  type DecisionType,
  type DecisionStatus,
  type RiskLevel,
} from './index.js';

describe('Decision', () => {
  it('creates decision with required fields', () => {
    const result = Decision.create({
      type: 'claim_creation',
      title: 'Create new claim',
      proposedBy: 'user-123' as EntityId,
      provenanceId: 'prov-123' as EntityId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.type).toBe('claim_creation');
      expect(result.value.data.title).toBe('Create new claim');
      expect(result.value.data.status).toBe('proposed');
      expect(result.value.data.riskLevel).toBe('medium'); // default
    }
  });

  it('creates decision with all fields', () => {
    const result = Decision.create({
      type: 'policy_change',
      title: 'Update access policy',
      description: 'Modify the access control policy for admin users',
      proposedBy: 'admin-1' as EntityId,
      riskLevel: 'high',
      provenanceId: 'prov-456' as EntityId,
      claimRefs: [{ id: 'claim-1' as EntityId, role: 'supporting' }],
      policyRefs: [{ id: 'policy-1', version: '1.0', applicable: true, satisfiedRequirements: ['auth'], violatedRequirements: [] }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.riskLevel).toBe('high');
      expect(result.value.data.description).toBe('Modify the access control policy for admin users');
      expect(result.value.data.claimRefs).toHaveLength(1);
      expect(result.value.data.policyRefs).toHaveLength(1);
    }
  });

  it('rejects invalid decision type', () => {
    const result = Decision.create({
      type: 'invalid_type' as DecisionType,
      title: 'Test',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid decision type');
    }
  });

  it('rejects empty title', () => {
    const result = Decision.create({
      type: 'claim_creation',
      title: '   ',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('title is required');
    }
  });

  it('allows valid status transitions', () => {
    const result = Decision.create({
      type: 'claim_creation',
      title: 'Test decision',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = result.value;

    // From proposed -> approved is valid
    expect(decision.canTransitionTo('approved')).toBe(true);
    expect(decision.canTransitionTo('rejected')).toBe(true);

    // From proposed -> executed is not valid
    expect(decision.canTransitionTo('executed')).toBe(false);
  });

  it('transitions status correctly', () => {
    const result = Decision.create({
      type: 'claim_creation',
      title: 'Test decision',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = result.value;
    const transitionResult = decision.transitionTo('approved', 'approver-1' as EntityId);

    expect(transitionResult.ok).toBe(true);
    if (!transitionResult.ok) return;

    const approved = transitionResult.value;
    expect(approved.data.status).toBe('approved');
    expect(approved.data.approvedBy).toBe('approver-1');
    expect(approved.data.approvedAt).toBeDefined();
  });

  it('rejects invalid transitions', () => {
    const result = Decision.create({
      type: 'claim_creation',
      title: 'Test decision',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = result.value;
    const transitionResult = decision.transitionTo('executed');

    expect(transitionResult.ok).toBe(false);
    if (!transitionResult.ok) {
      expect(transitionResult.error.message).toContain('Invalid transition');
    }
  });

  it('identifies high risk decisions requiring approval', () => {
    const lowRisk = Decision.create({
      type: 'claim_creation',
      title: 'Low risk',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
      riskLevel: 'low',
    });

    const highRisk = Decision.create({
      type: 'policy_change',
      title: 'High risk',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
      riskLevel: 'high',
    });

    expect(lowRisk.ok && lowRisk.value.requiresApproval()).toBe(false);
    expect(highRisk.ok && highRisk.value.requiresApproval()).toBe(true);
  });

  it('detects policy violations', () => {
    const result = Decision.create({
      type: 'claim_creation',
      title: 'With violations',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
      policyRefs: [
        { id: 'policy-1', version: '1.0', applicable: true, satisfiedRequirements: [], violatedRequirements: ['req-1'] },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.hasPolicyViolations()).toBe(true);
    const violations = result.value.getPolicyViolations();
    expect(violations).toHaveLength(1);
    expect(violations[0]!.policyId).toBe('policy-1');
  });

  it('serializes and deserializes correctly', () => {
    const result = Decision.create({
      type: 'workflow_step',
      title: 'Process data',
      description: 'Run data processing workflow',
      proposedBy: 'agent-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
      riskLevel: 'medium',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const record = result.value.toRecord();
    const restored = Decision.fromRecord(record);

    expect(restored.data.type).toBe(result.value.data.type);
    expect(restored.data.title).toBe(result.value.data.title);
    expect(restored.data.description).toBe(result.value.data.description);
    expect(restored.data.riskLevel).toBe(result.value.data.riskLevel);
  });
});

describe('Status Transitions', () => {
  it('isValidTransition returns correct results', () => {
    expect(isValidTransition('proposed', 'approved')).toBe(true);
    expect(isValidTransition('proposed', 'rejected')).toBe(true);
    expect(isValidTransition('proposed', 'executed')).toBe(false);
    expect(isValidTransition('approved', 'executed')).toBe(true);
    expect(isValidTransition('approved', 'failed')).toBe(true);
    expect(isValidTransition('rejected', 'approved')).toBe(false);
  });

  it('getValidTransitions returns correct list', () => {
    expect(getValidTransitions('proposed')).toContain('approved');
    expect(getValidTransitions('proposed')).toContain('rejected');
    expect(getValidTransitions('rejected')).toHaveLength(0);
    expect(getValidTransitions('executed')).toContain('rolled_back');
  });
});

describe('DecisionRepository', () => {
  let storage: InMemoryStorage;
  let provenance: ProvenanceLedger;
  let repository: DecisionRepository;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    provenance = new ProvenanceLedger(storage);
    await provenance.initialize();
    repository = new DecisionRepository(storage, provenance);
  });

  it('creates and retrieves decisions', async () => {
    const createResult = await repository.create({
      type: 'claim_creation',
      title: 'Create test claim',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const id = createResult.value.data.id;
    const getResult = await repository.findById(id);

    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;

    expect(getResult.value).not.toBeNull();
    expect(getResult.value!.data.title).toBe('Create test claim');
  });

  it('queries decisions by status', async () => {
    await repository.create({
      type: 'claim_creation',
      title: 'Decision 1',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    await repository.create({
      type: 'entity_creation',
      title: 'Decision 2',
      proposedBy: 'user-2' as EntityId,
      provenanceId: 'prov-2' as EntityId,
    });

    const result = await repository.findByStatus('proposed');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
  });

  it('queries decisions by proposer', async () => {
    await repository.create({
      type: 'claim_creation',
      title: 'Decision 1',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    await repository.create({
      type: 'entity_creation',
      title: 'Decision 2',
      proposedBy: 'user-2' as EntityId,
      provenanceId: 'prov-2' as EntityId,
    });

    const result = await repository.findByProposer('user-1' as EntityId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.data.proposedBy).toBe('user-1');
  });

  it('finds pending decisions', async () => {
    await repository.create({
      type: 'claim_creation',
      title: 'Pending decision',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    const result = await repository.findPending();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
  });

  it('counts decisions by status', async () => {
    await repository.create({
      type: 'claim_creation',
      title: 'Decision 1',
      proposedBy: 'user-1' as EntityId,
      provenanceId: 'prov-1' as EntityId,
    });

    await repository.create({
      type: 'entity_creation',
      title: 'Decision 2',
      proposedBy: 'user-2' as EntityId,
      provenanceId: 'prov-2' as EntityId,
    });

    const result = await repository.countByStatus('proposed');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBe(2);
  });
});

describe('DecisionTraceGraph', () => {
  let storage: InMemoryStorage;
  let graph: DecisionTraceGraph;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    await storage.initialize();
    graph = new DecisionTraceGraph(storage);
    await graph.initialize();
  });

  it('records and retrieves decisions', async () => {
    const recordResult = await graph.recordDecision({
      type: 'claim_creation',
      title: 'Create new claim',
      proposedBy: 'agent-1' as EntityId,
    });

    expect(recordResult.ok).toBe(true);
    if (!recordResult.ok) return;

    const id = recordResult.value.data.id;
    const getResult = await graph.getDecision(id);

    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;

    expect(getResult.value).not.toBeNull();
    expect(getResult.value!.data.title).toBe('Create new claim');
  });

  it('queries decisions', async () => {
    await graph.recordDecision({
      type: 'claim_creation',
      title: 'Claim decision',
      proposedBy: 'agent-1' as EntityId,
    });

    await graph.recordDecision({
      type: 'entity_creation',
      title: 'Entity decision',
      proposedBy: 'agent-1' as EntityId,
    });

    const result = await graph.queryDecisions({ type: 'claim_creation' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.data.type).toBe('claim_creation');
  });

  it('gets pending decisions', async () => {
    await graph.recordDecision({
      type: 'claim_creation',
      title: 'Pending 1',
      proposedBy: 'agent-1' as EntityId,
    });

    await graph.recordDecision({
      type: 'claim_creation',
      title: 'Pending 2',
      proposedBy: 'agent-2' as EntityId,
    });

    const result = await graph.getPendingDecisions();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
  });

  it('gets high risk decisions', async () => {
    await graph.recordDecision({
      type: 'claim_creation',
      title: 'Low risk',
      proposedBy: 'agent-1' as EntityId,
      riskLevel: 'low',
    });

    await graph.recordDecision({
      type: 'policy_change',
      title: 'High risk',
      proposedBy: 'agent-1' as EntityId,
      riskLevel: 'high',
    });

    await graph.recordDecision({
      type: 'policy_change',
      title: 'Critical risk',
      proposedBy: 'agent-1' as EntityId,
      riskLevel: 'critical',
    });

    const result = await graph.getHighRiskDecisions();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
  });

  it('gets decisions by proposer', async () => {
    await graph.recordDecision({
      type: 'claim_creation',
      title: 'Agent 1 decision',
      proposedBy: 'agent-1' as EntityId,
    });

    await graph.recordDecision({
      type: 'claim_creation',
      title: 'Agent 2 decision',
      proposedBy: 'agent-2' as EntityId,
    });

    const result = await graph.getDecisionsByProposer('agent-1' as EntityId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.data.proposedBy).toBe('agent-1');
  });

  it('provides access to provenance ledger', () => {
    const provenance = graph.getProvenanceLedger();
    expect(provenance).toBeInstanceOf(ProvenanceLedger);
  });

  it('determines auto-approval eligibility', async () => {
    const recordResult = await graph.recordDecision({
      type: 'claim_creation',
      title: 'Low risk decision',
      proposedBy: 'agent-1' as EntityId,
      riskLevel: 'low',
    });

    expect(recordResult.ok).toBe(true);
    if (!recordResult.ok) return;

    const canAutoResult = await graph.canAutoApprove(recordResult.value);

    expect(canAutoResult.ok).toBe(true);
    if (!canAutoResult.ok) return;

    // No precedents yet, so auto-approve should be false
    expect(canAutoResult.value).toBe(false);
  });

  it('rejects auto-approval for high risk decisions', async () => {
    const recordResult = await graph.recordDecision({
      type: 'policy_change',
      title: 'High risk decision',
      proposedBy: 'agent-1' as EntityId,
      riskLevel: 'high',
    });

    expect(recordResult.ok).toBe(true);
    if (!recordResult.ok) return;

    const canAutoResult = await graph.canAutoApprove(recordResult.value);

    expect(canAutoResult.ok).toBe(true);
    if (!canAutoResult.ok) return;

    expect(canAutoResult.value).toBe(false);
  });
});
