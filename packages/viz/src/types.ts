/**
 * Visualization Types
 */

import type { EntityId, ProvenanceId, DecisionId } from '@contextgraph/core';

/**
 * Supported output formats
 */
export type OutputFormat = 'dot' | 'mermaid' | 'd3' | 'svg';

/**
 * Visualization options
 */
export interface VizOptions {
  /** Output format */
  format: OutputFormat;
  /** Include node labels */
  showLabels?: boolean;
  /** Include timestamps */
  showTimestamps?: boolean;
  /** Maximum depth for hierarchical views */
  maxDepth?: number;
  /** Color scheme */
  colorScheme?: 'default' | 'dark' | 'light' | 'colorblind';
  /** Direction for graph layout */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Custom node styles */
  nodeStyles?: Record<string, NodeStyle>;
  /** Custom edge styles */
  edgeStyles?: Record<string, EdgeStyle>;
}

/**
 * Node style options
 */
export interface NodeStyle {
  shape?: 'box' | 'ellipse' | 'circle' | 'diamond' | 'hexagon';
  color?: string;
  fillColor?: string;
  borderWidth?: number;
  fontSize?: number;
}

/**
 * Edge style options
 */
export interface EdgeStyle {
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  width?: number;
  arrowHead?: 'normal' | 'none' | 'diamond' | 'dot';
}

/**
 * Graph node representation
 */
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

/**
 * Graph edge representation
 */
export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  type: string;
  metadata?: Record<string, unknown>;
}

/**
 * Graph data structure for rendering
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  title?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provenance chain node
 */
export interface ProvenanceNode {
  id: ProvenanceId;
  actor: string;
  action: string;
  timestamp: number;
  hash: string;
  previousHash: string | null;
}

/**
 * Entity relationship node
 */
export interface EntityNode {
  id: EntityId;
  type: string;
  name?: string;
  claims: number;
}

/**
 * Decision tree node
 */
export interface DecisionNode {
  id: DecisionId;
  agentId: string;
  action: string;
  status: string;
  proposedAt: number;
  resolvedAt?: number;
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  id: string;
  type: 'entity' | 'claim' | 'decision' | 'provenance';
  timestamp: number;
  label: string;
  metadata?: Record<string, unknown>;
}
