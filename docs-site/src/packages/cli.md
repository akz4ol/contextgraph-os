# @contextgraph/cli

CLI tools and interactive REPL.

## Installation

```bash
pnpm add -g @contextgraph/cli
```

## Commands

### stats

Show system statistics:

```bash
npx contextgraph stats
```

### entities

List entities:

```bash
npx contextgraph entities [type] --limit 10
```

### entity

Inspect an entity:

```bash
npx contextgraph entity <id> --with-claims
```

### agents

List agents:

```bash
npx contextgraph agents
```

### agent

Inspect an agent:

```bash
npx contextgraph agent <id|name>
```

### decisions

List pending decisions:

```bash
npx contextgraph decisions
```

### policies

List policies:

```bash
npx contextgraph policies
```

### audit

Show audit trail:

```bash
npx contextgraph audit --json
```

### provenance

Query provenance:

```bash
npx contextgraph provenance --subject <id>
```

### verify

Verify provenance chain:

```bash
npx contextgraph verify
```

### context

Assemble context:

```bash
npx contextgraph context <entity-id>
```

### export

Export data:

```bash
npx contextgraph export --format json --output backup.json
npx contextgraph export --format csv --type entities --output entities.csv
```

### import

Import data:

```bash
npx contextgraph import backup.json
npx contextgraph import entities.csv --format csv --type entities --dry-run
```

### repl

Start interactive REPL:

```bash
npx contextgraph repl
```

## REPL

The interactive REPL provides a shell for exploration:

```
ContextGraph OS REPL v0.1.0
Type 'help' for available commands, 'exit' to quit.

contextgraph> stats
╔═══════════════════════════════════════╗
║         System Statistics             ║
╠═══════════════════════════════════════╣
║  Entities:    42                      ║
║  Claims:      156                     ║
║  Agents:      3                       ║
╚═══════════════════════════════════════╝

contextgraph> entities person
┌──────────────────┬─────────┬──────────────┐
│ ID               │ Type    │ Name         │
├──────────────────┼─────────┼──────────────┤
│ ent_abc123...    │ person  │ Alice        │
│ ent_def456...    │ person  │ Bob          │
└──────────────────┴─────────┴──────────────┘

contextgraph> json
JSON output mode: ON

contextgraph> exit
Goodbye!
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--help` | Show help |
| `--version` | Show version |
