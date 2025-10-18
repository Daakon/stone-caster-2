/**
 * Phase 21: Dialogue Linter
 * Validates dialogue graphs and story arcs for consistency and safety
 */

import { z } from 'zod';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Types
export interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
  };
}

export interface DialogueGraph {
  id: string;
  world_ref: string;
  adventure_ref?: string;
  nodes: Array<{
    id: string;
    type: string;
    speaker?: string;
    syn: string;
    emotion?: string[];
    cooldown?: number;
    guard?: Array<{
      type: string;
      [key: string]: any;
    }>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    condition?: string;
    weight?: number;
  }>;
}

export interface StoryArc {
  id: string;
  scope: 'npc' | 'relationship';
  world_ref: string;
  adventure_ref?: string;
  npc_id?: string;
  participants?: string[];
  phases: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  steps: Array<{
    id: string;
    name: string;
    description: string;
    guards: Array<{
      type: string;
      [key: string]: any;
    }>;
    rewards: Array<{
      type: string;
      [key: string]: any;
    }>;
  }>;
  romance_flags: {
    eligible: boolean;
    min_trust?: number;
    consent_required?: boolean;
    cooldown_turns?: number;
  };
  cooldowns: Record<string, number>;
}

// Schemas
const DialogueNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['line', 'branch', 'gate', 'banter', 'interrupt', 'reaction']),
  speaker: z.string().optional(),
  syn: z.string().max(80),
  emotion: z.array(z.string()).max(4).optional(),
  cooldown: z.number().int().min(0).max(10).optional(),
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

const StoryArcSchema = z.object({
  id: z.string(),
  scope: z.enum(['npc', 'relationship']),
  world_ref: z.string(),
  adventure_ref: z.string().optional(),
  npc_id: z.string().optional(),
  participants: z.array(z.string()).optional(),
  phases: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  })),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    guards: z.array(z.object({
      type: z.string(),
    }).passthrough()),
    rewards: z.array(z.object({
      type: z.string(),
    }).passthrough()),
  })),
  romance_flags: z.object({
    eligible: z.boolean(),
    min_trust: z.number().int().min(0).max(100).optional(),
    consent_required: z.boolean().optional(),
    cooldown_turns: z.number().int().min(0).optional(),
  }),
  cooldowns: z.record(z.string(), z.number().int().min(0)),
});

