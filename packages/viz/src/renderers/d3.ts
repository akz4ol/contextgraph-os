/**
 * D3.js JSON Format Renderer
 *
 * Outputs JSON format compatible with D3.js force-directed graphs
 */

import type { GraphData, VizOptions } from '../types.js';

/**
 * D3 node representation
 */
export interface D3Node {
  id: string;
  label: string;
  group: string;
  metadata?: Record<string, unknown>;
  // D3 position hints (optional)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * D3 link representation
 */
export interface D3Link {
  source: string;
  target: string;
  label?: string;
  type: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * D3 graph data structure
 */
export interface D3GraphData {
  nodes: D3Node[];
  links: D3Link[];
  metadata?: {
    title?: string;
    nodeCount: number;
    linkCount: number;
    groups: string[];
    [key: string]: unknown;
  };
}

/**
 * Color palette for node groups
 */
function getGroupColor(group: string, colorScheme: VizOptions['colorScheme']): string {
  const palettes: Record<string, Record<string, string>> = {
    default: {
      entity: '#4a90d9',
      decision: '#9b59b6',
      provenance: '#27ae60',
      agent: '#e67e22',
      claim: '#3498db',
      default: '#95a5a6',
    },
    dark: {
      entity: '#2980b9',
      decision: '#8e44ad',
      provenance: '#1abc9c',
      agent: '#d35400',
      claim: '#2c3e50',
      default: '#7f8c8d',
    },
    light: {
      entity: '#85c1e9',
      decision: '#d7bde2',
      provenance: '#82e0aa',
      agent: '#f8c471',
      claim: '#aed6f1',
      default: '#d5d8dc',
    },
    colorblind: {
      entity: '#0072B2',
      decision: '#E69F00',
      provenance: '#009E73',
      agent: '#CC79A7',
      claim: '#56B4E9',
      default: '#999999',
    },
  };

  const palette = palettes[colorScheme ?? 'default'] ?? palettes['default']!;
  return palette[group] ?? palette['default'] ?? '#95a5a6';
}

/**
 * Render graph data to D3.js JSON format
 */
export function renderD3(data: GraphData, options: VizOptions): string {
  const groups = new Set<string>();

  // Build nodes
  const nodes: D3Node[] = data.nodes.map((node) => {
    groups.add(node.type);
    return {
      id: node.id,
      label: node.label,
      group: node.type,
      metadata: {
        ...node.metadata,
        color: getGroupColor(node.type, options.colorScheme),
      },
    };
  });

  // Build links
  const links: D3Link[] = data.edges.map((edge) => {
    const link: D3Link = {
      source: edge.from,
      target: edge.to,
      type: edge.type,
      value: 1,
    };
    if (edge.label !== undefined) link.label = edge.label;
    if (edge.metadata !== undefined) link.metadata = edge.metadata;
    return link;
  });

  const d3Data: D3GraphData = {
    nodes,
    links,
    metadata: {
      nodeCount: nodes.length,
      linkCount: links.length,
      groups: Array.from(groups),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...data.metadata,
    },
  };

  return JSON.stringify(d3Data, null, 2);
}

/**
 * Render D3 force simulation configuration
 */
export function renderD3Config(options: VizOptions): string {
  const config = {
    simulation: {
      alphaDecay: 0.02,
      alphaMin: 0.001,
      velocityDecay: 0.4,
    },
    forces: {
      center: { x: 0.5, y: 0.5 },
      charge: { strength: -300, distanceMax: 500 },
      link: { distance: 100, strength: 0.5 },
      collision: { radius: 30, strength: 0.7 },
    },
    rendering: {
      nodeRadius: 20,
      linkWidth: 2,
      fontSize: 12,
      showLabels: options.showLabels ?? true,
      colorScheme: options.colorScheme ?? 'default',
    },
    layout: {
      direction: options.direction ?? 'TB',
      maxIterations: 300,
    },
  };

  return JSON.stringify(config, null, 2);
}
