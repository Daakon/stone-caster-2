// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Deterministic bot engine with policy-based decision making

import { z } from 'zod';

// Bot modes enum
export const BotMode = z.enum([
  'objective_seeker',
  'explorer', 
  'economy_grinder',
  'romance_tester',
  'risk_taker',
  'safety_max'
]);

export type BotMode = z.infer<typeof BotMode>;

// Bot decision result
export interface BotDecision {
  player_text?: string;
  choice_id?: string;
  reasoning?: string;
  confidence?: number;
}

// Bot memory for state tracking
export interface BotMemory {
  visited_nodes: Set<string>;
  dialogue_candidates_seen: Set<string>;
  skill_checks_attempted: Map<string, number>;
  loot_tiers_touched: Set<string>;
  event_types_triggered: Set<string>;
  mod_hooks_invoked: Map<string, number>;
  turn_count: number;
  last_objective_progress: number;
  stuck_turns: number;
  budget_usage: {
    tokens_in: number;
    tokens_out: number;
    max_tokens: number;
  };
}

// Policy interface
export interface BotPolicy {
  name: string;
  decide(
    bundle: any, // AWF bundle
    memory: BotMemory,
    context: BotContext
  ): BotDecision;
}

// Bot context for decision making
export interface BotContext {
  current_node?: string;
  available_choices: string[];
  dialogue_candidates: any[];
  party_state: any;
  world_state: any;
  economy_state: any;
  mod_state: any;
  turn_number: number;
  session_id: string;
  seed: string;
}

// Deterministic RNG for reproducible decisions
export class DeterministicRNG {
  private seed: number;
  private state: number;

  constructor(seed: string) {
    this.seed = this.hashString(seed);
    this.state = this.seed;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Linear congruential generator
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }

  // Generate integer in range [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Generate boolean with given probability
  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  // Choose random element from array
  choose<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.nextInt(0, array.length - 1)];
  }

  // Weighted choice
  weightedChoose<T>(items: Array<{ item: T; weight: number }>): T | undefined {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return undefined;
    
    let random = this.next() * totalWeight;
    for (const { item, weight } of items) {
      random -= weight;
      if (random <= 0) return item;
    }
    return items[items.length - 1].item;
  }
}

// Base policy class
export abstract class BasePolicy implements BotPolicy {
  abstract name: string;
  protected rng: DeterministicRNG;

  constructor(seed: string) {
    this.rng = new DeterministicRNG(seed);
  }

  abstract decide(
    bundle: any,
    memory: BotMemory,
    context: BotContext
  ): BotDecision;

  // Helper methods for common decision patterns
  protected selectChoiceByCoverage(choices: string[], memory: BotMemory): string | undefined {
    // Prefer choices that lead to unexplored nodes
    const unexploredChoices = choices.filter(choice => 
      !memory.visited_nodes.has(choice)
    );
    
    if (unexploredChoices.length > 0) {
      return this.rng.choose(unexploredChoices);
    }
    
    return this.rng.choose(choices);
  }

  protected selectDialogueCandidate(candidates: any[], memory: BotMemory): any | undefined {
    // Prefer candidates with higher scores that haven't been seen
    const unseenCandidates = candidates.filter(candidate => 
      !memory.dialogue_candidates_seen.has(candidate.id)
    );
    
    if (unseenCandidates.length > 0) {
      // Sort by score and choose from top candidates
      const sorted = unseenCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topCandidates = sorted.slice(0, Math.min(3, sorted.length));
      return this.rng.choose(topCandidates);
    }
    
    return this.rng.choose(candidates);
  }

  protected shouldTriggerSkillCheck(skill: string, memory: BotMemory): boolean {
    const attempts = memory.skill_checks_attempted.get(skill) || 0;
    // Trigger more skill checks for skills we haven't explored much
    const probability = Math.max(0.1, 0.5 - (attempts * 0.1));
    return this.rng.nextBoolean(probability);
  }
}

// Objective Seeker Policy
export class ObjectiveSeekerPolicy extends BasePolicy {
  name = 'objective_seeker';

