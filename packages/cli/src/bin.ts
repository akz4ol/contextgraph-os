#!/usr/bin/env node
/**
 * ContextGraph CLI
 *
 * Command-line interface for ContextGraph OS.
 */

import * as fs from 'node:fs/promises';
import { ContextGraph } from '@contextgraph/sdk';
import { ContextGraphRepl, GraphInspector } from './index.js';

const VERSION = '0.1.0';

/**
 * Parse command line arguments
 */
interface ParsedArgs {
  command: string | undefined;
  options: Map<string, string | boolean>;
  positional: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const options = new Map<string, string | boolean>();
  const positional: string[] = [];
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith('-')) {
        options.set(key, nextArg);
        i++;
      } else {
        options.set(key, true);
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      options.set(key, true);
    } else if (command === undefined) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, options, positional };
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
ContextGraph CLI v${VERSION}

Usage: contextgraph [command] [options]

Commands:
  stats              Show system statistics
  entities [type]    List entities
  entity <id>        Inspect an entity
  agents             List active agents
  agent <id|name>    Inspect an agent
  decisions          List pending decisions
  policies           List effective policies
  audit              Show audit trail
  provenance         Query provenance entries
  verify             Verify provenance chain
  context <id>       Assemble context for an entity
  export             Export graph data
  import <file>      Import graph data
  repl               Start interactive REPL

Options:
  --help, -h         Show this help message
  --version, -v      Show version
  --json             Output as JSON
  --no-color         Disable colored output
  --limit N          Limit number of results

Export Options:
  --format <type>    Export format: json, csv (default: json)
  --output <file>    Output file (default: stdout)
  --type <resource>  Resource type for CSV: entities, claims (default: entities)
  --pretty           Pretty print JSON output

Import Options:
  --format <type>    Import format: json, csv (default: json)
  --type <resource>  Resource type for CSV: entities, claims (default: entities)
  --dry-run          Validate without importing
  --merge            Merge with existing data
  --on-conflict      Conflict handling: skip, overwrite, error (default: skip)

