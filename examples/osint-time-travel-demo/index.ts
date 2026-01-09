/**
 * OSINT Time Travel Demo
 *
 * Demonstrates temporal queries - asking "what did we know at point X in time?"
 */

import { ContextGraph } from '@contextgraph/sdk';

async function runDemo() {
  console.log('\n  ContextGraph OS - Temporal Query Demo');
  console.log('  ─────────────────────────────────────────\n');

  const cg = new ContextGraph({
    storage: { type: 'memory' },
  });

  console.log('  Creating temporal data history...\n');

  // Create an entity
  const reportId = 'report_analysis_2024';

  // Add claims at different points in time
  // March 1: Status = draft
  await cg.addClaim({
    entity: reportId,
    attribute: 'status',
    value: 'draft',
    source: { type: 'system', id: 'auto_create' },
    confidence: 1.0,
    validFrom: new Date('2024-03-01T00:00:00Z'),
    validUntil: new Date('2024-03-10T00:00:00Z'),
  });

  // March 10: Status = reviewed
  await cg.addClaim({
    entity: reportId,
    attribute: 'status',
    value: 'reviewed',
    source: { type: 'analyst', id: 'user_123' },
    confidence: 1.0,
    validFrom: new Date('2024-03-10T00:00:00Z'),
    validUntil: new Date('2024-03-20T00:00:00Z'),
  });

  // March 20: Status = published
  await cg.addClaim({
    entity: reportId,
    attribute: 'status',
    value: 'published',
    source: { type: 'publisher', id: 'pub_system' },
    confidence: 1.0,
    validFrom: new Date('2024-03-20T00:00:00Z'),
  });

  console.log('  Timeline:');
  console.log('  ├─ Mar 1:  status = "draft"');
  console.log('  ├─ Mar 10: status = "reviewed"');
  console.log('  └─ Mar 20: status = "published"\n');

  // Query at different points in time
  console.log('  Query: "What was the status on March 15?"\n');

  console.log('  await ckg.query({');
  console.log('    entityId: reportId,');
  console.log('    asOf: "2024-03-15T00:00:00Z"');
  console.log('  });\n');

  const march15Result = await cg.query({
    entityId: reportId,
    attribute: 'status',
    asOf: new Date('2024-03-15T00:00:00Z'),
  });

  console.log('  Result:');
  console.log('  {');
  console.log('    attribute: "status",');
  console.log(`    value: "${march15Result.value}",`);
  console.log(`    validFrom: "${march15Result.validFrom.toISOString()}",`);
  console.log(`    validUntil: "${march15Result.validUntil?.toISOString()}",`);
  console.log('    source: { type: "analyst", id: "user_123" }');
  console.log('  }\n');

  console.log('  Time-travel query successful!\n');

  // Additional queries
  console.log('  ─────────────────────────────────────────\n');
  console.log('  Additional queries:\n');

  // March 5
  const march5Result = await cg.query({
    entityId: reportId,
    attribute: 'status',
    asOf: new Date('2024-03-05T00:00:00Z'),
  });
  console.log(`  March 5:  status = "${march5Result.value}"`);

  // March 25
  const march25Result = await cg.query({
    entityId: reportId,
    attribute: 'status',
    asOf: new Date('2024-03-25T00:00:00Z'),
  });
  console.log(`  March 25: status = "${march25Result.value}"`);

  // Today
  const todayResult = await cg.query({
    entityId: reportId,
    attribute: 'status',
  });
  console.log(`  Today:    status = "${todayResult.value}"\n`);

  console.log('  All historical data preserved and queryable!\n');
}

runDemo().catch(console.error);
