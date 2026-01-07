/**
 * Interactive REPL
 *
 * Read-Eval-Print-Loop for exploring ContextGraph.
 */

import type { ContextGraph } from '@contextgraph/sdk';
import { GraphInspector } from './inspector.js';
import { formatJSON } from './formatters.js';

/**
 * REPL command definition
 */
export interface ReplCommand {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly execute: (args: string[], repl: ContextGraphRepl) => Promise<void>;
}

/**
 * REPL configuration
 */
export interface ReplConfig {
  readonly colors?: boolean;
  readonly outputJson?: boolean;
}

/**
 * ContextGraph REPL
 *
 * Interactive command-line interface for exploring ContextGraph.
 */
export class ContextGraphRepl {
  private readonly inspector: GraphInspector;
  private readonly commands: Map<string, ReplCommand> = new Map();
  private outputJson: boolean;
  private running: boolean = false;

  constructor(
    private readonly client: ContextGraph,
    config: ReplConfig = {}
  ) {
    this.inspector = new GraphInspector(client, {
      formatOptions: { colors: config.colors ?? true },
    });
    this.outputJson = config.outputJson ?? false;
    this.registerBuiltinCommands();
  }

  /**
   * Print output
   */
  print(message: string): void {
    console.log(message);
  }

  /**
   * Print error
   */
  printError(message: string): void {
    console.error(`Error: ${message}`);
  }

  /**
   * Set JSON output mode
   */
  setJsonOutput(enabled: boolean): void {
    this.outputJson = enabled;
  }

  /**
   * Register a command
   */
  registerCommand(command: ReplCommand): void {
    this.commands.set(command.name, command);
    if (command.aliases !== undefined) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  /**
   * Execute a command string
   */
  async execute(input: string): Promise<void> {
    const trimmed = input.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      return;
    }

    const [commandName, ...args] = this.parseInput(trimmed);
    if (commandName === undefined) {
      return;
    }

    const command = this.commands.get(commandName.toLowerCase());
    if (command === undefined) {
      this.printError(`Unknown command: ${commandName}. Type 'help' for available commands.`);
      return;
    }

    try {
      await command.execute(args, this);
    } catch (error) {
      this.printError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Parse input into command and arguments
   */
  private parseInput(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of input) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current !== '') {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current !== '') {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Get inspector for commands
   */
  getInspector(): GraphInspector {
    return this.inspector;
  }

  /**
   * Get client for commands
   */
  getClient(): ContextGraph {
    return this.client;
  }

  /**
   * Get all commands
   */
  getCommands(): ReplCommand[] {
    const seen = new Set<string>();
    const commands: ReplCommand[] = [];

    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        commands.push(cmd);
      }
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Handle result output
   */
  handleResult(result: { success: boolean; output: string; data?: unknown }): void {
    if (this.outputJson && result.data !== undefined) {
      this.print(formatJSON(result.data));
    } else {
      this.print(result.output);
    }
  }

  /**
   * Register built-in commands
   */
  private registerBuiltinCommands(): void {
    // Help command
    this.registerCommand({
      name: 'help',
      aliases: ['?', 'h'],
      description: 'Show available commands',
      usage: 'help [command]',
      execute: async (args, repl) => {
        if (args.length > 0) {
          const cmd = repl.commands.get(args[0]!.toLowerCase());
          if (cmd !== undefined) {
            repl.print(`${cmd.name}: ${cmd.description}`);
            repl.print(`Usage: ${cmd.usage}`);
            if (cmd.aliases !== undefined && cmd.aliases.length > 0) {
              repl.print(`Aliases: ${cmd.aliases.join(', ')}`);
            }
          } else {
            repl.printError(`Unknown command: ${args[0]}`);
          }
        } else {
          repl.print('Available commands:\n');
          for (const cmd of repl.getCommands()) {
            repl.print(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
          }
          repl.print('\nType "help <command>" for more information.');
        }
      },
    });

    // Stats command
    this.registerCommand({
      name: 'stats',
      description: 'Show system statistics',
      usage: 'stats',
      execute: async (_args, repl) => {
        const result = await repl.getInspector().getStats();
        repl.handleResult(result);
      },
    });

    // Entities command
    this.registerCommand({
      name: 'entities',
      aliases: ['ls', 'list'],
      description: 'List entities',
      usage: 'entities [type] [--limit N]',
      execute: async (args, repl) => {
        let type: string | undefined;
        let limit = 100;

        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--limit' && args[i + 1] !== undefined) {
            limit = parseInt(args[i + 1]!, 10);
            i++;
          } else if (!args[i]!.startsWith('--')) {
            type = args[i];
          }
        }

        const result = await repl.getInspector().listEntities(type, limit);
        repl.handleResult(result);
      },
    });

    // Entity command
    this.registerCommand({
      name: 'entity',
      aliases: ['e', 'get'],
      description: 'Inspect an entity',
      usage: 'entity <id> [--with-claims]',
      execute: async (args, repl) => {
        if (args.length === 0) {
          repl.printError('Entity ID required');
          return;
        }

        const withClaims = args.includes('--with-claims');
        const id = args[0]!;

        const result = withClaims
          ? await repl.getInspector().inspectEntityWithClaims(id)
          : await repl.getInspector().inspectEntity(id);
        repl.handleResult(result);
      },
    });

    // Agents command
    this.registerCommand({
      name: 'agents',
      description: 'List active agents',
      usage: 'agents',
      execute: async (_args, repl) => {
        const result = await repl.getInspector().listAgents();
        repl.handleResult(result);
      },
    });

    // Agent command
    this.registerCommand({
      name: 'agent',
      aliases: ['a'],
      description: 'Inspect an agent',
      usage: 'agent <id|name>',
      execute: async (args, repl) => {
        if (args.length === 0) {
          repl.printError('Agent ID or name required');
          return;
        }
        const result = await repl.getInspector().inspectAgent(args[0]!);
        repl.handleResult(result);
      },
    });

    // Decisions command
    this.registerCommand({
      name: 'decisions',
      aliases: ['d'],
      description: 'List pending decisions',
      usage: 'decisions',
      execute: async (_args, repl) => {
        const result = await repl.getInspector().listPendingDecisions();
        repl.handleResult(result);
      },
    });

    // Policies command
    this.registerCommand({
      name: 'policies',
      aliases: ['p'],
      description: 'List effective policies',
      usage: 'policies',
      execute: async (_args, repl) => {
        const result = await repl.getInspector().listPolicies();
        repl.handleResult(result);
      },
    });

    // Audit command
    this.registerCommand({
      name: 'audit',
      description: 'Show audit trail',
      usage: 'audit [--limit N]',
      execute: async (args, repl) => {
        let limit = 20;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--limit' && args[i + 1] !== undefined) {
            limit = parseInt(args[i + 1]!, 10);
            i++;
          }
        }
        const result = await repl.getInspector().getAuditTrail(limit);
        repl.handleResult(result);
      },
    });