  decide(bundle: any, memory: BotMemory, context: BotContext): BotDecision {
    // Focus on completing objectives and progressing the main quest
    const objectives = bundle.objectives || [];
    const currentObjective = objectives.find((obj: any) => !obj.completed);
    
    if (currentObjective) {
      // Look for choices that advance the current objective
      const objectiveChoices = context.available_choices.filter(choice => 
        this.advancesObjective(choice, currentObjective, bundle)
      );
      
      if (objectiveChoices.length > 0) {
        return {
          choice_id: this.rng.choose(objectiveChoices),
          reasoning: 'Advancing current objective',
          confidence: 0.9
        };
      }
    }
    
    // Fallback to coverage-based selection
    const choice = this.selectChoiceByCoverage(context.available_choices, memory);
    return {
      choice_id: choice,
      reasoning: 'Exploring for objective opportunities',
      confidence: 0.6
    };
  }

  private advancesObjective(choice: string, objective: any, bundle: any): boolean {
    // Simple heuristic: check if choice mentions objective keywords
    const objectiveKeywords = objective.description?.toLowerCase().split(' ') || [];
    const choiceText = bundle.choices?.[choice]?.text?.toLowerCase() || '';
    
    return objectiveKeywords.some(keyword => 
      choiceText.includes(keyword.toLowerCase())
    );
  }
}

// Explorer Policy
export class ExplorerPolicy extends BasePolicy {
  name = 'explorer';

  decide(bundle: any, memory: BotMemory, context: BotContext): BotDecision {
    // Maximize coverage by exploring unexplored areas
    const unexploredChoices = context.available_choices.filter(choice => 
      !memory.visited_nodes.has(choice)
    );
    
    if (unexploredChoices.length > 0) {
      return {
        choice_id: this.rng.choose(unexploredChoices),
        reasoning: 'Exploring unexplored content',
        confidence: 0.8
      };
    }
    
    // If all choices explored, try to find new paths
    const newPathChoices = context.available_choices.filter(choice => 
      this.leadsToNewArea(choice, bundle, memory)
    );
    
    if (newPathChoices.length > 0) {
      return {
        choice_id: this.rng.choose(newPathChoices),
        reasoning: 'Seeking new exploration paths',
        confidence: 0.7
      };
    }
    
    // Fallback to random choice
    return {
      choice_id: this.rng.choose(context.available_choices),
      reasoning: 'Random exploration',
      confidence: 0.4
    };
  }

  private leadsToNewArea(choice: string, bundle: any, memory: BotMemory): boolean {
    // Check if this choice leads to areas we haven't visited
    const choiceTarget = bundle.choices?.[choice]?.target;
    if (!choiceTarget) return false;
    
    // Simple heuristic: check if target has different area/region
    return !memory.visited_nodes.has(choiceTarget);
  }
}

// Economy Grinder Policy
export class EconomyGrinderPolicy extends BasePolicy {
  name = 'economy_grinder';

  decide(bundle: any, memory: BotMemory, context: BotContext): BotDecision {
    // Focus on economic activities: trading, crafting, looting
    const economicChoices = context.available_choices.filter(choice => 
      this.isEconomicChoice(choice, bundle)
    );
    
    if (economicChoices.length > 0) {
      return {
        choice_id: this.rng.choose(economicChoices),
        reasoning: 'Pursuing economic opportunities',
        confidence: 0.8
      };
    }
    
    // Look for dialogue that might lead to economic opportunities
    const economicDialogue = context.dialogue_candidates.filter(candidate => 
      this.isEconomicDialogue(candidate)
    );
    
    if (economicDialogue.length > 0) {
      const selected = this.selectDialogueCandidate(economicDialogue, memory);
      if (selected) {
        return {
          player_text: selected.text,
          reasoning: 'Engaging in economic dialogue',
          confidence: 0.7
        };
      }
    }
    
    // Fallback to coverage-based selection
    const choice = this.selectChoiceByCoverage(context.available_choices, memory);
    return {
      choice_id: choice,
      reasoning: 'Exploring for economic opportunities',
      confidence: 0.5
    };
  }

  private isEconomicChoice(choice: string, bundle: any): boolean {
    const choiceText = bundle.choices?.[choice]?.text?.toLowerCase() || '';
    const economicKeywords = ['trade', 'buy', 'sell', 'craft', 'loot', 'gold', 'coin', 'vendor', 'shop'];
    return economicKeywords.some(keyword => choiceText.includes(keyword));
  }

  private isEconomicDialogue(candidate: any): boolean {
    const text = candidate.text?.toLowerCase() || '';
    const economicKeywords = ['trade', 'buy', 'sell', 'craft', 'loot', 'gold', 'coin', 'vendor', 'shop'];
    return economicKeywords.some(keyword => text.includes(keyword));
  }
}

