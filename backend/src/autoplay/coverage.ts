// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Coverage metrics and tracking system

export interface CoverageMetrics {
  quest_graph: {
    nodes_visited: Set<string>;
    edges_traversed: Set<string>;
    total_nodes: number;
    total_edges: number;
    coverage_percentage: number;
  };
  dialogue: {
    candidates_surfaced: Set<string>;
    candidates_selected: Set<string>;
    arc_steps_progressed: Set<string>;
    total_candidates: number;
    coverage_percentage: number;
  };
  mechanics: {
    skill_checks_attempted: Map<string, number>;
    difficulty_bands_seen: Set<string>;
    condition_variety: Set<string>;
    resource_curves_exercised: Set<string>;
    coverage_percentage: number;
  };
  economy: {
    loot_tiers_touched: Set<string>;
    craft_outcomes: Set<string>;
    vendor_interactions: Set<string>;
    total_loot_tiers: number;
    coverage_percentage: number;
  };
  world_sim: {
    event_types_triggered: Set<string>;
    weather_states_traversed: Set<string>;
    total_event_types: number;
    coverage_percentage: number;
  };
  mods: {
    hook_invocations: Map<string, number>;
    violations_detected: Set<string>;
    quarantines_triggered: Set<string>;
    total_hooks: number;
    coverage_percentage: number;
  };
}

export interface CoverageSnapshot {
  timestamp: Date;
  turn_number: number;
  metrics: CoverageMetrics;
  overall_coverage: number;
}

export class CoverageTracker {
  private metrics: CoverageMetrics;
  private snapshots: CoverageSnapshot[] = [];
  private initialized = false;

  constructor() {
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CoverageMetrics {
    return {
      quest_graph: {
        nodes_visited: new Set(),
        edges_traversed: new Set(),
        total_nodes: 0,
        total_edges: 0,
        coverage_percentage: 0
      },
      dialogue: {
        candidates_surfaced: new Set(),
        candidates_selected: new Set(),
        arc_steps_progressed: new Set(),
        total_candidates: 0,
        coverage_percentage: 0
      },
      mechanics: {
        skill_checks_attempted: new Map(),
        difficulty_bands_seen: new Set(),
        condition_variety: new Set(),
        resource_curves_exercised: new Set(),
        coverage_percentage: 0
      },
      economy: {
        loot_tiers_touched: new Set(),
        craft_outcomes: new Set(),
        vendor_interactions: new Set(),
        total_loot_tiers: 0,
        coverage_percentage: 0
      },
      world_sim: {
        event_types_triggered: new Set(),
        weather_states_traversed: new Set(),
        total_event_types: 0,
        coverage_percentage: 0
      },
      mods: {
        hook_invocations: new Map(),
        violations_detected: new Set(),
        quarantines_triggered: new Set(),
        total_hooks: 0,
        coverage_percentage: 0
      }
    };
  }

  updateCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    if (!this.initialized) {
      this.initializeFromBundle(bundle);
      this.initialized = true;
    }

    // Update quest graph coverage
    this.updateQuestGraphCoverage(bundle, context, decision, turnResult);
    
    // Update dialogue coverage
    this.updateDialogueCoverage(bundle, context, decision, turnResult);
    
    // Update mechanics coverage
    this.updateMechanicsCoverage(bundle, context, decision, turnResult);
    
    // Update economy coverage
    this.updateEconomyCoverage(bundle, context, decision, turnResult);
    
    // Update world simulation coverage
    this.updateWorldSimCoverage(bundle, context, decision, turnResult);
    
    // Update mods coverage
    this.updateModsCoverage(bundle, context, decision, turnResult);

    // Recalculate percentages
    this.recalculatePercentages();

    // Create snapshot
    this.createSnapshot(context.turn_number || 0);
  }

