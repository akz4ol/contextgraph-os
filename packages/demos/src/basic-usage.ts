/**
 * Basic Usage Demo
 *
 * Demonstrates the core features of ContextGraph OS:
 * - Creating entities and claims
 * - Querying the knowledge graph
 * - Provenance tracking
 */

import {
  ContextGraph,
  createScope,
  createConfidence,
} from '@contextgraph/sdk';

export async function runBasicUsageDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ContextGraph OS - Basic Usage Demo');
  console.log('='.repeat(60));
  console.log();

  // Create client
  console.log('Creating ContextGraph client...');
  const clientResult = await ContextGraph.create({
    enablePolicies: false,
    enableCapabilities: false,
  });

  if (!clientResult.ok) {
    console.error('Failed to create client:', clientResult.error);
    return;
  }

  const client = clientResult.value;
  console.log('Client created successfully.\n');

  // Create entities
  console.log('Creating entities...');

  const aliceResult = await client.createEntity({
    type: 'person',
    name: 'Alice',
    properties: { department: 'Engineering', role: 'Senior Developer' },
  });

  if (!aliceResult.ok) {
    console.error('Failed to create Alice:', aliceResult.error);
    return;
  }

  const alice = aliceResult.value;
  console.log(`  Created: ${alice.data.name} (${alice.data.id})`);

  const projectResult = await client.createEntity({
    type: 'project',
    name: 'ContextGraph OS',
    properties: { status: 'active', priority: 'high' },
  });

  if (!projectResult.ok) {
    console.error('Failed to create project:', projectResult.error);
    return;
  }

  const project = projectResult.value;
  console.log(`  Created: ${project.data.name} (${project.data.id})`);
  console.log();

  // Add claims
  console.log('Adding claims with provenance...');

  await client.addClaim({
    subjectId: alice.data.id,
    predicate: 'works_on',
    value: project.data.name,
    objectId: project.data.id,
    context: {
      scope: createScope('work'),
      confidence: createConfidence(1.0),
    },
  });
  console.log(`  Added: ${alice.data.name} works_on ${project.data.name}`);

  await client.addClaim({
    subjectId: alice.data.id,
    predicate: 'has_skill',
    value: 'TypeScript',
    context: {
      confidence: createConfidence(0.95),
    },
  });
  console.log(`  Added: ${alice.data.name} has_skill TypeScript`);

  await client.addClaim({
    subjectId: project.data.id,
    predicate: 'uses_technology',
    value: 'TypeScript',
    context: {
      confidence: createConfidence(1.0),
    },
  });
  console.log(`  Added: ${project.data.name} uses_technology TypeScript`);
  console.log();

  // Query the graph
  console.log('Querying the knowledge graph...');

  const claimsResult = await client.getClaims(alice.data.id);
  if (claimsResult.ok) {
    console.log(`  Claims for ${alice.data.name}:`);
    for (const claim of claimsResult.value) {
      console.log(`    - ${claim.data.predicate}: ${claim.data.objectValue ?? claim.data.objectId}`);
    }
  }
  console.log();

  // Verify provenance
  console.log('Verifying provenance chain...');
  const verifyResult = await client.verifyProvenance();
  if (verifyResult.ok) {
    console.log(`  Chain valid: ${verifyResult.value.valid}`);
    console.log(`  Entries verified: ${verifyResult.value.entriesVerified}`);
  }
  console.log();

  // Get system stats
  console.log('System statistics:');
  const statsResult = await client.getStats();
  if (statsResult.ok) {
    console.log(`  Entities: ${statsResult.value.entities}`);
    console.log(`  Claims: ${statsResult.value.claims}`);
    console.log(`  Agents: ${statsResult.value.agents}`);
    console.log(`  Decisions: ${statsResult.value.decisions}`);
    console.log(`  Policies: ${statsResult.value.policies}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('Demo completed successfully!');
  console.log('='.repeat(60));
}

// Run if executed directly
runBasicUsageDemo().catch(console.error);
