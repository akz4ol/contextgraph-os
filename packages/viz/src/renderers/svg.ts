/**
 * SVG Renderer
 *
 * Generates standalone SVG for provenance chains and simple graphs
 */

import type { GraphData, VizOptions } from '../types.js';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const NODE_RADIUS = 30;
const NODE_SPACING_X = 150;
const NODE_SPACING_Y = 100;
const MARGIN = 50;

/**
 * Color schemes
 */
const COLOR_SCHEMES: Record<string, Record<string, string>> = {
  default: {
    background: '#ffffff',
    entity: '#4a90d9',
    decision: '#9b59b6',
    provenance: '#27ae60',
    agent: '#e67e22',
    claim: '#3498db',
    text: '#333333',
    edge: '#666666',
  },
  dark: {
    background: '#1a1a2e',
    entity: '#4a90d9',
    decision: '#9b59b6',
    provenance: '#27ae60',
    agent: '#e67e22',
    claim: '#3498db',
    text: '#ffffff',
    edge: '#888888',
  },
  light: {
    background: '#f8f9fa',
    entity: '#85c1e9',
    decision: '#d7bde2',
    provenance: '#82e0aa',
    agent: '#f8c471',
    claim: '#aed6f1',
    text: '#333333',
    edge: '#999999',
  },
  colorblind: {
    background: '#ffffff',
    entity: '#0072B2',
    decision: '#E69F00',
    provenance: '#009E73',
    agent: '#CC79A7',
    claim: '#56B4E9',
    text: '#333333',
    edge: '#666666',
  },
};

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate label for display
 */
function truncateLabel(label: string, maxLen: number = 20): string {
  if (label.length <= maxLen) return label;
  return label.substring(0, maxLen - 3) + '...';
}

/**
 * Calculate layout positions for nodes
 */
function calculateLayout(
  nodes: GraphData['nodes'],
  edges: GraphData['edges'],
  direction: VizOptions['direction']
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Build adjacency list
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const edge of edges) {
    const c = children.get(edge.from) ?? [];
    c.push(edge.to);
    children.set(edge.from, c);

    const p = parents.get(edge.to) ?? [];
    p.push(edge.from);
    parents.set(edge.to, p);
  }

  // Find root nodes (no parents)
  const roots = nodes.filter((n) => !parents.has(n.id) || parents.get(n.id)!.length === 0);

  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue: Array<{ id: string; level: number }> = roots.map((r) => ({ id: r.id, level: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const existingLevel = levels.get(current.id);
    if (existingLevel === undefined || current.level > existingLevel) {
      levels.set(current.id, current.level);
    }

    const nodeChildren = children.get(current.id) ?? [];
    for (const childId of nodeChildren) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: current.level + 1 });
      }
    }
  }

  // Handle disconnected nodes
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    const existing = nodesByLevel.get(level) ?? [];
    existing.push(id);
    nodesByLevel.set(level, existing);
  }

  // Calculate positions
  const maxLevel = Math.max(...levels.values(), 0);
  const isHorizontal = direction === 'LR' || direction === 'RL';
  const isReversed = direction === 'BT' || direction === 'RL';

  for (const [level, nodeIds] of nodesByLevel) {
    const adjustedLevel = isReversed ? maxLevel - level : level;

    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      if (nodeId === undefined) continue;
      const offset = (i - (nodeIds.length - 1) / 2) * (isHorizontal ? NODE_SPACING_Y : NODE_SPACING_X);

      if (isHorizontal) {
        positions.set(nodeId, {
          x: MARGIN + adjustedLevel * NODE_SPACING_X + NODE_RADIUS,
          y: DEFAULT_HEIGHT / 2 + offset,
        });
      } else {
        positions.set(nodeId, {
          x: DEFAULT_WIDTH / 2 + offset,
          y: MARGIN + adjustedLevel * NODE_SPACING_Y + NODE_RADIUS,
        });
      }
    }
  }

  return positions;
}

/**
 * Render graph data to SVG format
 */
export function renderSvg(data: GraphData, options: VizOptions): string {
  const colors = COLOR_SCHEMES[options.colorScheme ?? 'default'] ?? COLOR_SCHEMES['default']!;
  const positions = calculateLayout(data.nodes, data.edges, options.direction);

  // Calculate bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  const width = Math.max(DEFAULT_WIDTH, maxX + MARGIN * 2);
  const height = Math.max(DEFAULT_HEIGHT, maxY + MARGIN * 2);

  const lines: string[] = [];

  // SVG header
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

  // Defs for markers
  lines.push('  <defs>');
  lines.push(`    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">`);
  lines.push(`      <polygon points="0 0, 10 3.5, 0 7" fill="${colors['edge'] ?? '#666666'}" />`);
  lines.push('    </marker>');
  lines.push('  </defs>');

  // Background
  lines.push(`  <rect width="100%" height="100%" fill="${colors['background'] ?? '#ffffff'}" />`);

  // Title
  if (data.title !== undefined) {
    lines.push(`  <text x="${width / 2}" y="25" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="${colors['text'] ?? '#333333'}">${escapeXml(data.title)}</text>`);
  }

  // Render edges first (behind nodes)
  lines.push('  <g id="edges">');
  for (const edge of data.edges) {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (fromPos === undefined || toPos === undefined) continue;

    // Calculate line endpoints adjusted for node radius
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    const startX = fromPos.x + (dx / dist) * NODE_RADIUS;
    const startY = fromPos.y + (dy / dist) * NODE_RADIUS;
    const endX = toPos.x - (dx / dist) * (NODE_RADIUS + 10);
    const endY = toPos.y - (dy / dist) * (NODE_RADIUS + 10);

    const edgeStyle = options.edgeStyles?.[edge.type];
    const strokeDasharray = edgeStyle?.style === 'dashed' ? 'stroke-dasharray="5,5"' :
                           edgeStyle?.style === 'dotted' ? 'stroke-dasharray="2,2"' : '';

    lines.push(`    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${edgeStyle?.color ?? colors['edge'] ?? '#666666'}" stroke-width="${edgeStyle?.width ?? 2}" marker-end="url(#arrowhead)" ${strokeDasharray} />`);

    // Edge label
    if (edge.label !== undefined && options.showLabels !== false) {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      lines.push(`    <text x="${midX}" y="${midY - 5}" text-anchor="middle" font-family="Arial" font-size="10" fill="${colors['text'] ?? '#333333'}">${escapeXml(edge.label)}</text>`);
    }
  }
  lines.push('  </g>');

  // Render nodes
  lines.push('  <g id="nodes">');
  for (const node of data.nodes) {
    const pos = positions.get(node.id);
    if (pos === undefined) continue;

    const nodeStyle = options.nodeStyles?.[node.type];
    const fillColor = nodeStyle?.fillColor ?? colors[node.type] ?? colors['entity'] ?? '#4a90d9';
    const strokeColor = nodeStyle?.color ?? '#333333';

    // Node circle
    lines.push(`    <circle cx="${pos.x}" cy="${pos.y}" r="${NODE_RADIUS}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />`);

    // Node label
    if (options.showLabels !== false) {
      const label = truncateLabel(node.label);
      lines.push(`    <text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" font-family="Arial" font-size="11" fill="${colors['text'] ?? '#333333'}">${escapeXml(label)}</text>`);
    }
  }
  lines.push('  </g>');

  lines.push('</svg>');

  return lines.join('\n');
}