// Romance Tester Policy
export class RomanceTesterPolicy extends BasePolicy {
  name = 'romance_tester';

  decide(bundle: any, memory: BotMemory, context: BotContext): BotDecision {
    // Focus on romance-related dialogue and choices
    const romanceChoices = context.available_choices.filter(choice => 
      this.isRomanceChoice(choice, bundle)
    );
    
    if (romanceChoices.length > 0) {
      return {
        choice_id: this.rng.choose(romanceChoices),
        reasoning: 'Pursuing romance opportunities',
        confidence: 0.8
      };
    }
    
    // Look for romance dialogue
    const romanceDialogue = context.dialogue_candidates.filter(candidate => 
      this.isRomanceDialogue(candidate)
    );
    
    if (romanceDialogue.length > 0) {
      const selected = this.selectDialogueCandidate(romanceDialogue, memory);
      if (selected) {
        return {
          player_text: selected.text,
          reasoning: 'Engaging in romance dialogue',
          confidence: 0.7
        };
      }
    }
    
    // Fallback to coverage-based selection
    const choice = this.selectChoiceByCoverage(context.available_choices, memory);
    return {
      choice_id: choice,
      reasoning: 'Exploring for romance opportunities',
      confidence: 0.5
    };
  }

  private isRomanceChoice(choice: string, bundle: any): boolean {
    const choiceText = bundle.choices?.[choice]?.text?.toLowerCase() || '';
    const romanceKeywords = ['romance', 'flirt', 'love', 'kiss', 'hug', 'date', 'relationship'];
    return romanceKeywords.some(keyword => choiceText.includes(keyword));
  }

  private isRomanceDialogue(candidate: any): boolean {
    const text = candidate.text?.toLowerCase() || '';
    const romanceKeywords = ['romance', 'flirt', 'love', 'kiss', 'hug', 'date', 'relationship'];
    return romanceKeywords.some(keyword => text.includes(keyword));
  }
}

// Risk Taker Policy
export class RiskTakerPolicy extends BasePolicy {
  name = 'risk_taker';

  decide(bundle: any, memory: BotMemory, context: BotContext): BotDecision {
    // Prefer risky choices and skill checks
    const riskyChoices = context.available_choices.filter(choice => 
      this.isRiskyChoice(choice, bundle)
    );
    
    if (riskyChoices.length > 0) {
      return {
        choice_id: this.rng.choose(riskyChoices),
        reasoning: 'Taking calculated risks',
        confidence: 0.8
      };
    }
    
    // Trigger skill checks more often
    const skillChecks = context.available_choices.filter(choice => 
      this.isSkillCheck(choice, bundle)
    );
    
    if (skillChecks.length > 0 && this.rng.nextBoolean(0.7)) {
      return {
        choice_id: this.rng.choose(skillChecks),
        reasoning: 'Attempting skill check',
        confidence: 0.7
      };
    }
    
    // Fallback to coverage-based selection
    const choice = this.selectChoiceByCoverage(context.available_choices, memory);
    return {
      choice_id: choice,
      reasoning: 'Exploring for risk opportunities',
      confidence: 0.5
    };
  }

  private isRiskyChoice(choice: string, bundle: any): boolean {
    const choiceText = bundle.choices?.[choice]?.text?.toLowerCase() || '';
    const riskKeywords = ['danger', 'risk', 'challenge', 'dare', 'bold', 'aggressive'];
    return riskKeywords.some(keyword => choiceText.includes(keyword));
  }

  private isSkillCheck(choice: string, bundle: any): boolean {
    const choiceText = bundle.choices?.[choice]?.text?.toLowerCase() || '';
    const skillKeywords = ['check', 'roll', 'test', 'attempt', 'try'];
    return skillKeywords.some(keyword => choiceText.includes(keyword));
  }
}

// Safety Max Policy
export class SafetyMaxPolicy extends BasePolicy {
  name = 'safety_max';

  decide(bundle: any, memory: BotMemory, context: BotContext): BotDecision {
    // Prefer safe, conservative choices
    const safeChoices = context.available_choices.filter(choice => 
      this.isSafeChoice(choice, bundle)
    );
    
    if (safeChoices.length > 0) {
      return {
        choice_id: this.rng.choose(safeChoices),
        reasoning: 'Choosing safe option',
        confidence: 0.9
      };
    }
    
    // Avoid risky dialogue
    const safeDialogue = context.dialogue_candidates.filter(candidate => 
      this.isSafeDialogue(candidate)
    );
    
    if (safeDialogue.length > 0) {
      const selected = this.selectDialogueCandidate(safeDialogue, memory);
      if (selected) {
        return {
          player_text: selected.text,
          reasoning: 'Engaging in safe dialogue',
          confidence: 0.8
        };
      }
    }
    
    // Fallback to coverage-based selection
    const choice = this.selectChoiceByCoverage(context.available_choices, memory);
    return {
      choice_id: choice,
      reasoning: 'Exploring safely',
      confidence: 0.6
    };
  }

