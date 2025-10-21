/**
 * Phase 17: Crafting Engine
 * Handles recipe validation, skill checks, and crafting outcomes
 */

import { z } from 'zod';

// Types
export interface RecipeInput {
  id?: string;
  tag?: string;
  qty: number;
}

export interface RecipeOutput {
  id: string;
  qty: number;
}

export interface Recipe {
  id: string;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  skill?: string;
  diff?: number;
  station?: string;
}

export interface CraftingAttempt {
  recipeId: string;
  inputs: Array<{ id: string; qty: number }>;
  station?: string;
}

export interface SkillCheckResult {
  id: string;
  skill: string;
  roll: number;
  total: number;
  threshold: number;
  outcome: 'critfail' | 'fail' | 'mixed' | 'success' | 'critsuccess';
  margin: number;
}

export interface CraftingResult {
  success: boolean;
  outcome: string;
  quality: number;
  outputYields: Array<{ id: string; qty: number }>;
  bonus: Array<{ id: string; qty: number }>;
  byproducts: Array<{ id: string; qty: number }>;
  skillCheck: SkillCheckResult;
}

// Schemas
const RecipeInputSchema = z.object({
  id: z.string().optional(),
  tag: z.string().optional(),
  qty: z.number().int().min(1),
}).refine(data => data.id || data.tag, {
  message: "Either id or tag must be provided",
});

const RecipeOutputSchema = z.object({
  id: z.string(),
  qty: z.number().int().min(1),
});

const RecipeSchema = z.object({
  id: z.string(),
  inputs: z.array(RecipeInputSchema),
  outputs: z.array(RecipeOutputSchema),
  skill: z.string().optional(),
  diff: z.number().int().min(1).max(100).optional(),
  station: z.string().optional(),
});

export class CraftingEngine {
  private recipeRegistry: Map<string, Recipe> = new Map();
  private itemRegistry: Map<string, any> = new Map();

  constructor() {
    // Initialize with empty registries
  }

  /**
   * Attempt crafting with skill check
   */
  attemptCrafting(
    attempt: CraftingAttempt,
    sessionId: string,
    turnId: number,
    nodeId: string
  ): CraftingResult {
    const recipe = this.recipeRegistry.get(attempt.recipeId);
    if (!recipe) {
      throw new Error(`Unknown recipe: ${attempt.recipeId}`);
    }

    // Validate inputs
    const validation = this.validateInputs(attempt.inputs, recipe);
    if (!validation.valid) {
      return {
        success: false,
        outcome: 'fail',
        quality: 0,
        outputYields: [],
        bonus: [],
        byproducts: [],
        skillCheck: {
          id: 'craft-fail',
          skill: recipe.skill || 'crafting',
          roll: 0,
          total: 0,
          threshold: recipe.diff || 50,
          outcome: 'fail',
          margin: 0,
        },
      };
    }

    // Perform skill check
    const skillResult = this.performSkillCheck(
      recipe.skill || 'crafting',
      recipe.diff || 50,
      sessionId,
      turnId,
      nodeId
    );

    // Calculate quality based on skill check
    const quality = this.calculateQuality(skillResult);

    // Calculate yields based on outcome
    const baseYields = recipe.outputs.map(output => ({
      id: output.id,
      qty: output.qty,
    }));

    const yieldMultiplier = this.getYieldMultiplier(skillResult.outcome);
    const finalYields = baseYields.map(output => ({
      id: output.id,
      qty: Math.max(1, Math.floor(output.qty * yieldMultiplier)),
    }));

    // Generate bonus items on critical success
    const bonus = skillResult.outcome === 'critsuccess' ? this.generateBonusItems(recipe) : [];

    // Generate byproducts on success
    const byproducts = skillResult.outcome === 'success' || skillResult.outcome === 'critsuccess' 
      ? this.generateByproducts(recipe) 
      : [];

    return {
      success: skillResult.outcome !== 'critfail',
      outcome: skillResult.outcome,
      quality: Math.max(1, Math.min(100, quality)),
      outputYields: finalYields,
      bonus,
      byproducts,
      skillCheck: skillResult,
    };
  }

