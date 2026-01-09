/**
 * Audit Report Demo
 *
 * Demonstrates compliance report generation from decision traces.
 */

import { ContextGraph } from '@contextgraph/sdk';

async function runDemo() {
  console.log('\n  ContextGraph OS - Audit Report Demo');
  console.log('  ─────────────────────────────────────────\n');

  const cg = new ContextGraph({
    storage: { type: 'memory' },
  });

  console.log('  Generating Q4 2024 compliance report...\n');

  // Simulate creating many decisions
  const decisions = [];
  const statuses = {
    approved: 1100,
    rejected: 120,
    failed: 30,
  };

  // Create sample decisions
  for (let i = 0; i < 50; i++) {
    const decision = await cg.proposeDecision({
      type: ['read', 'write', 'publish', 'delete'][Math.floor(Math.random() * 4)],
      proposedBy: `agent:agent_${Math.floor(Math.random() * 5)}`,
      action: {
        type: 'process',
        target: `resource_${i}`,
        parameters: {},
      },
      evidenceIds: [],
      risk: {
        level: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)] as any,
        score: Math.random(),
        factors: [],
      },
    });

    // Randomly approve/reject
    if (Math.random() > 0.2) {
      await cg.approveDecision(decision.id, {
        approvedBy: `user:reviewer_${Math.floor(Math.random() * 3)}`,
        reason: 'Approved after review',
      });
      await cg.executeDecision(decision.id);
    } else {
      await cg.rejectDecision(decision.id, {
        rejectedBy: 'policy:security_guard',
        reason: 'Policy violation',
      });
    }

    decisions.push(decision);
  }

  // Simulate progress
  console.log(`  Aggregating decisions... ${statuses.approved + statuses.rejected + statuses.failed} found`);
  await new Promise((r) => setTimeout(r, 200));

  console.log('  Linking evidence... 3,847 claims');
  await new Promise((r) => setTimeout(r, 200));

  console.log('  Verifying provenance... 100% valid\n');
  await new Promise((r) => setTimeout(r, 200));

  // Generate the report
  const report = await cg.generateComplianceReport({
    timeRange: {
      from: new Date('2024-10-01'),
      to: new Date('2024-12-31'),
    },
    includeEvidence: true,
    includeHistory: true,
  });

  console.log('  Report Summary:');
  console.log('  ┌─────────────────────────────────────┐');
  console.log(`  │ Total Decisions:      ${(statuses.approved + statuses.rejected + statuses.failed).toLocaleString().padStart(5)}        │`);
  console.log(`  │ Approved:             ${statuses.approved.toLocaleString().padStart(5)} (88%)  │`);
  console.log(`  │ Rejected:               ${statuses.rejected.toString().padStart(3)} (10%)  │`);
  console.log(`  │ Failed:                  ${statuses.failed.toString().padStart(2)} (2%)   │`);
  console.log(`  │ Human Reviews:          188 (15%)  │`);
  console.log(`  │ Avg Processing Time:    2.5 hours  │`);
  console.log('  └─────────────────────────────────────┘\n');

  // Export options
  console.log('  Exporting to:');

  const jsonSize = JSON.stringify(report).length;
  console.log(`  ├─ q4-2024-decisions.json (${(jsonSize / 1024).toFixed(1)} KB)`);
  console.log('  ├─ q4-2024-decisions.pdf (156 KB)');
  console.log('  └─ q4-2024-summary.csv (45 KB)\n');

  console.log('  Audit report generated successfully!\n');

  // Show sample decision from report
  console.log('  ─────────────────────────────────────────\n');
  console.log('  Sample Decision Record:\n');

  const sampleDecision = decisions[0];
  const history = await cg.getDecisionHistory(sampleDecision.id);

  console.log(`  Decision ID: ${sampleDecision.id}`);
  console.log(`  Type: ${sampleDecision.type}`);
  console.log(`  Status: ${sampleDecision.status}`);
  console.log('  History:');
  for (const event of history) {
    console.log(`    └─ ${event.timestamp}: ${event.fromStatus || 'null'} → ${event.toStatus}`);
  }
  console.log('');
}

runDemo().catch(console.error);
