/**
 * Phase 21: Dialogue Engine
 * Manages active conversations with multi-speaker support and deterministic line selection
 */

import { z } from 'zod';

// Types
export interface DialogueNode {
  id: string;
  type: 'line' | 'branch' | 'gate' | 'banter' | 'interrupt' | 'reaction';
  speaker?: string;
  syn: string;
  emotion?: string[];
  cooldown?: number;
  guard?: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export interface DialogueEdge {
  from: string;
  to: string;
  condition?: string;
  weight?: number;
}

export interface DialogueGraph {
  id: string;
  world_ref: string;
  adventure_ref?: string;
  nodes: DialogueNode[];
  edges: DialogueEdge[];
}

export interface DialogueState {
  active_conv: string | null;
  speaker_queue: string[];
  cooldowns: Record<string, number>;
  emotions: Record<string, string[]>;
  last_lines: string[];
}

export interface DialogueContext {
  sessionId: string;
  turnId: number;
  nodeId: string;
  worldRef: string;
  adventureRef?: string;
  playerProfile: {
    name: string;
    level: number;
    skills: Record<string, number>;
    resources: Record<string, number>;
  };
  relationships: Record<string, {
    trust: number;
    consent: 'yes' | 'no' | 'later';
    boundaries: Record<string, boolean>;
  }>;
  party: {
    members: string[];
    intents: Record<string, string>;
  };
  sim: {
    weather: string;
    time: string;
    events: string[];
  };
}

export interface CandidateLine {
  id: string;
  syn: string;
  emotion: string[];
  score: number;
  reason: string;
}

export interface DialogueResult {
  success: boolean;
  selectedLine?: CandidateLine;
  candidates: CandidateLine[];
  newActs: Array<{
    type: string;
    [key: string]: any;
  }>;
  errors: string[];
}

// Schemas
const DialogueNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['line', 'branch', 'gate', 'banter', 'interrupt', 'reaction']),
  speaker: z.string().optional(),
  syn: z.string().max(80),
  emotion: z.array(z.string()).max(4).optional(),
  cooldown: z.number().int().min(0).optional(),
  guard: z.array(z.object({
    type: z.string(),
  }).passthrough()).optional(),
});

const DialogueEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  condition: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
});

const DialogueGraphSchema = z.object({
  id: z.string(),
  world_ref: z.string(),
  adventure_ref: z.string().optional(),
  nodes: z.array(DialogueNodeSchema),
  edges: z.array(DialogueEdgeSchema),
});

export class DialogueEngine {
  private graphs: Map<string, DialogueGraph> = new Map();
  private state: DialogueState = {
    active_conv: null,
    speaker_queue: [],
    cooldowns: {},
    emotions: {},
    last_lines: [],
  };

  constructor() {
    // Initialize with empty state
  }

  /**
   * Start a new conversation
   */
  async startConversation(
    convId: string,
    context: DialogueContext
  ): Promise<DialogueResult> {
    try {
      const graph = this.graphs.get(convId);
      if (!graph) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: [`Dialogue graph not found: ${convId}`],
        };
      }

      // Set active conversation
      this.state.active_conv = convId;
      this.state.speaker_queue = this.buildSpeakerQueue(graph, context);
      this.state.emotions = {};

      // Find starting nodes
      const startNodes = graph.nodes.filter(node => 
        node.type === 'line' && !this.isNodeOnCooldown(node.id)
      );

