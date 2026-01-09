/**
 * Visualization Tests
 */

import { describe, it, expect } from 'vitest';
import {
  renderDot,
  renderMermaid,
  renderD3,
  renderD3Config,
  renderSvg,
  visualizeGraph,
  visualizeTimeline,
  getSupportedFormats,
} from '../index.js';
import type { GraphData, VizOptions, TimelineEvent } from '../types.js';

describe('Renderers', () => {
  const sampleGraph: GraphData = {
    nodes: [
      { id: 'n1', label: 'Entity A', type: 'entity' },
      { id: 'n2', label: 'Entity B', type: 'entity' },
      { id: 'n3', label: 'Decision X', type: 'decision' },
    ],
    edges: [
      { from: 'n1', to: 'n2', type: 'references', label: 'relates to' },
      { from: 'n2', to: 'n3', type: 'depends', label: 'triggers' },
    ],
    title: 'Test Graph',
  };

  describe('DOT Renderer', () => {
    it('should render graph to DOT format', () => {
      const options: VizOptions = { format: 'dot', showLabels: true };
      const result = renderDot(sampleGraph, options);

      expect(result).toContain('digraph G {');
      expect(result).toContain('rankdir=TB');
      expect(result).toContain('label="Test Graph"');
      expect(result).toContain('"n1"');
      expect(result).toContain('"n2"');
      expect(result).toContain('"n1" -> "n2"');
    });

    it('should apply custom node styles', () => {
      const options: VizOptions = {
        format: 'dot',
        nodeStyles: {
          entity: { shape: 'ellipse', fillColor: '#ff0000' },
        },
      };
      const result = renderDot(sampleGraph, options);

      expect(result).toContain('shape=ellipse');
      expect(result).toContain('fillcolor="#ff0000"');
    });

    it('should apply custom edge styles', () => {
      const options: VizOptions = {
        format: 'dot',
        edgeStyles: {
          references: { style: 'dashed', color: '#00ff00' },
        },
      };
      const result = renderDot(sampleGraph, options);

      expect(result).toContain('style=dashed');
      expect(result).toContain('color="#00ff00"');
    });

    it('should respect direction option', () => {
      const options: VizOptions = { format: 'dot', direction: 'LR' };
      const result = renderDot(sampleGraph, options);

      expect(result).toContain('rankdir=LR');
    });
  });

  describe('Mermaid Renderer', () => {
    it('should render graph to Mermaid format', () => {
      const options: VizOptions = { format: 'mermaid', showLabels: true };
      const result = renderMermaid(sampleGraph, options);

      expect(result).toContain('graph TB');
      expect(result).toContain('%% Test Graph');
      expect(result).toContain('n1');
      expect(result).toContain('n2');
    });

    it('should apply color scheme', () => {
      const options: VizOptions = { format: 'mermaid', colorScheme: 'dark' };
      const result = renderMermaid(sampleGraph, options);

      expect(result).toContain('classDef entity fill:#1e3a5f');
    });

    it('should apply colorblind scheme', () => {
      const options: VizOptions = { format: 'mermaid', colorScheme: 'colorblind' };
      const result = renderMermaid(sampleGraph, options);

      expect(result).toContain('classDef entity fill:#0072B2');
    });

    it('should use correct shapes for node types', () => {
      const graphWithTypes: GraphData = {
        nodes: [
          { id: 'd1', label: 'Decision', type: 'decision' },
          { id: 'p1', label: 'Provenance', type: 'provenance' },
          { id: 'a1', label: 'Agent', type: 'agent' },
        ],
        edges: [],
      };
      const options: VizOptions = { format: 'mermaid' };
      const result = renderMermaid(graphWithTypes, options);

      // Decision uses double braces
      expect(result).toContain('d1{{"Decision"}}');
      // Provenance uses stadium shape
      expect(result).toContain('p1(["Provenance"])');
      // Agent uses trapezoid
      expect(result).toContain('a1[/"Agent"/]');
    });
  });

  describe('D3 Renderer', () => {
    it('should render graph to D3 JSON format', () => {
      const options: VizOptions = { format: 'd3' };
      const result = renderD3(sampleGraph, options);
      const parsed = JSON.parse(result);

      expect(parsed.nodes).toHaveLength(3);
      expect(parsed.links).toHaveLength(2);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.title).toBe('Test Graph');
    });

    it('should include node groups', () => {
      const options: VizOptions = { format: 'd3' };
      const result = renderD3(sampleGraph, options);
      const parsed = JSON.parse(result);

      expect(parsed.metadata.groups).toContain('entity');
      expect(parsed.metadata.groups).toContain('decision');
    });

    it('should apply color scheme to node metadata', () => {
      const options: VizOptions = { format: 'd3', colorScheme: 'dark' };
      const result = renderD3(sampleGraph, options);
      const parsed = JSON.parse(result);

      const entityNode = parsed.nodes.find((n: { group: string }) => n.group === 'entity');
      expect(entityNode.metadata.color).toBe('#2980b9');
    });

    it('should generate D3 config', () => {
      const options: VizOptions = { format: 'd3', showLabels: true, direction: 'LR' };
      const result = renderD3Config(options);
      const parsed = JSON.parse(result);

      expect(parsed.simulation).toBeDefined();
      expect(parsed.forces).toBeDefined();
      expect(parsed.rendering.showLabels).toBe(true);
      expect(parsed.layout.direction).toBe('LR');
    });
  });

  describe('SVG Renderer', () => {
    it('should render graph to SVG format', () => {
      const options: VizOptions = { format: 'svg' };
      const result = renderSvg(sampleGraph, options);

      expect(result).toContain('<?xml version="1.0"');
      expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain('</svg>');
    });

    it('should include title', () => {
      const options: VizOptions = { format: 'svg' };
      const result = renderSvg(sampleGraph, options);

      expect(result).toContain('Test Graph');
    });

    it('should render nodes as circles', () => {
      const options: VizOptions = { format: 'svg' };
      const result = renderSvg(sampleGraph, options);

      expect(result).toContain('<circle');
      expect(result).toContain('r="30"');
    });

    it('should render edges with arrows', () => {
      const options: VizOptions = { format: 'svg' };
      const result = renderSvg(sampleGraph, options);

      expect(result).toContain('<line');
      expect(result).toContain('marker-end="url(#arrowhead)"');
    });

    it('should apply color scheme', () => {
      const options: VizOptions = { format: 'svg', colorScheme: 'dark' };
      const result = renderSvg(sampleGraph, options);

      expect(result).toContain('fill="#1a1a2e"'); // dark background
    });

    it('should hide labels when showLabels is false', () => {
      const options: VizOptions = { format: 'svg', showLabels: false };
      const result = renderSvg(sampleGraph, options);

      // Should not contain node label text elements
      expect(result).not.toContain('>Entity A<');
    });
  });
});

