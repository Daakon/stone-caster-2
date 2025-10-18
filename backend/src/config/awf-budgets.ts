/**
 * AWF Token Budget Configuration
 * Phase 6: Performance & Cost Controls - Token budget enforcement
 */

export interface AWFBudgetConfig {
  // Input budgets
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTxtSentences: number;
  maxChoices: number;
  maxActs: number;
  
  // Model budgets
  modelMaxOutputTokens: number;
  modelTemperature: number;
  
  // Cache settings
  inlineSliceSummaries: boolean;
  
  // Performance settings
  enableP95Tracking: boolean;
  maxP95WindowSize: number;
}

export interface BudgetReduction {
  type: 'npc_trim' | 'slice_summary_removal' | 'episodic_trim' | 'content_trim';
  description: string;
  tokensSaved: number;
  applied: boolean;
}

export interface BudgetEnforcementResult {
  withinBudget: boolean;
  estimatedTokens: number;
  maxTokens: number;
  reductions: BudgetReduction[];
  finalTokens: number;
}

/**
 * Load AWF budget configuration from environment
 */
export function loadAWFBudgetConfig(): AWFBudgetConfig {
  return {
    // Input budgets
    maxInputTokens: parseInt(process.env.AWF_MAX_INPUT_TOKENS || '6000', 10),
    maxOutputTokens: parseInt(process.env.AWF_MAX_OUTPUT_TOKENS || '1200', 10),
    maxTxtSentences: parseInt(process.env.AWF_MAX_TXT_SENTENCES || '6', 10),
    maxChoices: parseInt(process.env.AWF_MAX_CHOICES || '5', 10),
    maxActs: parseInt(process.env.AWF_MAX_ACTS || '8', 10),
    
    // Model budgets
    modelMaxOutputTokens: parseInt(process.env.AWF_MODEL_MAX_OUTPUT_TOKENS || '1200', 10),
    modelTemperature: parseFloat(process.env.AWF_MODEL_TEMPERATURE || '0.4'),
    
    // Cache settings
    inlineSliceSummaries: process.env.AWF_INLINE_SLICE_SUMMARIES === 'true',
    
    // Performance settings
    enableP95Tracking: process.env.AWF_ENABLE_P95_TRACKING !== 'false',
    maxP95WindowSize: parseInt(process.env.AWF_MAX_P95_WINDOW_SIZE || '100', 10)
  };
}

/**
 * Global budget configuration
 */
export const awfBudgetConfig = loadAWFBudgetConfig();

/**
 * Token budget enforcer
 */
export class TokenBudgetEnforcer {
  private config: AWFBudgetConfig;

  constructor(config: AWFBudgetConfig = awfBudgetConfig) {
    this.config = config;
  }