Examples:
  contextgraph stats
  contextgraph entities person --limit 10
  contextgraph entity ent_123456
  contextgraph audit --json
  contextgraph export --format json --output backup.json
  contextgraph export --format csv --type entities --output entities.csv
  contextgraph import backup.json
  contextgraph import data.csv --format csv --type entities
  contextgraph repl
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, options, positional } = parseArgs(args);

  // Handle help and version
  if (options.has('help') || options.has('h') || command === 'help') {
    printUsage();
    process.exit(0);
  }

  if (options.has('version') || options.has('v') || command === 'version') {
    console.log(`ContextGraph CLI v${VERSION}`);
    process.exit(0);
  }

  // Create client
  const clientResult = await ContextGraph.create({
    enablePolicies: false,
    enableCapabilities: false,
  });

  if (!clientResult.ok) {
    console.error(`Failed to initialize ContextGraph: ${clientResult.error.message}`);
    process.exit(1);
  }

  const client = clientResult.value;
  const useJson = options.has('json');
  const colors = !options.has('no-color');

  // If no command or REPL, start REPL
  if (command === undefined || command === 'repl') {
    const repl = new ContextGraphRepl(client, { colors, outputJson: useJson });
    repl.print(`ContextGraph CLI v${VERSION}`);
    repl.print('Type "help" for available commands.\n');

    // Simple non-interactive mode for now
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'contextgraph> ',
    });

    rl.prompt();
    rl.on('line', async (line) => {
      await repl.execute(line);
      rl.prompt();
    });
    rl.on('close', () => {
      process.exit(0);
    });
    return;
  }

  // Execute single command
  const inspector = new GraphInspector(client, {
    formatOptions: { colors },
  });

  let result: { success: boolean; output: string; data?: unknown };
  const limit = options.has('limit') ? parseInt(options.get('limit') as string, 10) : undefined;

  switch (command) {
    case 'stats':
      result = await inspector.getStats();
      break;

    case 'entities':
    case 'ls':
    case 'list':
      result = await inspector.listEntities(positional[0], limit ?? 100);
      break;

    case 'entity':
    case 'e':
    case 'get':
      if (positional.length === 0) {
        console.error('Entity ID required');
        process.exit(1);
      }
      result = options.has('with-claims')
        ? await inspector.inspectEntityWithClaims(positional[0]!)
        : await inspector.inspectEntity(positional[0]!);
      break;

    case 'agents':
      result = await inspector.listAgents();
      break;

    case 'agent':
    case 'a':
      if (positional.length === 0) {
        console.error('Agent ID or name required');
        process.exit(1);
      }
      result = await inspector.inspectAgent(positional[0]!);
      break;

    case 'decisions':
    case 'd':
      result = await inspector.listPendingDecisions();
      break;

    case 'policies':
    case 'p':
      result = await inspector.listPolicies();
      break;

    case 'audit':
      result = await inspector.getAuditTrail(limit ?? 20);
      break;

    case 'provenance':
    case 'prov':
      result = await inspector.queryProvenance(limit ?? 10);
      break;

    case 'verify':
      result = await inspector.verifyProvenance();
      break;

    case 'context':
    case 'ctx':
      if (positional.length === 0) {
        console.error('Entity ID required');
        process.exit(1);
      }
      result = await inspector.inspectContext(positional[0]!);
      break;

    case 'export': {
      const format = (options.get('format') as string) ?? 'json';
      const outputFile = options.get('output') as string | undefined;
      const resourceType = (options.get('type') as string) ?? 'entities';
      const prettyPrint = options.has('pretty');

      let output: string;

      if (format === 'json') {
        const exportResult = await client.exportToJSONString({ prettyPrint });
        if (!exportResult.ok) {
          console.error(`Export failed: ${exportResult.error.message}`);
          process.exit(1);
        }
        output = exportResult.value;
      } else if (format === 'csv') {
        if (resourceType === 'entities') {
          const exportResult = await client.exportEntitiesToCSV();
          if (!exportResult.ok) {
            console.error(`Export failed: ${exportResult.error.message}`);
            process.exit(1);
          }
          output = exportResult.value;
        } else if (resourceType === 'claims') {
          const exportResult = await client.exportClaimsToCSV();
          if (!exportResult.ok) {
            console.error(`Export failed: ${exportResult.error.message}`);
            process.exit(1);
          }
          output = exportResult.value;
        } else {
          console.error(`Unknown resource type: ${resourceType}. Use 'entities' or 'claims'.`);
          process.exit(1);
        }
      } else {
        console.error(`Unknown format: ${format}. Use 'json' or 'csv'.`);
        process.exit(1);
      }

      if (outputFile !== undefined) {
        await fs.writeFile(outputFile, output, 'utf-8');
        result = { success: true, output: `Exported to ${outputFile}` };
      } else {
        console.log(output);
        result = { success: true, output: '' };
      }
      break;
    }

    case 'import': {
      const inputFile = positional[0];
      if (inputFile === undefined) {
        console.error('Input file required');
        process.exit(1);
      }

      const format = (options.get('format') as string) ?? 'json';
      const resourceType = (options.get('type') as string) ?? 'entities';
      const dryRun = options.has('dry-run');
      const merge = options.has('merge');
      const onConflict = (options.get('on-conflict') as 'skip' | 'overwrite' | 'error') ?? 'skip';

      let content: string;
      try {
        content = await fs.readFile(inputFile, 'utf-8');
      } catch (error) {
        console.error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      if (format === 'json') {
        const importResult = await client.importFromJSONString(content, { dryRun, merge, onConflict });
        if (!importResult.ok) {
          console.error(`Import failed: ${importResult.error.message}`);
          process.exit(1);
        }
        const r = importResult.value;
        result = {
          success: r.success,
          output: dryRun
            ? `Dry run: Would import ${r.entitiesImported} entities, ${r.claimsImported} claims, ${r.agentsImported} agents, ${r.decisionsImported} decisions, ${r.policiesImported} policies`
            : `Imported ${r.entitiesImported} entities, ${r.claimsImported} claims, ${r.agentsImported} agents, ${r.decisionsImported} decisions, ${r.policiesImported} policies`,
          data: r,
        };
      } else if (format === 'csv') {
        if (resourceType === 'entities') {
          const importResult = await client.importEntitiesFromCSV(content, { dryRun, merge, onConflict });
          if (!importResult.ok) {
            console.error(`Import failed: ${importResult.error.message}`);
            process.exit(1);
          }
          const r = importResult.value;
          result = {
            success: r.success,
            output: dryRun
              ? `Dry run: Would import ${r.entitiesImported} entities`
              : `Imported ${r.entitiesImported} entities`,
            data: r,
          };
        } else if (resourceType === 'claims') {
          const importResult = await client.importClaimsFromCSV(content, { dryRun, merge, onConflict });
          if (!importResult.ok) {
            console.error(`Import failed: ${importResult.error.message}`);
            process.exit(1);
          }
          const r = importResult.value;
          result = {
            success: r.success,
            output: dryRun
              ? `Dry run: Would import ${r.claimsImported} claims`
              : `Imported ${r.claimsImported} claims`,
            data: r,
          };
        } else {
          console.error(`Unknown resource type: ${resourceType}. Use 'entities' or 'claims'.`);
          process.exit(1);
        }
      } else {
        console.error(`Unknown format: ${format}. Use 'json' or 'csv'.`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }

  // Output result
  if (useJson && result.data !== undefined) {
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log(result.output);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
