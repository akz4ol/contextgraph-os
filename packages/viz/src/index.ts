/**
 * @contextgraph/viz
 *
 * Visualization renderers for ContextGraph OS.
 * Supports DOT, Mermaid, D3.js, and SVG output formats.
 */

export type {
  OutputFormat,
  VizOptions,
  NodeStyle,
  EdgeStyle,
  GraphData,
  GraphNode,
  GraphEdge,
  ProvenanceNode,
  EntityNode,
  DecisionNode,
  TimelineEvent,
} from './types.js';

export {
  renderDot,
  renderMermaid,
  renderD3,
  renderD3Config,
  renderSvg,
  type D3Node,
  type D3Link,
  type D3GraphData,
} from './renderers/index.js';

export {
  visualizeProvenance,
  visualizeEntities,
  visualizeDecisions,
  visualizeTimeline,
  visualizeGraph,
  getSupportedFormats,
} from './visualizer.js';