  /**
   * Validate recipe inputs
   */
  validateInputs(
    inputs: Array<{ id: string; qty: number }>,
    recipe: Recipe
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    for (const requirement of recipe.inputs) {
      if (requirement.id) {
        const input = inputs.find(i => i.id === requirement.id);
        if (!input || input.qty < requirement.qty) {
          missing.push(`${requirement.id} (need ${requirement.qty}, have ${input?.qty || 0})`);
        }
      } else if (requirement.tag) {
        // Check for items with matching tag
        const tagItems = inputs.filter(i => {
          const item = this.itemRegistry.get(i.id);
          return item && item.tags && item.tags.includes(requirement.tag);
        });
        const totalTagQuantity = tagItems.reduce((sum, item) => sum + item.qty, 0);
        if (totalTagQuantity < requirement.qty) {
          missing.push(`${requirement.tag} (need ${requirement.qty}, have ${totalTagQuantity})`);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get recipe by ID
   */
  getRecipe(recipeId: string): Recipe | undefined {
    return this.recipeRegistry.get(recipeId);
  }

  /**
   * Perform skill check
   */
  private performSkillCheck(
    skill: string,
    difficulty: number,
    sessionId: string,
    turnId: number,
    nodeId: string
  ): SkillCheckResult {
    // Generate deterministic seed
    const seed = this.generateSeed(sessionId, turnId, nodeId, skill);
    const rng = this.createRNG(seed);
    
    const roll = Math.floor(rng() * 100) + 1;
    const total = roll; // Simplified - no modifiers for now
    
    const outcome = this.determineOutcome(total, difficulty);
    const margin = Math.abs(total - difficulty);

    return {
      id: `craft-${Date.now()}`,
      skill,
      roll,
      total,
      threshold: difficulty,
      outcome,
      margin,
    };
  }

  /**
   * Determine skill check outcome
   */
  private determineOutcome(total: number, threshold: number): SkillCheckResult['outcome'] {
    if (total <= 5) return 'critfail';
    if (total >= 95) return 'critsuccess';
    if (total < threshold) return 'fail';
    if (total === threshold) return 'mixed';
    return 'success';
  }

  /**
   * Calculate quality based on skill check
   */
  private calculateQuality(skillResult: SkillCheckResult): number {
    const baseQuality = 50;
    const marginBonus = skillResult.margin * 2;
    const outcomeBonus = {
      critfail: -30,
      fail: -10,
      mixed: 0,
      success: 20,
      critsuccess: 40,
    }[skillResult.outcome];

    return Math.max(1, Math.min(100, baseQuality + marginBonus + outcomeBonus));
  }

  /**
   * Get yield multiplier based on outcome
   */
  private getYieldMultiplier(outcome: string): number {
    const multipliers = {
      critfail: 0,
      fail: 0,
      mixed: 0.5,
      success: 1.0,
      critsuccess: 1.5,
    };
    return multipliers[outcome as keyof typeof multipliers] || 0;
  }

  /**
   * Generate bonus items on critical success
   */
  private generateBonusItems(recipe: Recipe): Array<{ id: string; qty: number }> {
    // Simple bonus generation - could be more complex
    return recipe.outputs.map(output => ({
      id: output.id,
      qty: 1,
    }));
  }

  /**
   * Generate byproducts on success
   */
  private generateByproducts(recipe: Recipe): Array<{ id: string; qty: number }> {
    // Simple byproduct generation - could be more complex
    return [
      { id: 'itm.scrap_material', qty: 1 },
    ];
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(
    sessionId: string,
    turnId: number,
    nodeId: string,
    skill: string
  ): number {
    const seedString = `${sessionId}-${turnId}-${nodeId}-${skill}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
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
   * Set registries (for testing)
   */
  setRecipeRegistry(registry: Map<string, Recipe>): void {
    this.recipeRegistry = registry;
  }

  setItemRegistry(registry: Map<string, any>): void {
    this.itemRegistry = registry;
  }
}

// Singleton instance
export const craftingEngine = new CraftingEngine();