  private initializeFromBundle(bundle: any): void {
    // Initialize totals from bundle structure
    if (bundle.quest_graph) {
      this.metrics.quest_graph.total_nodes = bundle.quest_graph.nodes?.length || 0;
      this.metrics.quest_graph.total_edges = bundle.quest_graph.edges?.length || 0;
    }

    if (bundle.dialogue) {
      this.metrics.dialogue.total_candidates = bundle.dialogue.candidates?.length || 0;
    }

    if (bundle.economy) {
      this.metrics.economy.total_loot_tiers = bundle.economy.loot_tiers?.length || 0;
    }

    if (bundle.world_sim) {
      this.metrics.world_sim.total_event_types = bundle.world_sim.event_types?.length || 0;
    }

    if (bundle.mods) {
      this.metrics.mods.total_hooks = bundle.mods.hooks?.length || 0;
    }
  }

  private updateQuestGraphCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    // Track visited nodes
    if (context.current_node) {
      this.metrics.quest_graph.nodes_visited.add(context.current_node);
    }

    // Track traversed edges
    if (decision.choice_id) {
      this.metrics.quest_graph.edges_traversed.add(decision.choice_id);
    }

    // Track new nodes from turn result
    if (turnResult.new_nodes) {
      turnResult.new_nodes.forEach((node: string) => {
        this.metrics.quest_graph.nodes_visited.add(node);
      });
    }
  }

  private updateDialogueCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    // Track dialogue candidates surfaced
    if (context.dialogue_candidates) {
      context.dialogue_candidates.forEach((candidate: any) => {
        if (candidate.id) {
          this.metrics.dialogue.candidates_surfaced.add(candidate.id);
        }
      });
    }

    // Track dialogue candidates selected
    if (decision.player_text) {
      const dialogueId = this.generateDialogueId(decision.player_text);
      this.metrics.dialogue.candidates_selected.add(dialogueId);
    }

    // Track arc steps progressed
    if (turnResult.dialogue_progress) {
      turnResult.dialogue_progress.forEach((step: string) => {
        this.metrics.dialogue.arc_steps_progressed.add(step);
      });
    }
  }

  private updateMechanicsCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    // Track skill checks attempted
    if (turnResult.skill_checks) {
      turnResult.skill_checks.forEach((check: any) => {
        const skill = check.skill;
        const current = this.metrics.mechanics.skill_checks_attempted.get(skill) || 0;
        this.metrics.mechanics.skill_checks_attempted.set(skill, current + 1);
        
        // Track difficulty bands
        if (check.difficulty) {
          this.metrics.mechanics.difficulty_bands_seen.add(check.difficulty.toString());
        }
      });
    }

    // Track condition variety
    if (turnResult.conditions) {
      turnResult.conditions.forEach((condition: string) => {
        this.metrics.mechanics.condition_variety.add(condition);
      });
    }

    // Track resource curves
    if (turnResult.resource_changes) {
      turnResult.resource_changes.forEach((resource: string) => {
        this.metrics.mechanics.resource_curves_exercised.add(resource);
      });
    }
  }

  private updateEconomyCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    // Track loot tiers touched
    if (turnResult.loot_gained) {
      turnResult.loot_gained.forEach((loot: any) => {
        if (loot.tier) {
          this.metrics.economy.loot_tiers_touched.add(loot.tier);
        }
      });
    }

    // Track craft outcomes
    if (turnResult.craft_attempts) {
      turnResult.craft_attempts.forEach((outcome: string) => {
        this.metrics.economy.craft_outcomes.add(outcome);
      });
    }

    // Track vendor interactions
    if (turnResult.vendor_interactions) {
      turnResult.vendor_interactions.forEach((interaction: string) => {
        this.metrics.economy.vendor_interactions.add(interaction);
      });
    }
  }

  private updateWorldSimCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    // Track event types triggered
    if (turnResult.world_events) {
      turnResult.world_events.forEach((event: any) => {
        if (event.type) {
          this.metrics.world_sim.event_types_triggered.add(event.type);
        }
      });
    }

    // Track weather states
    if (turnResult.weather_changes) {
      turnResult.weather_changes.forEach((weather: string) => {
        this.metrics.world_sim.weather_states_traversed.add(weather);
      });
    }
  }

  private updateModsCoverage(bundle: any, context: any, decision: any, turnResult: any): void {
    // Track hook invocations
    if (turnResult.mod_hooks) {
      turnResult.mod_hooks.forEach((hook: any) => {
        const namespace = hook.namespace;
        const current = this.metrics.mods.hook_invocations.get(namespace) || 0;
        this.metrics.mods.hook_invocations.set(namespace, current + 1);
      });
    }

    // Track violations
    if (turnResult.mod_violations) {
      turnResult.mod_violations.forEach((violation: string) => {
        this.metrics.mods.violations_detected.add(violation);
      });
    }

    // Track quarantines
    if (turnResult.mod_quarantines) {
      turnResult.mod_quarantines.forEach((quarantine: string) => {
        this.metrics.mods.quarantines_triggered.add(quarantine);
      });
    }
  }

  private recalculatePercentages(): void {
    // Quest graph coverage
    const questGraph = this.metrics.quest_graph;
    const questGraphCoverage = this.calculateSetCoverage(
      questGraph.nodes_visited.size + questGraph.edges_traversed.size,
      questGraph.total_nodes + questGraph.total_edges
    );
    questGraph.coverage_percentage = questGraphCoverage;

    // Dialogue coverage
    const dialogue = this.metrics.dialogue;
    const dialogueCoverage = this.calculateSetCoverage(
      dialogue.candidates_selected.size,
      dialogue.total_candidates
    );
    dialogue.coverage_percentage = dialogueCoverage;

    // Mechanics coverage
    const mechanics = this.metrics.mechanics;
    const mechanicsCoverage = this.calculateMechanicsCoverage(mechanics);
    mechanics.coverage_percentage = mechanicsCoverage;

    // Economy coverage
    const economy = this.metrics.economy;
    const economyCoverage = this.calculateSetCoverage(
      economy.loot_tiers_touched.size + economy.craft_outcomes.size + economy.vendor_interactions.size,
      economy.total_loot_tiers + 10 + 5 // Estimated totals for craft and vendor
    );
    economy.coverage_percentage = economyCoverage;

    // World sim coverage
    const worldSim = this.metrics.world_sim;
    const worldSimCoverage = this.calculateSetCoverage(
      worldSim.event_types_triggered.size + worldSim.weather_states_traversed.size,
      worldSim.total_event_types + 5 // Estimated weather states
    );
    worldSim.coverage_percentage = worldSimCoverage;

    // Mods coverage
    const mods = this.metrics.mods;
    const modsCoverage = this.calculateSetCoverage(
      mods.hook_invocations.size,
      mods.total_hooks
    );
    mods.coverage_percentage = modsCoverage;
  }

  private calculateSetCoverage(covered: number, total: number): number {
    if (total === 0) return 1.0;
    return Math.min(covered / total, 1.0);
  }

  private calculateMechanicsCoverage(mechanics: any): number {
    const skillChecks = mechanics.skill_checks_attempted.size;
    const difficultyBands = mechanics.difficulty_bands_seen.size;
    const conditions = mechanics.condition_variety.size;
    const resources = mechanics.resource_curves_exercised.size;
    
    const total = 20 + 5 + 10 + 8; // Estimated totals
    const covered = skillChecks + difficultyBands + conditions + resources;
    
    return this.calculateSetCoverage(covered, total);
  }

  private createSnapshot(turnNumber: number): void {
    const snapshot: CoverageSnapshot = {
      timestamp: new Date(),
      turn_number: turnNumber,
      metrics: this.deepCopyMetrics(),
      overall_coverage: this.calculateOverallCoverage()
    };

    this.snapshots.push(snapshot);
  }

  private deepCopyMetrics(): CoverageMetrics {
    return {
      quest_graph: {
        nodes_visited: new Set(this.metrics.quest_graph.nodes_visited),
        edges_traversed: new Set(this.metrics.quest_graph.edges_traversed),
        total_nodes: this.metrics.quest_graph.total_nodes,
        total_edges: this.metrics.quest_graph.total_edges,
        coverage_percentage: this.metrics.quest_graph.coverage_percentage
      },
      dialogue: {
        candidates_surfaced: new Set(this.metrics.dialogue.candidates_surfaced),
        candidates_selected: new Set(this.metrics.dialogue.candidates_selected),
        arc_steps_progressed: new Set(this.metrics.dialogue.arc_steps_progressed),
        total_candidates: this.metrics.dialogue.total_candidates,
        coverage_percentage: this.metrics.dialogue.coverage_percentage
      },
      mechanics: {
        skill_checks_attempted: new Map(this.metrics.mechanics.skill_checks_attempted),
        difficulty_bands_seen: new Set(this.metrics.mechanics.difficulty_bands_seen),
        condition_variety: new Set(this.metrics.mechanics.condition_variety),
        resource_curves_exercised: new Set(this.metrics.mechanics.resource_curves_exercised),
        coverage_percentage: this.metrics.mechanics.coverage_percentage
      },
      economy: {
        loot_tiers_touched: new Set(this.metrics.economy.loot_tiers_touched),
        craft_outcomes: new Set(this.metrics.economy.craft_outcomes),
        vendor_interactions: new Set(this.metrics.economy.vendor_interactions),
        total_loot_tiers: this.metrics.economy.total_loot_tiers,
        coverage_percentage: this.metrics.economy.coverage_percentage
      },
      world_sim: {
        event_types_triggered: new Set(this.metrics.world_sim.event_types_triggered),
        weather_states_traversed: new Set(this.metrics.world_sim.weather_states_traversed),
        total_event_types: this.metrics.world_sim.total_event_types,
        coverage_percentage: this.metrics.world_sim.coverage_percentage
      },
      mods: {
        hook_invocations: new Map(this.metrics.mods.hook_invocations),
        violations_detected: new Set(this.metrics.mods.violations_detected),
        quarantines_triggered: new Set(this.metrics.mods.quarantines_triggered),
        total_hooks: this.metrics.mods.total_hooks,
        coverage_percentage: this.metrics.mods.coverage_percentage
      }
    };
  }

  private calculateOverallCoverage(): number {
    const coverages = [
      this.metrics.quest_graph.coverage_percentage,
      this.metrics.dialogue.coverage_percentage,
      this.metrics.mechanics.coverage_percentage,
      this.metrics.economy.coverage_percentage,
      this.metrics.world_sim.coverage_percentage,
      this.metrics.mods.coverage_percentage
    ];

    return coverages.reduce((sum, coverage) => sum + coverage, 0) / coverages.length;
  }

  private generateDialogueId(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `dialogue_${Math.abs(hash)}`;
  }

  getCoverage(): any {
    return {
      quest_graph: this.metrics.quest_graph.coverage_percentage,
      dialogue: this.metrics.dialogue.coverage_percentage,
      mechanics: this.metrics.mechanics.coverage_percentage,
      economy: this.metrics.economy.coverage_percentage,
      world_sim: this.metrics.world_sim.coverage_percentage,
      mods: this.metrics.mods.coverage_percentage,
      overall: this.calculateOverallCoverage()
    };
  }

  getDetailedCoverage(): CoverageMetrics {
    return this.deepCopyMetrics();
  }

  getSnapshots(): CoverageSnapshot[] {
    return [...this.snapshots];
  }

  getCoverageTrend(): number[] {
    return this.snapshots.map(snapshot => snapshot.overall_coverage);
  }

  reset(): void {
    this.metrics = this.initializeMetrics();
    this.snapshots = [];
    this.initialized = false;
  }
}