  /**
   * Enforce input token budget with orderly trimming
   */
  enforceInputBudget(
    bundle: any,
    estimatedTokens: number
  ): BudgetEnforcementResult {
    const reductions: BudgetReduction[] = [];
    let currentTokens = estimatedTokens;
    let finalBundle = { ...bundle };

    // If already within budget, return success
    if (currentTokens <= this.config.maxInputTokens) {
      return {
        withinBudget: true,
        estimatedTokens: currentTokens,
        maxTokens: this.config.maxInputTokens,
        reductions: [],
        finalTokens: currentTokens
      };
    }

    console.log(`[AWF Budget] Input tokens (${currentTokens}) exceed budget (${this.config.maxInputTokens}), applying reductions...`);

    // 1. Reduce NPCs to minimum (3)
    if (finalBundle.awf_bundle?.npcs?.active && finalBundle.awf_bundle.npcs.active.length > 3) {
      const originalCount = finalBundle.awf_bundle.npcs.active.length;
      finalBundle.awf_bundle.npcs.active = finalBundle.awf_bundle.npcs.active.slice(0, 3);
      finalBundle.awf_bundle.npcs.count = 3;
      
      const tokensSaved = this.estimateTokensForNPCs(originalCount - 3);
      currentTokens -= tokensSaved;
      
      reductions.push({
        type: 'npc_trim',
        description: `Reduced NPCs from ${originalCount} to 3`,
        tokensSaved,
        applied: true
      });
    }

    // 2. Remove optional inline summaries if enabled
    if (this.config.inlineSliceSummaries && finalBundle.awf_bundle?.world?.inline) {
      const originalInline = finalBundle.awf_bundle.world.inline;
      delete finalBundle.awf_bundle.world.inline;
      delete finalBundle.awf_bundle.adventure?.inline;
      
      const tokensSaved = this.estimateTokensForInlineSummaries(originalInline);
      currentTokens -= tokensSaved;
      
      reductions.push({
        type: 'slice_summary_removal',
        description: 'Removed inline slice summaries',
        tokensSaved,
        applied: true
      });
    }

    // 3. Trim warm episodic memory to top N by salience
    if (currentTokens > this.config.maxInputTokens && finalBundle.awf_bundle?.game_state?.warm?.episodic) {
      const originalLength = finalBundle.awf_bundle.game_state.warm.episodic.length;
      if (originalLength > 10) {
        // Sort by salience (descending) and keep top 10
        const sorted = [...finalBundle.awf_bundle.game_state.warm.episodic]
          .sort((a, b) => (b.salience || 0) - (a.salience || 0))
          .slice(0, 10);
        
        finalBundle.awf_bundle.game_state.warm.episodic = sorted;
        
        const tokensSaved = this.estimateTokensForEpisodicMemory(originalLength - 10);
        currentTokens -= tokensSaved;
        
        reductions.push({
          type: 'episodic_trim',
          description: `Trimmed episodic memory from ${originalLength} to 10 entries`,
          tokensSaved,
          applied: true
        });
      }
    }

    // 4. Final content trimming if still over budget
    if (currentTokens > this.config.maxInputTokens) {
      const excessTokens = currentTokens - this.config.maxInputTokens;
      const trimmedContent = this.trimContent(finalBundle, excessTokens);
      
      if (trimmedContent.tokensSaved > 0) {
        finalBundle = trimmedContent.bundle;
        currentTokens -= trimmedContent.tokensSaved;
        
        reductions.push({
          type: 'content_trim',
          description: `Trimmed content by ${trimmedContent.tokensSaved} tokens`,
          tokensSaved: trimmedContent.tokensSaved,
          applied: true
        });
      }
    }

    // Add reductions to bundle for logging
    if (reductions.length > 0) {
      finalBundle.reductions = reductions.map(r => ({
        type: r.type,
        description: r.description,
        tokensSaved: r.tokensSaved
      }));
    }

    const withinBudget = currentTokens <= this.config.maxInputTokens;

    if (!withinBudget) {
      console.error(`[AWF Budget] Still over budget after all reductions: ${currentTokens} > ${this.config.maxInputTokens}`);
    }

    return {
      withinBudget,
      estimatedTokens: estimatedTokens,
      maxTokens: this.config.maxInputTokens,
      reductions,
      finalTokens: currentTokens
    };
  }

  /**
   * Enforce output token budget
   */
  enforceOutputBudget(
    output: any,
    estimatedTokens: number
  ): BudgetEnforcementResult {
    const withinBudget = estimatedTokens <= this.config.maxOutputTokens;
    
    if (!withinBudget) {
      console.warn(`[AWF Budget] Output tokens (${estimatedTokens}) exceed budget (${this.config.maxOutputTokens})`);
    }

    return {
      withinBudget,
      estimatedTokens,
      maxTokens: this.config.maxOutputTokens,
      reductions: [],
      finalTokens: estimatedTokens
    };
  }

  /**
   * Get model configuration with budget constraints
   */
  getModelConfig(): { maxTokens: number; temperature: number } {
    return {
      maxTokens: this.config.modelMaxOutputTokens,
      temperature: this.config.modelTemperature
    };
  }

  private estimateTokensForNPCs(npcCount: number): number {
    // Rough estimate: 100 tokens per NPC (more realistic)
    return npcCount * 100;
  }

  private estimateTokensForInlineSummaries(inlineSummaries: string[]): number {
    if (!inlineSummaries) return 0;
    return inlineSummaries.reduce((total, summary) => total + Math.ceil(summary.length / 4), 0);
  }

  private estimateTokensForEpisodicMemory(entryCount: number): number {
    // Rough estimate: 20 tokens per episodic memory entry
    return entryCount * 20;
  }

  private trimContent(bundle: any, excessTokens: number): { bundle: any; tokensSaved: number } {
    // This is a simplified implementation
    // In practice, you might want more sophisticated content trimming
    const bundleStr = JSON.stringify(bundle);
    const targetLength = Math.max(0, bundleStr.length - (excessTokens * 4)); // 4 chars per token estimate
    
    if (targetLength >= bundleStr.length * 0.8) { // Don't trim more than 20%
      return { bundle, tokensSaved: 0 };
    }

    // Simple truncation (in practice, you'd want smarter trimming)
    const trimmedStr = bundleStr.substring(0, targetLength);
    try {
      const trimmedBundle = JSON.parse(trimmedStr + '}'); // Close JSON
      return { bundle: trimmedBundle, tokensSaved: Math.ceil((bundleStr.length - targetLength) / 4) };
    } catch {
      return { bundle, tokensSaved: 0 };
    }
  }
}

/**
 * Global budget enforcer instance
 */
export const awfBudgetEnforcer = new TokenBudgetEnforcer();