      if (startNodes.length === 0) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: ['No available starting lines'],
        };
      }

      // Generate candidates
      const candidates = await this.generateCandidates(startNodes, context);
      
      // Select best candidate
      const selectedLine = this.selectBestCandidate(candidates, context);

      // Generate acts
      const newActs = this.generateActs(selectedLine, context);

      return {
        success: true,
        selectedLine,
        candidates,
        newActs,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        candidates: [],
        newActs: [],
        errors: [`Dialogue start failed: ${error}`],
      };
    }
  }

  /**
   * Advance dialogue to next line
   */
  async advanceDialogue(
    nodeId: string,
    context: DialogueContext
  ): Promise<DialogueResult> {
    try {
      const graph = this.graphs.get(this.state.active_conv!);
      if (!graph) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: ['No active conversation'],
        };
      }

      // Find current node
      const currentNode = graph.nodes.find(node => node.id === nodeId);
      if (!currentNode) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: [`Node not found: ${nodeId}`],
        };
      }

      // Update cooldowns
      this.updateCooldowns(currentNode);

      // Find next nodes
      const nextNodes = this.findNextNodes(graph, nodeId, context);
      
      if (nextNodes.length === 0) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: ['No valid next nodes'],
        };
      }

      // Generate candidates
      const candidates = await this.generateCandidates(nextNodes, context);
      
      // Select best candidate
      const selectedLine = this.selectBestCandidate(candidates, context);

      // Generate acts
      const newActs = this.generateActs(selectedLine, context);

      return {
        success: true,
        selectedLine,
        candidates,
        newActs,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        candidates: [],
        newActs: [],
        errors: [`Dialogue advance failed: ${error}`],
      };
    }
  }

  /**
   * Handle interrupt (player action or event)
   */
  async handleInterrupt(
    interruptType: string,
    context: DialogueContext
  ): Promise<DialogueResult> {
    try {
      const graph = this.graphs.get(this.state.active_conv!);
      if (!graph) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: ['No active conversation'],
        };
      }

      // Find interrupt nodes
      const interruptNodes = graph.nodes.filter(node => 
        node.type === 'interrupt' && 
        node.guard?.some(guard => guard.type === interruptType)
      );

      if (interruptNodes.length === 0) {
        return {
          success: false,
          candidates: [],
          newActs: [],
          errors: ['No interrupt handlers available'],
        };
      }

      // Generate candidates
      const candidates = await this.generateCandidates(interruptNodes, context);
      
      // Select best candidate
      const selectedLine = this.selectBestCandidate(candidates, context);

      // Generate acts
      const newActs = this.generateActs(selectedLine, context);

      return {
        success: true,
        selectedLine,
        candidates,
        newActs,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        candidates: [],
        newActs: [],
        errors: [`Interrupt handling failed: ${error}`],
      };
    }
  }

  /**
   * Build speaker queue for conversation
   */
  private buildSpeakerQueue(graph: DialogueGraph, context: DialogueContext): string[] {
    const speakers = new Set<string>();
    
    // Add player
    speakers.add('player');
    
    // Add speakers from nodes
    for (const node of graph.nodes) {
      if (node.speaker) {
        speakers.add(node.speaker);
      }
    }
    
    // Add party members
    for (const member of context.party.members) {
      speakers.add(member);
    }
    
    return Array.from(speakers);
  }

  /**
   * Find next nodes from current node
   */
  private findNextNodes(
    graph: DialogueGraph,
    currentNodeId: string,
    context: DialogueContext
  ): DialogueNode[] {
    const nextNodes: DialogueNode[] = [];
    
    // Find edges from current node
    const edges = graph.edges.filter(edge => edge.from === currentNodeId);
    
    for (const edge of edges) {
      const targetNode = graph.nodes.find(node => node.id === edge.to);
      if (targetNode && this.isNodeValid(targetNode, context)) {
        nextNodes.push(targetNode);
      }
    }
    
    return nextNodes;
  }

  /**
   * Check if node is valid for current context
   */
  private isNodeValid(node: DialogueNode, context: DialogueContext): boolean {
    // Check cooldown
    if (this.isNodeOnCooldown(node.id)) {
      return false;
    }
    
    // Check guards
    if (node.guard) {
      for (const guard of node.guard) {
        if (!this.evaluateGuard(guard, context)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Evaluate guard condition
   */
  private evaluateGuard(guard: any, context: DialogueContext): boolean {
    switch (guard.type) {
      case 'relationship':
        const npc = guard.npc || guard.target;
        const minTrust = guard.min_trust || guard.gte;
        const relationship = context.relationships[npc];
        return relationship && relationship.trust >= minTrust;
        
      case 'presence':
        const npcs = guard.npcs || guard.required;
        return npcs.every((npc: string) => 
          context.party.members.includes(npc)
        );
        
      case 'resource':
        const resource = guard.resource;
        const minAmount = guard.min_amount || guard.gte;
        const amount = context.playerProfile.resources[resource] || 0;
        return amount >= minAmount;
        
      case 'skill':
        const skill = guard.skill;
        const minLevel = guard.min_level || guard.gte;
        const level = context.playerProfile.skills[skill] || 0;
        return level >= minLevel;
        
      default:
        return true;
    }
  }

  /**
   * Generate candidate lines
   */
  private async generateCandidates(
    nodes: DialogueNode[],
    context: DialogueContext
  ): Promise<CandidateLine[]> {
    const candidates: CandidateLine[] = [];
    
    for (const node of nodes) {
      if (node.type === 'line' || node.type === 'banter') {
        const score = this.scoreLine(node, context);
        const reason = this.getScoreReason(node, context);
        
        candidates.push({
          id: node.id,
          syn: node.syn,
          emotion: node.emotion || [],
          score,
          reason,
        });
      }
    }
    
    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates;
  }

  /**
   * Score a dialogue line
   */
  private scoreLine(node: DialogueNode, context: DialogueContext): number {
    let score = 0;
    
    // Base score
    score += 50;
    
    // Speaker alignment
    if (node.speaker) {
      const relationship = context.relationships[node.speaker];
      if (relationship) {
        score += relationship.trust * 0.5;
      }
    }
    
    // Emotion alignment
    if (node.emotion) {
      const currentEmotions = this.state.emotions[node.speaker || 'player'] || [];
      const emotionOverlap = node.emotion.filter(emotion => 
        currentEmotions.includes(emotion)
      ).length;
      score += emotionOverlap * 10;
    }
    
    // Context alignment
    if (context.sim.weather === 'storm' && node.syn.includes('storm')) {
      score += 20;
    }
    
    if (context.sim.events.includes('festival') && node.syn.includes('festival')) {
      score += 15;
    }
    
    // Party intent alignment
    if (node.speaker && context.party.intents[node.speaker]) {
      const intent = context.party.intents[node.speaker];
      if (intent === 'support' && node.syn.includes('help')) {
        score += 15;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get score reason for debugging
   */
  private getScoreReason(node: DialogueNode, context: DialogueContext): string {
    const reasons: string[] = [];
    
    if (node.speaker) {
      const relationship = context.relationships[node.speaker];
      if (relationship) {
        reasons.push(`trust:${relationship.trust}`);
      }
    }
    
    if (node.emotion) {
      reasons.push(`emotions:${node.emotion.join(',')}`);
    }
    
    if (context.sim.weather === 'storm' && node.syn.includes('storm')) {
      reasons.push('weather:storm');
    }
    
    return reasons.join(' ');
  }

  /**
   * Select best candidate
   */
  private selectBestCandidate(
    candidates: CandidateLine[],
    context: DialogueContext
  ): CandidateLine | undefined {
    if (candidates.length === 0) return undefined;
    
    // Use deterministic RNG for tie-breaking
    const seed = this.generateSeed(context);
    const rng = this.createRNG(seed);
    
    // Find highest scoring candidates
    const maxScore = candidates[0].score;
    const topCandidates = candidates.filter(c => c.score === maxScore);
    
    if (topCandidates.length === 1) {
      return topCandidates[0];
    }
    
    // Tie-break with RNG
    const selectedIndex = Math.floor(rng() * topCandidates.length);
    return topCandidates[selectedIndex];
  }

  /**
   * Generate acts for selected line
   */
  private generateActs(selectedLine: CandidateLine | undefined, context: DialogueContext): Array<{
    type: string;
    [key: string]: any;
  }> {
    const acts: Array<{ type: string; [key: string]: any }> = [];
    
    if (!selectedLine) return acts;
    
    // Add dialogue advance act
    acts.push({
      type: 'DIALOGUE_ADVANCE',
      convId: this.state.active_conv,
      nodeId: selectedLine.id,
    });
    
    // Add emotion acts
    if (selectedLine.emotion.length > 0) {
      acts.push({
        type: 'DIALOGUE_SET_EMOTION',
        targetId: selectedLine.id,
        tags: selectedLine.emotion,
      });
    }
    
    // Add cooldown act
    acts.push({
      type: 'DIALOGUE_SET_COOLDOWN',
      nodeId: selectedLine.id,
      turns: 3,
    });
    
    return acts;
  }

  /**
   * Update cooldowns
   */
  private updateCooldowns(node: DialogueNode): void {
    if (node.cooldown) {
      this.state.cooldowns[node.id] = node.cooldown;
    }
  }

  /**
   * Check if node is on cooldown
   */
  private isNodeOnCooldown(nodeId: string): boolean {
    return this.state.cooldowns[nodeId] > 0;
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(context: DialogueContext): number {
    const seedString = `${context.sessionId}:${context.turnId}:${this.state.active_conv}:${context.nodeId}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Create deterministic RNG
   */
  private createRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Set dialogue graphs
   */
  setGraphs(graphs: Map<string, DialogueGraph>): void {
    this.graphs = graphs;
  }

  /**
   * Get current state
   */
  getState(): DialogueState {
    return { ...this.state };
  }

  /**
   * Set state
   */
  setState(state: DialogueState): void {
    this.state = state;
  }
}

// Singleton instance
export const dialogueEngine = new DialogueEngine();


