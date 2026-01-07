/**
 * Agent Workflow Demo
 *
 * Demonstrates agent-based workflows in ContextGraph OS:
 * - Creating and managing agents
 * - Decision making with audit trails
 * - Action execution with handlers
 * - Policy-based access control
 */

import { ContextGraph, type Agent, type Decision, ok, err } from '@contextgraph/sdk';

export async function runAgentWorkflowDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ContextGraph OS - Agent Workflow Demo');
  console.log('='.repeat(60));
  console.log();

  // Create client with policies disabled for simplicity
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

  // Create agents
  console.log('Creating agents...');

  const orchestratorResult = await client.createAgent({
    name: 'orchestrator',
    description: 'Main workflow orchestrator agent',
    metadata: { version: '1.0', type: 'coordinator' },
  });

  if (!orchestratorResult.ok) {
    console.error('Failed to create orchestrator:', orchestratorResult.error);
    return;
  }

  const orchestrator = orchestratorResult.value;
  console.log(`  Created: ${orchestrator.data.name} (${orchestrator.data.id})`);

  const workerResult = await client.createAgent({
    name: 'worker',
    description: 'Task execution worker agent',
    metadata: { version: '1.0', type: 'executor' },
  });

  if (!workerResult.ok) {
    console.error('Failed to create worker:', workerResult.error);
    return;
  }

  const worker = workerResult.value;
  console.log(`  Created: ${worker.data.name} (${worker.data.id})`);
  console.log();

  // Register action handlers
  console.log('Registering action handlers...');

  client.registerHandler('execute', 'data_processing', async (action) => {
    console.log(`  [Handler] Processing data: ${JSON.stringify(action.parameters)}`);
    return ok({
      processed: true,
      itemCount: 42,
      timestamp: Date.now(),
    });
  });

  client.registerHandler('read', 'configuration', async (action) => {
    console.log(`  [Handler] Reading configuration: ${action.resourceId}`);
    return ok({
      setting1: 'value1',
      setting2: 'value2',
    });
  });

  client.registerHandler('write', 'report', async (action) => {
    console.log(`  [Handler] Writing report: ${JSON.stringify(action.parameters)}`);
    return ok({ reportId: 'rpt_12345' });
  });

  console.log('  Handlers registered: data_processing, configuration, report');
  console.log();

  // Create a decision for the workflow
  console.log('Recording workflow decision...');

  const decisionResult = await client.recordDecision({
    type: 'workflow_step',
    title: 'Execute data processing pipeline',
    proposedBy: orchestrator.data.id,
    description: 'Process incoming data and generate reports',
    riskLevel: 'medium',
  });

  if (!decisionResult.ok) {
    console.error('Failed to record decision:', decisionResult.error);
    return;
  }

  const decision = decisionResult.value;
  console.log(`  Decision recorded: ${decision.data.title}`);
  console.log(`  Status: ${decision.data.status}`);
  console.log(`  Risk Level: ${decision.data.riskLevel}`);
  console.log();

  // Execute actions
  console.log('Executing workflow actions...');

  // Step 1: Read configuration
  const configResult = await client.execute({
    agentId: worker.data.id,
    action: 'read',
    resourceType: 'configuration',
    resourceId: 'pipeline-config',
  });

  console.log(`  Read config: ${configResult.ok ? 'Success' : 'Failed'}`);

  // Step 2: Process data
  const processResult = await client.execute({
    agentId: worker.data.id,
    action: 'execute',
    resourceType: 'data_processing',
    parameters: { inputPath: '/data/input', outputPath: '/data/output' },
  });

  console.log(`  Process data: ${processResult.ok ? 'Success' : 'Failed'}`);

  // Step 3: Write report
  const reportResult = await client.execute({
    agentId: worker.data.id,
    action: 'write',
    resourceType: 'report',
    parameters: { title: 'Processing Summary', format: 'json' },
  });

  console.log(`  Write report: ${reportResult.ok ? 'Success' : 'Failed'}`);
  console.log();

  // Get audit trail
  console.log('Audit trail:');
  const auditResult = await client.getAuditTrail({ limit: 10 });
  if (auditResult.ok) {
    for (const entry of auditResult.value) {
      const time = new Date(entry.timestamp).toISOString().slice(11, 19);
      console.log(`  [${time}] ${entry.action.padEnd(10)} ${entry.resource.slice(0, 25).padEnd(27)} ${entry.outcome}`);
    }
  }
  console.log();

  // List active agents
  console.log('Active agents:');
  const agentsResult = await client.getActiveAgents();
  if (agentsResult.ok) {
    for (const agent of agentsResult.value) {
      console.log(`  - ${agent.data.name}: ${agent.data.description ?? 'No description'}`);
    }
  }
  console.log();

  // Verify provenance
  console.log('Provenance verification:');
  const verifyResult = await client.verifyProvenance();
  if (verifyResult.ok) {
    console.log(`  Chain integrity: ${verifyResult.value.valid ? 'VALID' : 'INVALID'}`);
    console.log(`  Total entries: ${verifyResult.value.entriesVerified}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('Demo completed successfully!');
  console.log('='.repeat(60));
}

// Run if executed directly
runAgentWorkflowDemo().catch(console.error);
