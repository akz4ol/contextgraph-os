/**
 * Regulated Agent Demo
 *
 * Demonstrates policy-controlled agent actions with human-in-the-loop approval.
 */

import { ContextGraph } from '@contextgraph/sdk';

async function runDemo() {
  console.log('\n  ContextGraph OS - Regulated Agent Demo');
  console.log('  ─────────────────────────────────────────\n');

  // Initialize ContextGraph
  const cg = new ContextGraph({
    storage: { type: 'memory' },
  });

  // Register an agent
  const agent = await cg.registerAgent({
    name: 'report-generator',
    capabilities: ['read', 'generate', 'publish'],
  });

  console.log('  [1/5] Agent proposing action...');
  console.log('    Type: publish_report');
  console.log('    Target: external_audience');

  // Add some evidence claims
  const claim1 = await cg.addClaim({
    entity: 'quarterly_report_q4',
    attribute: 'status',
    value: 'verified',
    source: { type: 'analyst', id: 'user_123' },
    confidence: 0.95,
  });

  const claim2 = await cg.addClaim({
    entity: 'quarterly_report_q4',
    attribute: 'accuracy',
    value: 'high',
    source: { type: 'quality_check', id: 'qc_456' },
    confidence: 0.92,
  });

  const claim3 = await cg.addClaim({
    entity: 'quarterly_report_q4',
    attribute: 'approval_status',
    value: 'manager_approved',
    source: { type: 'manager', id: 'user_789' },
    confidence: 1.0,
  });

  console.log('    Evidence: 3 claims linked\n');

  // Create a policy that requires approval for external publishing
  await cg.createPolicy({
    name: 'external_publish_guard',
    effect: 'deny',
    subjects: ['*'],
    actions: ['publish'],
    resources: ['external_audience'],
    conditions: [
      { field: 'risk.level', operator: 'in', value: ['HIGH', 'CRITICAL'] },
    ],
    priority: 100,
  });

  console.log('  [2/5] Policy evaluation...');

  // Propose the decision
  const decision = await cg.proposeDecision({
    type: 'publish_report',
    proposedBy: agent.id,
    action: {
      type: 'publish',
      target: 'external_audience',
      parameters: {
        reportId: 'quarterly_report_q4',
        format: 'pdf',
        distribution: 'public',
      },
    },
    evidenceIds: [claim1.id, claim2.id, claim3.id],
    risk: {
      level: 'HIGH',
      score: 0.75,
      factors: [
        { type: 'external_audience', weight: 0.4 },
        { type: 'financial_data', weight: 0.35 },
      ],
    },
  });

  console.log('    Matched: pol_external_publish_guard');
  console.log('    Risk Level: HIGH');
  console.log(`    Result: DENY (requires approval)\n`);

  console.log('  [3/5] Decision queued for review');
  console.log('    Queue: human_review');
  console.log('    Waiting for: role:compliance_officer\n');

  // Simulate human approval
  await new Promise((resolve) => setTimeout(resolve, 500));

  await cg.approveDecision(decision.id, {
    approvedBy: 'user:jane.doe',
    reason: 'Report accuracy verified, distribution approved',
  });

  console.log('  [4/5] Human review completed');
  console.log('    Approved by: user:jane.doe');
  console.log('    Reason: "Report accuracy verified"\n');

  // Execute the decision
  const result = await cg.executeDecision(decision.id);

  console.log('  [5/5] Action executed');
  console.log('    Status: COMPLETED');
  console.log(`    Decision ID: ${decision.id}`);
  console.log(`    Provenance: ${result.provenanceId}\n`);

  console.log('  Full audit trail recorded\n');

  // Show the audit trail
  const auditTrail = await cg.getDecisionHistory(decision.id);
  console.log('  Audit Trail:');
  for (const event of auditTrail) {
    console.log(`    ${event.timestamp}: ${event.fromStatus || 'null'} → ${event.toStatus}`);
  }
}

runDemo().catch(console.error);