export class DialogueLinter {
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    // Initialize linter
  }

  /**
   * Lint dialogue graph
   */
  lintDialogueGraph(graph: DialogueGraph): LintResult {
    this.errors = [];
    this.warnings = [];

    try {
      // Validate schema
      const validation = DialogueGraphSchema.safeParse(graph);
      if (!validation.success) {
        this.errors.push(`Schema validation failed: ${validation.error.message}`);
        return this.getResult();
      }

      // Check node validity
      this.checkNodes(graph);

      // Check edge validity
      this.checkEdges(graph);

      // Check for cycles
      this.checkCycles(graph);

      // Check branch coverage
      this.checkBranchCoverage(graph);

      // Check romance gates
      this.checkRomanceGates(graph);

      // Check i18n overlays
      this.checkI18nOverlays(graph);

      return this.getResult();

    } catch (error) {
      this.errors.push(`Linting failed: ${error}`);
      return this.getResult();
    }
  }

  /**
   * Lint story arc
   */
  lintStoryArc(arc: StoryArc): LintResult {
    this.errors = [];
    this.warnings = [];

    try {
      // Validate schema
      const validation = StoryArcSchema.safeParse(arc);
      if (!validation.success) {
        this.errors.push(`Schema validation failed: ${validation.error.message}`);
        return this.getResult();
      }

      // Check arc structure
      this.checkArcStructure(arc);

      // Check romance flags
      this.checkRomanceFlags(arc);

      // Check cooldowns
      this.checkCooldowns(arc);

      // Check guards
      this.checkGuards(arc);

      return this.getResult();

    } catch (error) {
      this.errors.push(`Linting failed: ${error}`);
      return this.getResult();
    }
  }

  /**
   * Check nodes for validity
   */
  private checkNodes(graph: DialogueGraph): void {
    const nodeIds = new Set<string>();

    for (const node of graph.nodes) {
      // Check for duplicate IDs
      if (nodeIds.has(node.id)) {
        this.errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);

      // Check synopsis length
      if (node.syn.length > 80) {
        this.errors.push(`Node ${node.id} synopsis too long: ${node.syn.length} > 80`);
      }

      // Check emotion tags
      if (node.emotion && node.emotion.length > 4) {
        this.errors.push(`Node ${node.id} has too many emotions: ${node.emotion.length} > 4`);
      }

      // Check cooldown
      if (node.cooldown && (node.cooldown < 0 || node.cooldown > 10)) {
        this.errors.push(`Node ${node.id} has invalid cooldown: ${node.cooldown}`);
      }

      // Check speaker validity
      if (node.speaker && !this.isValidSpeaker(node.speaker)) {
        this.warnings.push(`Node ${node.id} has invalid speaker: ${node.speaker}`);
      }
    }
  }

  /**
   * Check edges for validity
   */
  private checkEdges(graph: DialogueGraph): void {
    const nodeIds = new Set(graph.nodes.map(n => n.id));

    for (const edge of graph.edges) {
      // Check if source node exists
      if (!nodeIds.has(edge.from)) {
        this.errors.push(`Edge references non-existent source node: ${edge.from}`);
      }

      // Check if target node exists
      if (!nodeIds.has(edge.to)) {
        this.errors.push(`Edge references non-existent target node: ${edge.to}`);
      }

      // Check weight validity
      if (edge.weight && (edge.weight < 0 || edge.weight > 1)) {
        this.errors.push(`Edge ${edge.from} -> ${edge.to} has invalid weight: ${edge.weight}`);
      }
    }
  }

  /**
   * Check for cycles
   */
  private checkCycles(graph: DialogueGraph): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (this.hasCycle(node.id, graph, visited, recStack)) {
          this.warnings.push('Graph contains cycles (may be intentional)');
          break;
        }
      }
    }
  }

  /**
   * Check if node has cycle
   */
  private hasCycle(
    nodeId: string,
    graph: DialogueGraph,
    visited: Set<string>,
    recStack: Set<string>
  ): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    const outgoingEdges = graph.edges.filter(e => e.from === nodeId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        if (this.hasCycle(edge.to, graph, visited, recStack)) {
          return true;
        }
      } else if (recStack.has(edge.to)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  /**
   * Check branch coverage
   */
  private checkBranchCoverage(graph: DialogueGraph): void {
    const branchNodes = graph.nodes.filter(n => n.type === 'branch');
    
    for (const branch of branchNodes) {
      const outgoingEdges = graph.edges.filter(e => e.from === branch.id);
      if (outgoingEdges.length === 0) {
        this.errors.push(`Branch node ${branch.id} has no outgoing edges`);
      }
    }
  }

  /**
   * Check romance gates
   */
  private checkRomanceGates(graph: DialogueGraph): void {
    const romanceNodes = graph.nodes.filter(n => 
      n.syn.toLowerCase().includes('romance') || 
      n.syn.toLowerCase().includes('intimate')
    );

    for (const node of romanceNodes) {
      if (!node.guard || !node.guard.some(g => g.type === 'relationship')) {
        this.warnings.push(`Romance node ${node.id} missing relationship guard`);
      }
    }
  }

  /**
   * Check i18n overlays
   */
  private checkI18nOverlays(graph: DialogueGraph): void {
    // This would check for i18n overlay files
    // For now, just check if synopsis contains placeholders
    for (const node of graph.nodes) {
      if (node.syn.includes('{{') && node.syn.includes('}}')) {
        this.warnings.push(`Node ${node.id} contains i18n placeholders`);
      }
    }
  }

  /**
   * Check arc structure
   */
  private checkArcStructure(arc: StoryArc): void {
    // Check required fields
    if (arc.scope === 'npc' && !arc.npc_id) {
      this.errors.push('NPC arc missing npc_id');
    }

    if (arc.scope === 'relationship' && !arc.participants) {
      this.errors.push('Relationship arc missing participants');
    }

    // Check phase IDs
    const phaseIds = new Set<string>();
    for (const phase of arc.phases) {
      if (phaseIds.has(phase.id)) {
        this.errors.push(`Duplicate phase ID: ${phase.id}`);
      }
      phaseIds.add(phase.id);
    }

    // Check step IDs
    const stepIds = new Set<string>();
    for (const step of arc.steps) {
      if (stepIds.has(step.id)) {
        this.errors.push(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }
  }

  /**
   * Check romance flags
   */
  private checkRomanceFlags(arc: StoryArc): void {
    if (arc.romance_flags.eligible) {
      if (!arc.romance_flags.min_trust) {
        this.warnings.push('Romance arc missing min_trust');
      }

      if (!arc.romance_flags.consent_required) {
        this.warnings.push('Romance arc missing consent_required flag');
      }

      if (!arc.romance_flags.cooldown_turns) {
        this.warnings.push('Romance arc missing cooldown_turns');
      }
    }
  }

  /**
   * Check cooldowns
   */
  private checkCooldowns(arc: StoryArc): void {
    for (const [key, value] of Object.entries(arc.cooldowns)) {
      if (value < 0 || value > 20) {
        this.errors.push(`Invalid cooldown for ${key}: ${value}`);
      }
    }
  }

  /**
   * Check guards
   */
  private checkGuards(arc: StoryArc): void {
    for (const step of arc.steps) {
      for (const guard of step.guards) {
        if (!guard.type) {
          this.errors.push(`Step ${step.id} has guard without type`);
        }

        if (guard.type === 'relationship' && !guard.npc && !guard.target) {
          this.errors.push(`Step ${step.id} relationship guard missing npc/target`);
        }
      }
    }
  }

  /**
   * Check if speaker is valid
   */
  private isValidSpeaker(speaker: string): boolean {
    return speaker === 'player' || speaker.startsWith('npc.') || speaker.startsWith('party.');
  }

  /**
   * Get lint result
   */
  private getResult(): LintResult {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
      summary: {
        total: this.errors.length + this.warnings.length,
        errors: this.errors.length,
        warnings: this.warnings.length,
      },
    };
  }

  /**
   * Lint file
   */
  lintFile(filePath: string): LintResult {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.nodes && data.edges) {
        return this.lintDialogueGraph(data as DialogueGraph);
      } else if (data.phases && data.steps) {
        return this.lintStoryArc(data as StoryArc);
      } else {
        return {
          valid: false,
          errors: ['Unknown file format'],
          warnings: [],
          summary: { total: 1, errors: 1, warnings: 0 },
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`File read failed: ${error}`],
        warnings: [],
        summary: { total: 1, errors: 1, warnings: 0 },
      };
    }
  }

  /**
   * Lint directory
   */
  lintDirectory(dirPath: string): LintResult {
    // This would recursively lint all dialogue files in directory
    // For now, return mock result
    return {
      valid: true,
      errors: [],
      warnings: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const linter = new DialogueLinter();

  if (args.length === 0) {
    console.log('Usage: awf-lint-dialogue <file|directory>');
    process.exit(1);
  }

  const path = args[0];
  const result = linter.lintFile(path);

  if (result.valid) {
    console.log('✅ Dialogue linting passed');
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
  } else {
    console.log('❌ Dialogue linting failed');
    console.log('Errors:');
    result.errors.forEach(error => console.log(`  - ${error}`));
    if (result.warnings.length > 0) {
      console.log('Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    process.exit(1);
  }
}