  private isSafeChoice(choice: string, bundle: any): boolean {
    const choiceText = bundle.choices?.[choice]?.text?.toLowerCase() || '';
    const safeKeywords = ['safe', 'careful', 'cautious', 'conservative', 'gentle'];
    const riskyKeywords = ['danger', 'risk', 'challenge', 'dare', 'bold', 'aggressive'];
    
    const hasSafeKeywords = safeKeywords.some(keyword => choiceText.includes(keyword));
    const hasRiskyKeywords = riskyKeywords.some(keyword => choiceText.includes(keyword));
    
    return hasSafeKeywords && !hasRiskyKeywords;
  }

  private isSafeDialogue(candidate: any): boolean {
    const text = candidate.text?.toLowerCase() || '';
    const safeKeywords = ['safe', 'careful', 'cautious', 'conservative', 'gentle'];
    const riskyKeywords = ['danger', 'risk', 'challenge', 'dare', 'bold', 'aggressive'];
    
    const hasSafeKeywords = safeKeywords.some(keyword => text.includes(keyword));
    const hasRiskyKeywords = riskyKeywords.some(keyword => text.includes(keyword));
    
    return hasSafeKeywords && !hasRiskyKeywords;
  }
}

// Bot Engine class
export class BotEngine {
  private policies: Map<BotMode, BotPolicy> = new Map();
  private memory: BotMemory;
  private rng: DeterministicRNG;

  constructor(sessionId: string, turnId: number, mode: BotMode, rngSeed: string) {
    this.memory = this.initializeMemory();
    this.rng = new DeterministicRNG(`${sessionId}:${turnId}:${mode}:${rngSeed}`);
    
    // Initialize policies
    this.policies.set('objective_seeker', new ObjectiveSeekerPolicy(rngSeed));
    this.policies.set('explorer', new ExplorerPolicy(rngSeed));
    this.policies.set('economy_grinder', new EconomyGrinderPolicy(rngSeed));
    this.policies.set('romance_tester', new RomanceTesterPolicy(rngSeed));
    this.policies.set('risk_taker', new RiskTakerPolicy(rngSeed));
    this.policies.set('safety_max', new SafetyMaxPolicy(rngSeed));
  }

  private initializeMemory(): BotMemory {
    return {
      visited_nodes: new Set(),
      dialogue_candidates_seen: new Set(),
      skill_checks_attempted: new Map(),
      loot_tiers_touched: new Set(),
      event_types_triggered: new Set(),
      mod_hooks_invoked: new Map(),
      turn_count: 0,
      last_objective_progress: 0,
      stuck_turns: 0,
      budget_usage: {
        tokens_in: 0,
        tokens_out: 0,
        max_tokens: 1000
      }
    };
  }

  decide(bundle: any, context: BotContext, mode: BotMode): BotDecision {
    const policy = this.policies.get(mode);
    if (!policy) {
      throw new Error(`Unknown bot mode: ${mode}`);
    }

    const decision = policy.decide(bundle, this.memory, context);
    
    // Update memory based on decision
    this.updateMemory(decision, context);
    
    return decision;
  }

  private updateMemory(decision: BotDecision, context: BotContext): void {
    this.memory.turn_count++;
    
    if (decision.choice_id) {
      this.memory.visited_nodes.add(decision.choice_id);
    }
    
    if (decision.player_text) {
      // Track dialogue interactions
      const dialogueId = this.generateDialogueId(decision.player_text);
      this.memory.dialogue_candidates_seen.add(dialogueId);
    }
    
    // Update budget usage
    if (decision.player_text) {
      this.memory.budget_usage.tokens_out += decision.player_text.length / 4; // Rough token estimate
    }
  }

  private generateDialogueId(text: string): string {
    // Simple hash for dialogue tracking
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `dialogue_${Math.abs(hash)}`;
  }

  getMemory(): BotMemory {
    return { ...this.memory };
  }

  resetMemory(): void {
    this.memory = this.initializeMemory();
  }
}
