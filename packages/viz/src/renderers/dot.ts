/**
 * DOT (Graphviz) Renderer
 */

import type { GraphData, VizOptions, NodeStyle, EdgeStyle } from '../types.js';

const DEFAULT_NODE_STYLE: NodeStyle = {
  shape: 'box',
  color: '#333333',
  fillColor: '#ffffff',
  borderWidth: 1,
  fontSize: 12,
};

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#666666',
  style: 'solid',
  width: 1,
  arrowHead: 'normal',
};

/**
 * Escape string for DOT format
 */
function escapeLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Get node shape for DOT
 */
function getShape(shape: NodeStyle['shape']): string {
  switch (shape) {
    case 'ellipse':
      return 'ellipse';
    case 'circle':
      return 'circle';
    case 'diamond':
      return 'diamond';
    case 'hexagon':
      return 'hexagon';
    case 'box':
    default:
      return 'box';
  }
}

/**
 * Get edge style for DOT
 */
function getEdgeStyle(style: EdgeStyle['style']): string {
  switch (style) {
    case 'dashed':
      return 'dashed';
    case 'dotted':
      return 'dotted';
    case 'solid':
    default:
      return 'solid';
  }
}

/**
 * Get arrow head for DOT
 */
function getArrowHead(arrowHead: EdgeStyle['arrowHead']): string {
  switch (arrowHead) {
    case 'none':
      return 'none';
    case 'diamond':
      return 'diamond';
    case 'dot':
      return 'dot';
    case 'normal':
    default:
      return 'normal';
  }
}

/**
 * Render graph data to DOT format
 */
export function renderDot(data: GraphData, options: VizOptions): string {
  const lines: string[] = [];
  const direction = options.direction ?? 'TB';

  // Graph header
  lines.push('digraph G {');
  lines.push(`  rankdir=${direction};`);
  lines.push('  node [fontname="Arial"];');
  lines.push('  edge [fontname="Arial"];');

  if (data.title !== undefined) {
    lines.push(`  label="${escapeLabel(data.title)}";`);
    lines.push('  labelloc="t";');
  }

  lines.push('');

  // Render nodes
  for (const node of data.nodes) {
    const customStyle = options.nodeStyles?.[node.type];
    const style: NodeStyle = { ...DEFAULT_NODE_STYLE, ...customStyle };

    const attrs: string[] = [];
    attrs.push(`label="${escapeLabel(node.label)}"`);
    attrs.push(`shape=${getShape(style.shape)}`);

    if (style.color !== undefined) {
      attrs.push(`color="${style.color}"`);
    }
    if (style.fillColor !== undefined) {
      attrs.push(`fillcolor="${style.fillColor}"`);
      attrs.push('style=filled');
    }
    if (style.borderWidth !== undefined) {
      attrs.push(`penwidth=${style.borderWidth}`);
    }
    if (style.fontSize !== undefined) {
      attrs.push(`fontsize=${style.fontSize}`);
    }

    lines.push(`  "${node.id}" [${attrs.join(', ')}];`);
  }

  lines.push('');

  // Render edges
  for (const edge of data.edges) {
    const customStyle = options.edgeStyles?.[edge.type];
    const style: EdgeStyle = { ...DEFAULT_EDGE_STYLE, ...customStyle };

    const attrs: string[] = [];

    if (edge.label !== undefined && options.showLabels !== false) {
      attrs.push(`label="${escapeLabel(edge.label)}"`);
    }
    if (style.color !== undefined) {
      attrs.push(`color="${style.color}"`);
    }
    if (style.style !== undefined) {
      attrs.push(`style=${getEdgeStyle(style.style)}`);
    }
    if (style.width !== undefined) {
      attrs.push(`penwidth=${style.width}`);
    }
    if (style.arrowHead !== undefined) {
      attrs.push(`arrowhead=${getArrowHead(style.arrowHead)}`);
    }

    const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  "${edge.from}" -> "${edge.to}"${attrStr};`);
  }

  lines.push('}');

  return lines.join('\n');
}
