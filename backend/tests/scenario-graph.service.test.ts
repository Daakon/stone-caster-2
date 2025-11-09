/**
 * Scenario Graph Service Tests
 * Test graph management and reachability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setGraph, reachableNodes, lintGraph, type ScenarioGraph } from '../src/services/scenario-graph.service.js';
import type { GuardContext } from '../src/services/guard-eval.js';

describe('Scenario Graph Service', () => {
  const testGraph: ScenarioGraph = {
    nodes: [
      { id: 'start', label: 'Start', kind: 'scene' },
      { id: 'tavern', label: 'Tavern', kind: 'scene' },
      { id: 'private_room', label: 'Private Room', kind: 'scene' },
    ],
    edges: [
      { from: 'start', to: 'tavern' },
      {
        from: 'tavern',
        to: 'private_room',
        guard: { gte: ['rel.npc.kiera.trust', 8] },
      },
    ],
    entry_node: 'start',
  };

  it('should validate graph schema', () => {
    const invalidGraph = {
      nodes: [{ id: '', label: 'Test', kind: 'scene' }], // Empty ID
      edges: [],
    };
    
    expect(() => setGraph('test-id', invalidGraph as any)).rejects.toThrow();
  });

  it('should reject duplicate node IDs', () => {
    const duplicateGraph: ScenarioGraph = {
      nodes: [
        { id: 'node1', label: 'Node 1', kind: 'scene' },
        { id: 'node1', label: 'Node 2', kind: 'scene' },
      ],
      edges: [],
    };
    
    expect(() => setGraph('test-id', duplicateGraph)).rejects.toThrow('Duplicate node IDs');
  });

  it('should reject edges to unknown nodes', () => {
    const invalidGraph: ScenarioGraph = {
      nodes: [{ id: 'node1', label: 'Node 1', kind: 'scene' }],
      edges: [{ from: 'node1', to: 'unknown' }],
    };
    
    expect(() => setGraph('test-id', invalidGraph)).rejects.toThrow('unknown node');
  });

  it('should compute reachable nodes without guards', () => {
    const simpleGraph: ScenarioGraph = {
      nodes: [
        { id: 'a', label: 'A', kind: 'scene' },
        { id: 'b', label: 'B', kind: 'scene' },
        { id: 'c', label: 'C', kind: 'scene' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      entry_node: 'a',
    };

    const ctx: GuardContext = {};
    const reachable = reachableNodes(simpleGraph, ctx);
    expect(reachable).toEqual(['a', 'b', 'c']);
  });

  it('should respect guards when computing reachability', () => {
    const ctx: GuardContext = {
      rel: {
        npc: {
          kiera: { trust: 8 },
        },
      },
    };

    const reachable = reachableNodes(testGraph, ctx);
    expect(reachable).toContain('start');
    expect(reachable).toContain('tavern');
    expect(reachable).toContain('private_room');
  });

  it('should block unreachable nodes due to guards', () => {
    const ctx: GuardContext = {
      rel: {
        npc: {
          kiera: { trust: 5 }, // Below threshold
        },
      },
    };

    const reachable = reachableNodes(testGraph, ctx);
    expect(reachable).toContain('start');
    expect(reachable).toContain('tavern');
    expect(reachable).not.toContain('private_room');
  });

  it('should detect orphan nodes', () => {
    const graph: ScenarioGraph = {
      nodes: [
        { id: 'a', label: 'A', kind: 'scene' },
        { id: 'orphan', label: 'Orphan', kind: 'scene' },
      ],
      edges: [],
    };

    const issues = lintGraph(graph);
    const orphanIssue = issues.find(i => i.message.includes('Orphan'));
    expect(orphanIssue).toBeDefined();
    expect(orphanIssue?.severity).toBe('warning');
  });

  it('should detect high out-degree', () => {
    const graph: ScenarioGraph = {
      nodes: [
        { id: 'center', label: 'Center', kind: 'scene' },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`,
          kind: 'scene' as const,
        })),
      ],
      edges: Array.from({ length: 10 }, (_, i) => ({
        from: 'center',
        to: `node${i}`,
      })),
    };

    const issues = lintGraph(graph);
    const highDegreeIssue = issues.find(i => i.message.includes('High out-degree'));
    expect(highDegreeIssue).toBeDefined();
    expect(highDegreeIssue?.severity).toBe('warning');
  });

  it('should detect cycles', () => {
    const graph: ScenarioGraph = {
      nodes: [
        { id: 'a', label: 'A', kind: 'scene' },
        { id: 'b', label: 'B', kind: 'scene' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };

    const issues = lintGraph(graph);
    const cycleIssue = issues.find(i => i.message.includes('Cycle'));
    expect(cycleIssue).toBeDefined();
    expect(cycleIssue?.severity).toBe('warning');
  });
});

