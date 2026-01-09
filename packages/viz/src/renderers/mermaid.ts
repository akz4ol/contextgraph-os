/**
 * Mermaid Diagram Renderer
 */

import type { GraphData, VizOptions } from '../types.js';

/**
 * Escape string for Mermaid format
 */
function escapeLabel(label: string): string {
  return label
    .replace(/"/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\n/g, '<br/>');
}

/**
 * Get node shape syntax for Mermaid
 */
function getNodeShape(
  id: string,
  label: string,
  type: string
): string {
  const escapedLabel = escapeLabel(label);

  switch (type) {
    case 'decision':
      return `${id}{{"${escapedLabel}"}}`;
    case 'entity':
      return `${id}["${escapedLabel}"]`;
    case 'provenance':
      return `${id}(["${escapedLabel}"])`;
    case 'agent':
      return `${id}[/"${escapedLabel}"/]`;
    case 'claim':
      return `${id}>"${escapedLabel}"]`;
    default:
      return `${id}["${escapedLabel}"]`;
  }
}

/**
 * Get edge arrow style for Mermaid
 */
function getEdgeArrow(type: string): string {
  switch (type) {
    case 'derives':
      return '-.->'; // dotted
    case 'depends':
      return '==>'; // thick
    case 'references':
      return '-->';
    case 'chain':
      return '-->'; // solid
    default:
      return '-->';
  }
}

/**
 * Render graph data to Mermaid format
 */
export function renderMermaid(data: GraphData, options: VizOptions): string {
  const lines: string[] = [];
  const direction = options.direction ?? 'TB';

  // Diagram header
  lines.push(`graph ${direction}`);

  if (data.title !== undefined) {
    lines.push(`  %% ${data.title}`);
  }

  lines.push('');

  // Define subgraphs by node type if needed
  const nodesByType = new Map<string, typeof data.nodes>();
  for (const node of data.nodes) {
    const existing = nodesByType.get(node.type) ?? [];
    existing.push(node);
    nodesByType.set(node.type, existing);
  }

  // Render nodes grouped by type
  for (const [type, nodes] of nodesByType) {
    if (nodes.length > 1) {
      lines.push(`  subgraph ${type}s`);
      for (const node of nodes) {
        lines.push(`    ${getNodeShape(node.id, node.label, node.type)}`);
      }
      lines.push('  end');
    } else {
      for (const node of nodes) {
        lines.push(`  ${getNodeShape(node.id, node.label, node.type)}`);
      }
    }
  }

  lines.push('');

  // Render edges
  for (const edge of data.edges) {
    const arrow = getEdgeArrow(edge.type);
    if (edge.label !== undefined && options.showLabels !== false) {
      const escapedLabel = escapeLabel(edge.label);
      lines.push(`  ${edge.from} ${arrow}|"${escapedLabel}"| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
    }
  }

  // Add styling
  lines.push('');
  lines.push('  %% Styling');

  const colorScheme = options.colorScheme ?? 'default';
  if (colorScheme === 'dark') {
    lines.push('  classDef default fill:#2d2d2d,stroke:#666,color:#fff');
    lines.push('  classDef entity fill:#1e3a5f,stroke:#4a90d9,color:#fff');
    lines.push('  classDef decision fill:#3d1e5f,stroke:#9b59b6,color:#fff');
    lines.push('  classDef provenance fill:#1e5f3d,stroke:#27ae60,color:#fff');
  } else if (colorScheme === 'colorblind') {
    lines.push('  classDef default fill:#f0f0f0,stroke:#333');
    lines.push('  classDef entity fill:#0072B2,stroke:#005580,color:#fff');
    lines.push('  classDef decision fill:#E69F00,stroke:#b37a00,color:#000');
    lines.push('  classDef provenance fill:#009E73,stroke:#006b4f,color:#fff');
  } else {
    lines.push('  classDef default fill:#f9f9f9,stroke:#333');
    lines.push('  classDef entity fill:#e3f2fd,stroke:#1976d2');
    lines.push('  classDef decision fill:#f3e5f5,stroke:#7b1fa2');
    lines.push('  classDef provenance fill:#e8f5e9,stroke:#388e3c');
  }

  // Apply classes
  for (const [type, nodes] of nodesByType) {
    const ids = nodes.map((n) => n.id).join(',');
    lines.push(`  class ${ids} ${type}`);
  }

  return lines.join('\n');
}
