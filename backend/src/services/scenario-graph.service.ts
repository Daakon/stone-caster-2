/**
 * Scenario Graph Service
 * Manages scenario graphs and reachability computation
 */

import { supabaseAdmin } from './supabase.js';
import { validateScenarioGraph } from '../validators/guard-dsl.schema.js';
import { evalGuard, type GuardContext } from './guard-eval.js';
import type { ScenarioGraph, ScenarioEdge } from '../types/guard-dsl.js';

/**
 * Get scenario graph
 */
export async function getGraph(scenarioId: string): Promise<ScenarioGraph | null> {
  const { data, error } = await supabaseAdmin
    .from('scenarios')
    .select('scene_graph, entry_node')
    .eq('id', scenarioId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get scenario graph: ${error.message}`);
  }

  const graph = (data.scene_graph || {}) as ScenarioGraph;
  if (data.entry_node) {
    graph.entry_node = data.entry_node;
  }

  return graph;
}

/**
 * Set scenario graph with validation
 */
export async function setGraph(
  scenarioId: string,
  graph: ScenarioGraph
): Promise<ScenarioGraph> {
  // Validate schema
  const validation = validateScenarioGraph(graph);
  if (!validation.ok) {
    throw new Error(`Invalid graph schema: ${validation.error?.message || 'Unknown error'}`);
  }

  // Validate referential integrity
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const entryNode = graph.entry_node || graph.nodes[0]?.id;

  // Check for duplicate node IDs
  if (nodeIds.size !== graph.nodes.length) {
    throw new Error('Duplicate node IDs found');
  }

  // Check all edges reference existing nodes
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      throw new Error(`Edge references unknown node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      throw new Error(`Edge references unknown node: ${edge.to}`);
    }
  }

  // Validate entry_node if specified
  if (entryNode && !nodeIds.has(entryNode)) {
    throw new Error(`Entry node not found: ${entryNode}`);
  }

  // Guard size check (4 KB limit)
  const graphJson = JSON.stringify(graph);
  if (graphJson.length > 4096) {
    throw new Error('Graph exceeds 4 KB limit');
  }

  // Update database
  const { data, error } = await supabaseAdmin
    .from('scenarios')
    .update({
      scene_graph: graph,
      entry_node: entryNode || null,
    })
    .eq('id', scenarioId)
    .select('scene_graph, entry_node')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Scenario not found');
    }
    throw new Error(`Failed to update scenario graph: ${error.message}`);
  }

  const result = (data.scene_graph || {}) as ScenarioGraph;
  if (data.entry_node) {
    result.entry_node = data.entry_node;
  }

  return result;
}

/**
 * Compute reachable nodes from a graph given a state context
 */
export function reachableNodes(
  graph: ScenarioGraph,
  ctx: GuardContext
): string[] {
  if (!graph.nodes || graph.nodes.length === 0) {
    return [];
  }

  const entryNode = graph.entry_node || graph.nodes[0]?.id;
  if (!entryNode) {
    return [];
  }

  const reachable = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [entryNode];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    reachable.add(nodeId);

    // Find all edges from this node
    const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);

    for (const edge of outgoingEdges) {
      // Evaluate guard if present
      if (edge.guard) {
        try {
          const canTraverse = evalGuard(edge.guard, ctx);
          if (!canTraverse) {
            continue;
          }
        } catch (error) {
          console.warn(`[scenario-graph] Guard evaluation failed for edge ${edge.from} -> ${edge.to}:`, error);
          continue;
        }
      }

      // Add target node to queue if not visited
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return Array.from(reachable);
}

/**
 * Lint graph for common issues
 */
export interface GraphLintIssue {
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeIndex?: number;
}

export function lintGraph(graph: ScenarioGraph): GraphLintIssue[] {
  const issues: GraphLintIssue[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodeInDegree = new Map<string, number>();
  const nodeOutDegree = new Map<string, number>();

  // Initialize degree maps
  for (const node of graph.nodes) {
    nodeInDegree.set(node.id, 0);
    nodeOutDegree.set(node.id, 0);
  }

  // Check edges and compute degrees
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i];

    if (!nodeIds.has(edge.from)) {
      issues.push({
        severity: 'error',
        message: `Edge ${i} references unknown source node: ${edge.from}`,
        edgeIndex: i,
      });
    }

    if (!nodeIds.has(edge.to)) {
      issues.push({
        severity: 'error',
        message: `Edge ${i} references unknown target node: ${edge.to}`,
        edgeIndex: i,
      });
    }

    nodeOutDegree.set(edge.from, (nodeOutDegree.get(edge.from) || 0) + 1);
    nodeInDegree.set(edge.to, (nodeInDegree.get(edge.to) || 0) + 1);
  }

  // Check for orphan nodes
  for (const node of graph.nodes) {
    const inDeg = nodeInDegree.get(node.id) || 0;
    const outDeg = nodeOutDegree.get(node.id) || 0;

    if (inDeg === 0 && outDeg === 0) {
      issues.push({
        severity: 'warning',
        message: `Orphan node: ${node.id} has no incoming or outgoing edges`,
        nodeId: node.id,
      });
    }
  }

  // Check for high out-degree
  for (const node of graph.nodes) {
    const outDeg = nodeOutDegree.get(node.id) || 0;
    if (outDeg > 8) {
      issues.push({
        severity: 'warning',
        message: `High out-degree (${outDeg}): ${node.id} has many outgoing edges`,
        nodeId: node.id,
      });
    }
  }

  // Check for cycles (simple DFS)
  const cycleNodes = detectCycles(graph);
  if (cycleNodes.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Cycle detected involving nodes: ${cycleNodes.join(', ')}`,
    });
  }

  return issues;
}

/**
 * Detect cycles in graph (returns node IDs involved in cycles)
 */
function detectCycles(graph: ScenarioGraph): string[] {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycleNodes = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    if (recStack.has(nodeId)) {
      cycleNodes.add(nodeId);
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);
    for (const edge of outgoingEdges) {
      if (dfs(edge.to)) {
        cycleNodes.add(nodeId);
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return Array.from(cycleNodes);
}