    // Provenance command
    this.registerCommand({
      name: 'provenance',
      aliases: ['prov'],
      description: 'Query provenance entries',
      usage: 'provenance [--limit N]',
      execute: async (args, repl) => {
        let limit = 10;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--limit' && args[i + 1] !== undefined) {
            limit = parseInt(args[i + 1]!, 10);
            i++;
          }
        }
        const result = await repl.getInspector().queryProvenance(limit);
        repl.handleResult(result);
      },
    });

    // Verify command
    this.registerCommand({
      name: 'verify',
      description: 'Verify provenance chain integrity',
      usage: 'verify',
      execute: async (_args, repl) => {
        const result = await repl.getInspector().verifyProvenance();
        repl.handleResult(result);
      },
    });

    // Context command
    this.registerCommand({
      name: 'context',
      aliases: ['ctx'],
      description: 'Assemble context for an entity',
      usage: 'context <entity-id>',
      execute: async (args, repl) => {
        if (args.length === 0) {
          repl.printError('Entity ID required');
          return;
        }
        const result = await repl.getInspector().inspectContext(args[0]!);
        repl.handleResult(result);
      },
    });

    // JSON command
    this.registerCommand({
      name: 'json',
      description: 'Toggle JSON output mode',
      usage: 'json [on|off]',
      execute: async (args, repl) => {
        if (args.length > 0) {
          repl.setJsonOutput(args[0] === 'on');
        } else {
          repl.setJsonOutput(!repl.outputJson);
        }
        repl.print(`JSON output: ${repl.outputJson ? 'enabled' : 'disabled'}`);
      },
    });

    // Exit command
    this.registerCommand({
      name: 'exit',
      aliases: ['quit', 'q'],
      description: 'Exit the REPL',
      usage: 'exit',
      execute: async (_args, repl) => {
        repl.running = false;
        repl.print('Goodbye!');
      },
    });
  }
}
