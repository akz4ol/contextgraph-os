/**
 * ContextGraph Visualizer
 *
 * High-level visualization APIs for ContextGraph data structures
 */

import type { Result } from '@contextgraph/core';
import type { ProvenanceLedger } from '@contextgraph/provenance';
import type { CKG, Claim } from '@contextgraph/ckg';
import type { DecisionTraceGraph } from '@contextgraph/dtg';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  VizOptions,
  OutputFormat,
  TimelineEvent,
} from './types.js';
import { renderDot } from './renderers/dot.js';
import { renderMermaid } from './renderers/mermaid.js';
import { renderD3 } from './renderers/d3.js';
import { renderSvg } from './renderers/svg.js';

/**
 * Default visualization options
 */
const DEFAULT_OPTIONS: VizOptions = {
  format: 'mermaid',
  showLabels: true,
  showTimestamps: false,
  maxDepth: 10,
  colorScheme: 'default',
  direction: 'TB',
};

/**
 * Render graph data to specified format
 */
function renderGraph(data: GraphData, options: VizOptions): string {
  switch (options.format) {
    case 'dot':
      return renderDot(data, options);
    case 'mermaid':
      return renderMermaid(data, options);
    case 'd3':
      return renderD3(data, options);
    case 'svg':
      return renderSvg(data, options);
    default:
      return renderMermaid(data, options);
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(ts: number, showTimestamps: boolean): string {
  if (!showTimestamps) return '';
  const date = new Date(ts);
  const datePart = date.toISOString().split('T')[0];
  return datePart ?? '';
}

/**
 * Visualize provenance chain
 */
export async function visualizeProvenance(
  ledger: ProvenanceLedger,
  options: Partial<VizOptions> = {}
): Promise<Result<string>> {
  const opts: VizOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const recordsResult = await ledger.query({ limit: 1000 });
    if (!recordsResult.ok) {
      return recordsResult;
    }

    const records = recordsResult.value;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const record of records) {
      const timestamp = formatTimestamp(record.data.timestamp, opts.showTimestamps === true);
      const label = opts.showTimestamps === true
        ? `${record.data.action}\n${timestamp}`
        : record.data.action;

      nodes.push({
        id: record.data.id,
        label,
        type: 'provenance',
        metadata: {
          actor: record.data.actor ?? 'unknown',
          hash: record.data.hash,
          timestamp: record.data.timestamp,
        },
      });

      if (record.data.previousHash !== undefined) {
        // Find the record with this hash
        const prevRecord = records.find((r) => r.data.hash === record.data.previousHash);
        if (prevRecord !== undefined) {
          edges.push({
            from: prevRecord.data.id,
            to: record.data.id,
            type: 'chain',
            label: 'derives',
          });
        }
      }
    }

    const graphData: GraphData = {
      nodes,
      edges,
      title: 'Provenance Chain',
    };

    return { ok: true, value: renderGraph(graphData, opts) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Visualize entity relationships
 */
export async function visualizeEntities(
  ckg: CKG,
  entityType: string,
  options: Partial<VizOptions> = {}
): Promise<Result<string>> {
  const opts: VizOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const entitiesResult = await ckg.findEntitiesByType(entityType, { limit: 100 });
    if (!entitiesResult.ok) {
      return entitiesResult;
    }

    const entities = entitiesResult.value;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const entityClaims = new Map<string, readonly Claim[]>();

    // Gather claims for each entity
    for (const entity of entities) {
      const claimsResult = await ckg.getClaimsForSubject(entity.data.id);
      if (claimsResult.ok) {
        entityClaims.set(entity.data.id, claimsResult.value);
      }
    }

    // Build nodes
    for (const entity of entities) {
      const claims = entityClaims.get(entity.data.id) ?? [];
      const label = entity.data.id.substring(0, 8);

      nodes.push({
        id: entity.data.id,
        label,
        type: 'entity',
        metadata: {
          entityType: entity.data.type,
          claimCount: claims.length,
        },
      });
    }

    // Build edges from reference claims
    for (const entity of entities) {
      const claims = entityClaims.get(entity.data.id) ?? [];

      for (const claim of claims) {
        // Check if objectId is a reference to another entity
        const objectId = claim.data.objectId;
        if (objectId !== undefined && entities.some((e) => e.data.id === objectId)) {
          edges.push({
            from: entity.data.id,
            to: objectId,
            type: 'references',
            label: claim.data.predicate,
          });
        }
      }
    }

    const graphData: GraphData = {
      nodes,
      edges,
      title: 'Entity Relationships',
    };

    return { ok: true, value: renderGraph(graphData, opts) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Visualize decision tree
 */
export async function visualizeDecisions(
  dtg: DecisionTraceGraph,
  options: Partial<VizOptions> = {}
): Promise<Result<string>> {
  const opts: VizOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const decisionsResult = await dtg.queryDecisions({ limit: 100 });
    if (!decisionsResult.ok) {
      return decisionsResult;
    }

    const decisions = decisionsResult.value;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Group by status for styling
    const statusColors: Record<string, string> = {
      proposed: '#f39c12',
      approved: '#27ae60',
      rejected: '#e74c3c',
      executed: '#2ecc71',
      failed: '#c0392b',
    };

    for (const decision of decisions) {
      const timestamp = formatTimestamp(decision.data.proposedAt, opts.showTimestamps === true);
      const label = opts.showTimestamps === true
        ? `${decision.data.type}\n${decision.data.status}\n${timestamp}`
        : `${decision.data.type}\n${decision.data.status}`;

      nodes.push({
        id: decision.data.id,
        label,
        type: 'decision',
        metadata: {
          proposedBy: decision.data.proposedBy,
          status: decision.data.status,
          color: statusColors[decision.data.status] ?? '#95a5a6',
        },
      });

      // Link via precedent refs if any
      for (const precedent of decision.data.precedentRefs) {
        edges.push({
          from: precedent.decisionId,
          to: decision.data.id,
          type: 'depends',
          label: 'precedent',
        });
      }
    }

    const graphData: GraphData = {
      nodes,
      edges,
      title: 'Decision Tree',
    };

    return { ok: true, value: renderGraph(graphData, opts) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Visualize timeline of events
 */
export function visualizeTimeline(
  events: TimelineEvent[],
  options: Partial<VizOptions> = {}
): Result<string> {
  const opts: VizOptions = { ...DEFAULT_OPTIONS, direction: 'LR', ...options };

  try {
    // Sort events by timestamp
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      if (event === undefined) continue;

      const timestamp = formatTimestamp(event.timestamp, true);
      const label = `${event.label}\n${timestamp}`;

      nodes.push({
        id: event.id,
        label,
        type: event.type,
        metadata: event.metadata ?? {},
      });

      // Link to previous event
      const prevEvent = sortedEvents[i - 1];
      if (i > 0 && prevEvent !== undefined) {
        edges.push({
          from: prevEvent.id,
          to: event.id,
          type: 'sequence',
        });
      }
    }

    const graphData: GraphData = {
      nodes,
      edges,
      title: 'Timeline',
    };

    return { ok: true, value: renderGraph(graphData, opts) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Visualize custom graph data
 */
export function visualizeGraph(
  data: GraphData,
  options: Partial<VizOptions> = {}
): Result<string> {
  const opts: VizOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    return { ok: true, value: renderGraph(data, opts) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Get supported output formats
 */
export function getSupportedFormats(): OutputFormat[] {
  return ['dot', 'mermaid', 'd3', 'svg'];
}
