#!/usr/bin/env node
/**
 * ContextGraph API Server CLI
 */

import { createServer, type ServerConfig } from './server.js';

// Parse command line arguments
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;

    switch (arg) {
      case '-p':
      case '--port': {
        const portArg = args[++i];
        if (portArg !== undefined) {
          config.port = parseInt(portArg, 10);
        }
        break;
      }
      case '-h':
      case '--host': {
        const hostArg = args[++i];
        if (hostArg !== undefined) {
          config.host = hostArg;
        }
        break;
      }
      case '--no-cors':
        config.cors = false;
        break;
      case '--no-rate-limit':
        config.rateLimit = false;
        break;
      case '--no-logging':
        config.logging = false;
        break;
      case '--api-key': {
        const keyArg = args[++i];
        if (keyArg !== undefined) {
          config.auth = {
            enabled: true,
            apiKeys: new Set([keyArg]),
          };
        }
        break;
      }
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
ContextGraph API Server

Usage: contextgraph-api [options]

Options:
  -p, --port <number>     Port to listen on (default: 3000)
  -h, --host <string>     Host to bind to (default: localhost)
  --no-cors               Disable CORS
  --no-rate-limit         Disable rate limiting
  --no-logging            Disable request logging
  --api-key <key>         Enable API key authentication
  --help                  Show this help message

Examples:
  contextgraph-api                          # Start on localhost:3000
  contextgraph-api -p 8080                  # Start on port 8080
  contextgraph-api --api-key secret123      # Enable API key auth

API Endpoints:
  GET    /api/v1/stats                      System statistics
  GET    /api/v1/health                     Health check
  GET    /api/v1/audit                      Audit trail
  GET    /api/v1/provenance                 Query provenance
  POST   /api/v1/provenance/verify          Verify provenance chain

  GET    /api/v1/entities                   List entities
  POST   /api/v1/entities                   Create entity
  GET    /api/v1/entities/:id               Get entity
  PUT    /api/v1/entities/:id               Update entity
  DELETE /api/v1/entities/:id               Delete entity
  GET    /api/v1/entities/:id/claims        Get entity claims
  POST   /api/v1/entities/:id/claims        Add claim

  GET    /api/v1/agents                     List agents
  POST   /api/v1/agents                     Create agent
  GET    /api/v1/agents/:id                 Get agent
  PUT    /api/v1/agents/:id                 Update agent
  POST   /api/v1/agents/:id/execute         Execute action

  GET    /api/v1/decisions                  List decisions
  POST   /api/v1/decisions                  Create decision
  GET    /api/v1/decisions/:id              Get decision
  POST   /api/v1/decisions/:id/approve      Approve decision
  POST   /api/v1/decisions/:id/reject       Reject decision

  GET    /api/v1/policies                   List policies
  POST   /api/v1/policies                   Create policy
  GET    /api/v1/policies/:id               Get policy
  PUT    /api/v1/policies/:id               Update policy
  DELETE /api/v1/policies/:id               Archive policy
`);
}

// Main
async function main(): Promise<void> {
  const config = parseArgs();

  console.log('Starting ContextGraph API server...');

  try {
    const server = await createServer(config);
    await server.start();

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
