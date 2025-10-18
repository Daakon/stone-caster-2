/**
 * Quest Graphs Repository
 * Manages quest graph storage, validation, and retrieval
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { QuestGraph, GraphNode, GraphEdge } from '../graph/quest-graph-engine.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod schemas for validation
const GraphNodeSchema = z.object({
  id: z.string().min(1).max(50),
  type: z.enum(['beat', 'objective', 'gate', 'setpiece']),
  synopsis: z.string().min(1).max(160),
  enterIf: z.array(z.object({
    flag: z.string().optional(),
    objective: z.string().optional(),
    resource: z.string().optional(),
    op: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']),
    val: z.any(),
  })).optional(),
  onSuccess: z.array(z.object({
    act: z.string(),
    id: z.string().optional(),
    key: z.string().optional(),
    val: z.any().optional(),
    status: z.string().optional(),
  })).optional(),
  onFail: z.array(z.object({
    act: z.string(),
    id: z.string().optional(),
    key: z.string().optional(),
    val: z.any().optional(),
    status: z.string().optional(),
  })).optional(),
  hint: z.string().max(120).optional(),
});

const GraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  guard: z.array(z.object({
    objective: z.string().optional(),
    flag: z.string().optional(),
    resource: z.string().optional(),
    op: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']),
    val: z.any(),
  })).optional(),
});

const QuestGraphSchema = z.object({
  graphId: z.string().min(1).max(100),
  start: z.string().min(1),
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema).optional(),
});

export interface QuestGraphRecord {
  id: string;
  adventureRef: string;
  version: string;
  doc: QuestGraph;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export class QuestGraphsRepo {
  /**
   * Create a new quest graph
   */
  async createGraph(
    adventureRef: string,
    version: string,
    graph: QuestGraph
  ): Promise<QuestGraphRecord> {
    // Validate graph
    const validatedGraph = QuestGraphSchema.parse(graph);
    
    // Compute hash
    const hash = this.computeHash(validatedGraph);
    
    // Insert graph
    const { data, error } = await supabase
      .from('quest_graphs')
      .insert({
        adventure_ref: adventureRef,
        version,
        doc: validatedGraph,
        hash,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create quest graph: ${error.message}`);
    }

    // Create indexes
    await this.createIndexes(data.id, validatedGraph);

    return this.mapRecordToQuestGraph(data);
  }

  /**
   * Get quest graph by adventure reference
   */
  async getGraph(adventureRef: string, version?: string): Promise<QuestGraphRecord | null> {
    let query = supabase
      .from('quest_graphs')
      .select('*')
      .eq('adventure_ref', adventureRef);

    if (version) {
      query = query.eq('version', version);
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get quest graph: ${error.message}`);
    }

    return this.mapRecordToQuestGraph(data);
  }

  /**
   * Update quest graph
   */
  async updateGraph(
    id: string,
    graph: QuestGraph
  ): Promise<QuestGraphRecord> {
    // Validate graph
    const validatedGraph = QuestGraphSchema.parse(graph);
    
    // Compute hash
    const hash = this.computeHash(validatedGraph);
    
    // Update graph
    const { data, error } = await supabase
      .from('quest_graphs')
      .update({
        doc: validatedGraph,
        hash,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update quest graph: ${error.message}`);
    }

    // Update indexes
    await this.updateIndexes(id, validatedGraph);

    return this.mapRecordToQuestGraph(data);
  }

  /**
   * Delete quest graph
   */
  async deleteGraph(id: string): Promise<void> {
    const { error } = await supabase
      .from('quest_graphs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete quest graph: ${error.message}`);
    }
  }

  /**
   * List quest graphs
   */
  async listGraphs(adventureRef?: string): Promise<QuestGraphRecord[]> {
    let query = supabase
      .from('quest_graphs')
      .select('*')
      .order('created_at', { ascending: false });

    if (adventureRef) {
      query = query.eq('adventure_ref', adventureRef);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list quest graphs: ${error.message}`);
    }

    return data.map(record => this.mapRecordToQuestGraph(record));
  }

  /**
   * Validate graph structure
   */
  validateGraph(graph: QuestGraph): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate against schema
      QuestGraphSchema.parse(graph);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      }
    }

    // Check for cycles
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      errors.push(`Cycles detected: ${cycles.join(', ')}`);
    }

    // Check reachability
    const unreachableNodes = this.findUnreachableNodes(graph);
    if (unreachableNodes.length > 0) {
      warnings.push(`Unreachable nodes: ${unreachableNodes.join(', ')}`);
    }

    // Check for missing objectives
    const missingObjectives = this.findMissingObjectives(graph);
    if (missingObjectives.length > 0) {
      warnings.push(`Missing objectives: ${missingObjectives.join(', ')}`);
    }

    // Check text length limits
    const textViolations = this.checkTextLimits(graph);
    if (textViolations.length > 0) {
      errors.push(`Text length violations: ${textViolations.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create indexes for graph
   */
  private async createIndexes(graphId: string, graph: QuestGraph): Promise<void> {
    const indexes = [];

    for (const node of graph.nodes) {
      indexes.push({
        graph_id: graphId,
        node_id: node.id,
        deps: this.getNodeDependencies(node, graph),
        type: node.type,
        synopsis: node.synopsis,
        hint: node.hint,
      });
    }

    if (indexes.length > 0) {
      const { error } = await supabase
        .from('quest_graph_indexes')
        .insert(indexes);

      if (error) {
        throw new Error(`Failed to create graph indexes: ${error.message}`);
      }
    }
  }

  /**
   * Update indexes for graph
   */
  private async updateIndexes(graphId: string, graph: QuestGraph): Promise<void> {
    // Delete existing indexes
    await supabase
      .from('quest_graph_indexes')
      .delete()
      .eq('graph_id', graphId);

    // Create new indexes
    await this.createIndexes(graphId, graph);
  }

  /**
   * Get node dependencies
   */
  private getNodeDependencies(node: GraphNode, graph: QuestGraph): any[] {
    const deps = [];
    
    // Find edges that lead to this node
    const incomingEdges = graph.edges?.filter(edge => edge.to === node.id) || [];
    
    for (const edge of incomingEdges) {
      deps.push({
        from: edge.from,
        guard: edge.guard,
      });
    }

    return deps;
  }

  /**
   * Detect cycles in graph
   */
  private detectCycles(graph: QuestGraph): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (nodeId: string, path: string[]) => {
      if (recursionStack.has(nodeId)) {
        cycles.push(path.join(' -> ') + ' -> ' + nodeId);
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = graph.edges?.filter(edge => edge.from === nodeId) || [];
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path, nodeId]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Find unreachable nodes
   */
  private findUnreachableNodes(graph: QuestGraph): string[] {
    const reachable = new Set<string>();
    
    const dfs = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      
      reachable.add(nodeId);
      const outgoingEdges = graph.edges?.filter(edge => edge.from === nodeId) || [];
      for (const edge of outgoingEdges) {
        dfs(edge.to);
      }
    };

    // Start from start node
    dfs(graph.start);

    return graph.nodes
      .map(node => node.id)
      .filter(id => !reachable.has(id));
  }

  /**
   * Find missing objectives
   */
  private findMissingObjectives(graph: QuestGraph): string[] {
    const referencedObjectives = new Set<string>();
    
    // Collect objectives referenced in nodes
    for (const node of graph.nodes) {
      if (node.enterIf) {
        for (const condition of node.enterIf) {
          if (condition.objective) {
            referencedObjectives.add(condition.objective);
          }
        }
      }
    }

    // Collect objectives referenced in edges
    for (const edge of graph.edges || []) {
      if (edge.guard) {
        for (const guard of edge.guard) {
          if (guard.objective) {
            referencedObjectives.add(guard.objective);
          }
        }
      }
    }

    // Check if objectives are defined in nodes
    const definedObjectives = new Set<string>();
    for (const node of graph.nodes) {
      if (node.onSuccess) {
        for (const action of node.onSuccess) {
          if (action.act === 'OBJECTIVE_UPDATE' && action.id) {
            definedObjectives.add(action.id);
          }
        }
      }
    }

    return Array.from(referencedObjectives).filter(obj => !definedObjectives.has(obj));
  }

  /**
   * Check text length limits
   */
  private checkTextLimits(graph: QuestGraph): string[] {
    const violations: string[] = [];

    for (const node of graph.nodes) {
      if (node.synopsis.length > 160) {
        violations.push(`Node ${node.id}: synopsis too long (${node.synopsis.length} > 160)`);
      }
      if (node.hint && node.hint.length > 120) {
        violations.push(`Node ${node.id}: hint too long (${node.hint.length} > 120)`);
      }
    }

    return violations;
  }

  /**
   * Compute hash for graph
   */
  private computeHash(graph: QuestGraph): string {
    const graphString = JSON.stringify(graph, Object.keys(graph).sort());
    let hash = 0;
    for (let i = 0; i < graphString.length; i++) {
      const char = graphString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Map database record to QuestGraphRecord
   */
  private mapRecordToQuestGraph(record: any): QuestGraphRecord {
    return {
      id: record.id,
      adventureRef: record.adventure_ref,
      version: record.version,
      doc: record.doc,
      hash: record.hash,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}

// Singleton instance
export const questGraphsRepo = new QuestGraphsRepo();