describe('Visualizer', () => {
  describe('visualizeGraph', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'a', label: 'Node A', type: 'entity' },
        { id: 'b', label: 'Node B', type: 'entity' },
      ],
      edges: [{ from: 'a', to: 'b', type: 'link' }],
    };

    it('should render to mermaid by default', () => {
      const result = visualizeGraph(graph);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('graph TB');
      }
    });

    it('should render to DOT format', () => {
      const result = visualizeGraph(graph, { format: 'dot' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('digraph G');
      }
    });

    it('should render to D3 format', () => {
      const result = visualizeGraph(graph, { format: 'd3' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const parsed = JSON.parse(result.value);
        expect(parsed.nodes).toBeDefined();
        expect(parsed.links).toBeDefined();
      }
    });

    it('should render to SVG format', () => {
      const result = visualizeGraph(graph, { format: 'svg' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('<svg');
      }
    });
  });

  describe('visualizeTimeline', () => {
    const events: TimelineEvent[] = [
      { id: 'e1', type: 'entity', timestamp: 1000, label: 'Created Entity' },
      { id: 'e2', type: 'claim', timestamp: 2000, label: 'Added Claim' },
      { id: 'e3', type: 'decision', timestamp: 3000, label: 'Made Decision' },
    ];

    it('should render timeline with LR direction by default', () => {
      const result = visualizeTimeline(events);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('LR');
      }
    });

    it('should sort events by timestamp', () => {
      const unsorted: TimelineEvent[] = [
        { id: 'e3', type: 'entity', timestamp: 3000, label: 'Third' },
        { id: 'e1', type: 'entity', timestamp: 1000, label: 'First' },
        { id: 'e2', type: 'entity', timestamp: 2000, label: 'Second' },
      ];

      const result = visualizeTimeline(unsorted);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // First should appear before Second in the output
        const firstIdx = result.value.indexOf('First');
        const secondIdx = result.value.indexOf('Second');
        expect(firstIdx).toBeLessThan(secondIdx);
      }
    });

    it('should include timestamps in labels', () => {
      const result = visualizeTimeline(events);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('1970-01-01');
      }
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = getSupportedFormats();

      expect(formats).toContain('dot');
      expect(formats).toContain('mermaid');
      expect(formats).toContain('d3');
      expect(formats).toContain('svg');
      expect(formats).toHaveLength(4);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty graph', () => {
    const emptyGraph: GraphData = { nodes: [], edges: [] };

    const dotResult = renderDot(emptyGraph, { format: 'dot' });
    expect(dotResult).toContain('digraph G');

    const mermaidResult = renderMermaid(emptyGraph, { format: 'mermaid' });
    expect(mermaidResult).toContain('graph TB');

    const d3Result = renderD3(emptyGraph, { format: 'd3' });
    const parsed = JSON.parse(d3Result);
    expect(parsed.nodes).toHaveLength(0);

    const svgResult = renderSvg(emptyGraph, { format: 'svg' });
    expect(svgResult).toContain('<svg');
  });

  it('should escape special characters in labels', () => {
    const graphWithSpecialChars: GraphData = {
      nodes: [
        { id: 'n1', label: 'Entity "A" & B', type: 'entity' },
        { id: 'n2', label: 'Node <script>', type: 'entity' },
      ],
      edges: [{ from: 'n1', to: 'n2', type: 'link', label: 'edge "label"' }],
    };

    const dotResult = renderDot(graphWithSpecialChars, { format: 'dot' });
    expect(dotResult).toContain('\\"A\\"'); // Escaped quotes

    const svgResult = renderSvg(graphWithSpecialChars, { format: 'svg' });
    expect(svgResult).toContain('&lt;script&gt;'); // Escaped XML
    expect(svgResult).toContain('&amp;'); // Escaped ampersand
  });

  it('should handle single node graph', () => {
    const singleNode: GraphData = {
      nodes: [{ id: 'only', label: 'Only Node', type: 'entity' }],
      edges: [],
    };

    const result = visualizeGraph(singleNode);
    expect(result.ok).toBe(true);
  });

  it('should handle disconnected nodes', () => {
    const disconnected: GraphData = {
      nodes: [
        { id: 'a', label: 'A', type: 'entity' },
        { id: 'b', label: 'B', type: 'entity' },
        { id: 'c', label: 'C', type: 'entity' },
      ],
      edges: [{ from: 'a', to: 'b', type: 'link' }],
      // c is disconnected
    };

    const svgResult = renderSvg(disconnected, { format: 'svg' });
    // All three nodes should be rendered
    expect(svgResult).toContain('A');
    expect(svgResult).toContain('B');
    expect(svgResult).toContain('C');
  });

  it('should handle long labels', () => {
    const longLabel: GraphData = {
      nodes: [
        {
          id: 'n1',
          label: 'This is a very long label that should be truncated in SVG output',
          type: 'entity',
        },
      ],
      edges: [],
    };

    const svgResult = renderSvg(longLabel, { format: 'svg' });
    expect(svgResult).toContain('...');
  });
});
