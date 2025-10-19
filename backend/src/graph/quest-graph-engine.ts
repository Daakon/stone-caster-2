/**
 * Quest Graph Engine
 * Manages quest graph node selection, frontier computation, and stuck state detection
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface GraphNode {
  id: string;
  type: 'beat' | 'objective' | 'gate' | 'setpiece';
  synopsis: string;
  enterIf?: Array<{
    flag?: string;
    objective?: string;
    resource?: string;
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
    val: any;
  }>;
  onSuccess?: Array<{
    act: string;
    id?: string;
    key?: string;
    val?: any;
    status?: string;
  }>;
  onFail?: Array<{
    act: string;
    id?: string;
    key?: string;
    val?: any;
    status?: string;
  }>;
  hint?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  guard?: Array<{
    objective?: string;
    flag?: string;
    resource?: string;
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
    val: any;
  }>;
}

export interface QuestGraph {
  graphId: string;
  start: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GameState {
  currentNodeId: string;
  visited: string[];
  failures: string[];
  retries: number;
  flags: Record<string, any>;
  objectives: Record<string, string>;
  resources: Record<string, number>;
}

export interface GraphSlice {
  activeNode: {
    id: string;
    type: string;
    synopsis: string;
  };
  frontier: Array<{
    id: string;
    type: string;
    synopsis: string;
    hint?: string;
    guard?: any;
  }>;
  hash: string;
}

export class QuestGraphEngine {
  private readonly maxStuckTurns = 5;
  private readonly maxRetries = 3;

  /**
   * Select active node based on game state and graph
   */
  selectActiveNode(gameState: GameState, graph: QuestGraph): GraphNode | null {
    // If we have a current node, check if we can stay
    if (gameState.currentNodeId) {
      const currentNode = graph.nodes.find(n => n.id === gameState.currentNodeId);
      if (currentNode && this.canEnterNode(currentNode, gameState)) {
        return currentNode;
      }
    }

    // Find next eligible node
    const eligibleNodes = this.getEligibleNodes(graph, gameState);
    if (eligibleNodes.length === 0) {
      return null; // No eligible nodes
    }

    // Select node based on priority and deterministic RNG
    const seed = this.generateSeed(gameState.currentNodeId || 'start');
    const selectedNode = this.selectNodeDeterministically(eligibleNodes, seed);
    
    return selectedNode;
  }

  /**
   * Get eligible neighbors (frontier) for a node
   */
  eligibleNeighbors(node: GraphNode, graph: QuestGraph, gameState: GameState): GraphNode[] {
    const neighbors: GraphNode[] = [];
    
    // Find edges from this node
    const outgoingEdges = graph.edges.filter(e => e.from === node.id);
    
    for (const edge of outgoingEdges) {
      const targetNode = graph.nodes.find(n => n.id === edge.to);
      if (targetNode && this.canEnterNode(targetNode, gameState)) {
        // Check guard conditions
        if (this.evaluateGuards(edge.guard || [], gameState)) {
          neighbors.push(targetNode);
        }
      }
    }
    
    return neighbors;
  }

  /**
   * Apply outcome from AWF acts to node success/fail
   */
  applyOutcome(node: GraphNode, awfActs: any[], gameState: GameState): {
    success: boolean;
    newGameState: GameState;
    appliedActions: any[];
  } {
    const appliedActions: any[] = [];
    let success = false;
    const newGameState = { ...gameState };

    // Check if any acts match success conditions
    for (const act of awfActs) {
      if (this.matchesSuccessConditions(act, node.onSuccess || [])) {
        success = true;
        appliedActions.push(...(node.onSuccess || []));
        this.applyActions(node.onSuccess || [], newGameState);
        break;
      }
    }

    // If no success, check for failure conditions
    if (!success) {
      for (const act of awfActs) {
        if (this.matchesFailureConditions(act, node.onFail || [])) {
          appliedActions.push(...(node.onFail || []));
          this.applyActions(node.onFail || [], newGameState);
          break;
        }
      }
    }

    return { success, newGameState, appliedActions };
  }

  /**
   * Detect stuck conditions
   */
  detectStuckConditions(gameState: GameState, graph: QuestGraph, turnHistory: any[]): {
    isStuck: boolean;
    reason: string;
    suggestions: string[];
  } {
    const recentTurns = turnHistory.slice(-this.maxStuckTurns);
    
    // Check for no progress in recent turns
    if (recentTurns.length >= this.maxStuckTurns) {
      const hasProgress = recentTurns.some(turn => 
        turn.objectives?.some((obj: any) => obj.status === 'complete') ||
        turn.flags?.some((flag: any) => flag.set === true)
      );
      
      if (!hasProgress) {
        return {
          isStuck: true,
          reason: 'No objective progress in recent turns',
          suggestions: [
            'Try different approaches to current objective',
            'Look for alternative paths or solutions',
            'Consider asking NPCs for guidance'
          ]
        };
      }
    }

    // Check for invalid preconditions
    const currentNode = graph.nodes.find(n => n.id === gameState.currentNodeId);
    if (currentNode && !this.canEnterNode(currentNode, gameState)) {
      return {
        isStuck: true,
        reason: 'Current node preconditions not met',
        suggestions: [
          'Check if required flags or objectives are complete',
          'Verify resource requirements are satisfied',
          'Look for alternative entry conditions'
        ]
      };
    }

    // Check for depleted critical resources
    const criticalResources = ['health', 'mana', 'stamina'];
    const depletedResources = criticalResources.filter(resource => 
      (gameState.resources[resource] || 0) <= 0
    );
    
    if (depletedResources.length > 0) {
      return {
        isStuck: true,
        reason: `Critical resources depleted: ${depletedResources.join(', ')}`,
        suggestions: [
          'Find ways to restore depleted resources',
          'Look for alternative approaches that don\'t require these resources',
          'Seek help from NPCs or use items'
        ]
      };
    }

    // Check for too many retries
    if (gameState.retries >= this.maxRetries) {
      return {
        isStuck: true,
        reason: 'Maximum retries exceeded',
        suggestions: [
          'Try a completely different approach',
          'Look for alternative paths or solutions',
          'Consider asking for help or guidance'
        ]
      };
    }

    return { isStuck: false, reason: '', suggestions: [] };
  }

  /**
   * Generate graph slice for AWF bundle
   */
  generateGraphSlice(gameState: GameState, graph: QuestGraph): GraphSlice {
    const currentNode = graph.nodes.find(n => n.id === gameState.currentNodeId);
    if (!currentNode) {
      throw new Error(`Current node ${gameState.currentNodeId} not found in graph`);
    }

    const neighbors = this.eligibleNeighbors(currentNode, graph, gameState);
    
    return {
      activeNode: {
        id: currentNode.id,
        type: currentNode.type,
        synopsis: currentNode.synopsis,
      },
      frontier: neighbors.map(node => ({
        id: node.id,
        type: node.type,
        synopsis: node.synopsis,
        hint: node.hint,
        guard: this.getGuardSummary(node, graph),
      })),
      hash: this.computeGraphHash(graph),
    };
  }

  /**
   * Check if node can be entered based on conditions
   */
  private canEnterNode(node: GraphNode, gameState: GameState): boolean {
    if (!node.enterIf || node.enterIf.length === 0) {
      return true;
    }

    return node.enterIf.every(condition => this.evaluateCondition(condition, gameState));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: any, gameState: GameState): boolean {
    const { flag, objective, resource, op, val } = condition;
    
    let actualValue: any;
    if (flag !== undefined) {
      actualValue = gameState.flags[flag];
    } else if (objective !== undefined) {
      actualValue = gameState.objectives[objective];
    } else if (resource !== undefined) {
      actualValue = gameState.resources[resource] || 0;
    } else {
      return false;
    }

    switch (op) {
      case 'eq': return actualValue === val;
      case 'ne': return actualValue !== val;
      case 'gt': return actualValue > val;
      case 'lt': return actualValue < val;
      case 'gte': return actualValue >= val;
      case 'lte': return actualValue <= val;
      default: return false;
    }
  }

  /**
   * Evaluate guard conditions
   */
  private evaluateGuards(guards: any[], gameState: GameState): boolean {
    if (guards.length === 0) return true;
    
    return guards.every(guard => this.evaluateCondition(guard, gameState));
  }

  /**
   * Get eligible nodes from graph
   */
  private getEligibleNodes(graph: QuestGraph, gameState: GameState): GraphNode[] {
    return graph.nodes.filter(node => this.canEnterNode(node, gameState));
  }

  /**
   * Select node deterministically based on seed
   */
  private selectNodeDeterministically(nodes: GraphNode[], seed: number): GraphNode {
    if (nodes.length === 0) return null as any;
    if (nodes.length === 1) return nodes[0];
    
    // Simple deterministic selection based on seed
    const index = Math.floor(seed * nodes.length);
    return nodes[index];
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(nodeId: string): number {
    let hash = 0;
    for (let i = 0; i < nodeId.length; i++) {
      const char = nodeId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
  }

  /**
   * Check if acts match success conditions
   */
  private matchesSuccessConditions(act: any, successActions: any[]): boolean {
    return successActions.some(action => 
      act.type === action.act && 
      (!action.id || act.id === action.id)
    );
  }

  /**
   * Check if acts match failure conditions
   */
  private matchesFailureConditions(act: any, failureActions: any[]): boolean {
    return failureActions.some(action => 
      act.type === action.act && 
      (!action.id || act.id === action.id)
    );
  }

  /**
   * Apply actions to game state
   */
  private applyActions(actions: any[], gameState: GameState): void {
    for (const action of actions) {
      switch (action.act) {
        case 'OBJECTIVE_UPDATE':
          if (action.id && action.status) {
            gameState.objectives[action.id] = action.status;
          }
          break;
        case 'FLAG_SET':
          if (action.key !== undefined) {
            gameState.flags[action.key] = action.val;
          }
          break;
        case 'RESOURCE_UPDATE':
          if (action.key && action.val !== undefined) {
            gameState.resources[action.key] = (gameState.resources[action.key] || 0) + action.val;
          }
          break;
      }
    }
  }

  /**
   * Get guard summary for node
   */
  private getGuardSummary(node: GraphNode, graph: QuestGraph): any {
    const edges = graph.edges.filter(e => e.to === node.id);
    return edges.map(edge => ({
      from: edge.from,
      guard: edge.guard,
    }));
  }

  /**
   * Compute graph hash for integrity checking
   */
  private computeGraphHash(graph: QuestGraph): string {
    const graphString = JSON.stringify(graph, Object.keys(graph).sort());
    let hash = 0;
    for (let i = 0; i < graphString.length; i++) {
      const char = graphString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Singleton instance
export const questGraphEngine = new QuestGraphEngine();


