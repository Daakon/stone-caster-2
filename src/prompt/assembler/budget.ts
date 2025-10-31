// Prompt Assembler Budget Management
// Handles token estimation, truncation policies, and budget enforcement

import type { Scope, TruncationMeta, BudgetConfig } from './types';
import { truncationIndicator, compressionIndicator, gameStateCompressionCue } from './markdown';

/**
 * Estimates token count for a given text
 * Uses a simple heuristic: ~4 characters per token
 * @param text The text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimates tokens for multiple text segments
 * @param texts Array of text segments
 * @returns Total estimated token count
 */
export function estimateTokensTotal(texts: string[]): number {
  return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

/**
 * Truncates text to fit within a character limit while preserving sentence boundaries
 * @param text The text to truncate
 * @param maxChars Maximum characters allowed
 * @returns Truncated text and metadata
 */
export function truncateText(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
  fromChars: number;
  toChars: number;
} {
  if (text.length <= maxChars) {
    return { text, truncated: false, fromChars: text.length, toChars: text.length };
  }

  const originalLength = text.length;
  let truncated = text.substring(0, maxChars);
  
  // Try to end at a sentence boundary
  const lastSentence = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  
  const lastPunctuation = Math.max(lastSentence, lastQuestion, lastExclamation);
  
  if (lastPunctuation > maxChars * 0.7) { // Only if we don't lose too much content
    truncated = truncated.substring(0, lastPunctuation + 1);
  }
  
  return {
    text: truncated,
    truncated: true,
    fromChars: originalLength,
    toChars: truncated.length
  };
}

/**
 * Compresses game state text to a summary
 * @param gameStateText The game state text to compress
 * @param maxChars Maximum characters for compressed version
 * @returns Compressed text and metadata
 */
export function compressGameState(
  gameStateText: string, 
  maxChars: number
): {
  text: string;
  compressed: boolean;
  originalLength: number;
  compressedLength: number;
} {
  if (gameStateText.length <= maxChars) {
    return {
      text: gameStateText,
      compressed: false,
      originalLength: gameStateText.length,
      compressedLength: gameStateText.length
    };
  }

  const originalLength = gameStateText.length;
  const compressionCue = gameStateCompressionCue(originalLength);
  
  return {
    text: compressionCue,
    compressed: true,
    originalLength,
    compressedLength: compressionCue.length
  };
}

/**
 * Applies truncation policy in the required order
 * @param prompt The current prompt
 * @param config Budget configuration
 * @param meta Current truncation metadata
 * @returns Updated prompt and metadata
 */
export function applyTruncationPolicy(
  prompt: string,
  config: BudgetConfig,
  meta: TruncationMeta
): {
  prompt: string;
  meta: TruncationMeta;
} {
  let currentPrompt = prompt;
  let currentMeta = { ...meta, policyWarnings: meta.policyWarnings || [] };
  const currentTokens = estimateTokens(currentPrompt);
  
  if (currentTokens <= config.tokenBudget) {
    return { prompt: currentPrompt, meta: currentMeta };
  }

  // 1. Trim input text (if present)
  if (currentMeta.inputTrimmed) {
    // Already trimmed, skip
  } else {
    const inputMatch = currentPrompt.match(/=== INPUT_BEGIN ===\n(.*?)\n=== INPUT_END ===/s);
    if (inputMatch) {
      const inputText = inputMatch[1];
      const maxInputChars = config.inputTrimChars;
      const truncated = truncateText(inputText, maxInputChars);
      
      if (truncated.truncated) {
        currentPrompt = currentPrompt.replace(
          /=== INPUT_BEGIN ===\n.*?\n=== INPUT_END ===/s,
          `=== INPUT_BEGIN ===\n${truncated.text}\n=== INPUT_END ===`
        );
        currentMeta.inputTrimmed = {
          fromChars: truncated.fromChars,
          toChars: truncated.toChars
        };
        
        // Check if we're within budget now
        if (estimateTokens(currentPrompt) <= config.tokenBudget) {
          return { prompt: currentPrompt, meta: currentMeta };
        }
      }
    }
  }

  // 2. Compress game state (if present and not already compressed)
  if (!currentMeta.gameStateCompressed) {
    const gameStateMatch = currentPrompt.match(/=== GAME_STATE_BEGIN ===\n(.*?)\n=== GAME_STATE_END ===/s);
    if (gameStateMatch) {
      const gameStateText = gameStateMatch[1];
      const compressed = compressGameState(gameStateText, config.gameStateCompressChars);
      
      if (compressed.compressed) {
        currentPrompt = currentPrompt.replace(
          /=== GAME_STATE_BEGIN ===\n.*?\n=== GAME_STATE_END ===/s,
          `=== GAME_STATE_BEGIN ===\n${compressed.text}\n=== GAME_STATE_END ===`
        );
        currentMeta.gameStateCompressed = true;
        
        // Check if we're within budget now
        if (estimateTokens(currentPrompt) <= config.tokenBudget) {
          return { prompt: currentPrompt, meta: currentMeta };
        }
      }
    }
  }

  // 3. Reduce NPC tiers (handled by NPC module)
  // This is handled in the NPC module and passed back via meta.npcDroppedTiers

  // 4. Drop entire NPC block as last resort
  if (!currentMeta.droppedScopes?.includes('npc')) {
    const npcMatch = currentPrompt.match(/=== NPC_BEGIN ===\n.*?\n=== NPC_END ===/s);
    if (npcMatch) {
      currentPrompt = currentPrompt.replace(/=== NPC_BEGIN ===\n.*?\n=== NPC_END ===/s, '');
      currentMeta.droppedScopes = [...(currentMeta.droppedScopes || []), 'npc'];
      
      // Check if we're within budget now
      if (estimateTokens(currentPrompt) <= config.tokenBudget) {
        return { prompt: currentPrompt, meta: currentMeta };
      }
    }
  }

  // 5. As absolute last resort, drop world/entry (avoid if possible)
  if (currentTokens > config.tokenBudget * 1.5) { // Only if severely over budget
    const scopesToDrop: Scope[] = ['world', 'entry'];
    
    for (const scope of scopesToDrop) {
      if (currentMeta.droppedScopes?.includes(scope)) continue;
      
      const scopeMatch = new RegExp(`=== ${scope.toUpperCase()}_BEGIN ===\\n.*?\\n=== ${scope.toUpperCase()}_END ===`, 's');
      if (scopeMatch.test(currentPrompt)) {
        currentPrompt = currentPrompt.replace(scopeMatch, '');
        currentMeta.droppedScopes = [...(currentMeta.droppedScopes || []), scope];
        
        if (estimateTokens(currentPrompt) <= config.tokenBudget) {
          return { prompt: currentPrompt, meta: currentMeta };
        }
      }
    }
  }

  return { prompt: currentPrompt, meta: currentMeta };
}

/**
 * Creates default budget configuration
 * @param tokenBudget Total token budget
 * @param npcTokenBudget NPC-specific token budget
 * @returns Budget configuration
 */
export function createBudgetConfig(
  tokenBudget: number = 8000,
  npcTokenBudget: number = 600
): BudgetConfig {
  return {
    tokenBudget,
    npcTokenBudget,
    inputTrimChars: Math.floor(tokenBudget * 0.1), // 10% of budget for input
    gameStateCompressChars: Math.floor(tokenBudget * 0.05) // 5% of budget for game state
  };
}

/**
 * Validates that core and ruleset are never dropped
 * @param meta Truncation metadata
 * @returns True if core and ruleset are preserved
 */
export function validateCorePreservation(meta: TruncationMeta): boolean {
  const droppedScopes = meta.droppedScopes || [];
  return !droppedScopes.includes('core') && !droppedScopes.includes('ruleset');
}

/**
 * Calculates budget utilization
 * @param prompt The current prompt
 * @param config Budget configuration
 * @returns Budget utilization information
 */
export function calculateBudgetUtilization(
  prompt: string,
  config: BudgetConfig
): {
  currentTokens: number;
  budgetTokens: number;
  utilizationPercent: number;
  overBudget: boolean;
} {
  const currentTokens = estimateTokens(prompt);
  const budgetTokens = config.tokenBudget;
  const utilizationPercent = (currentTokens / budgetTokens) * 100;
  const overBudget = currentTokens > budgetTokens;

  return {
    currentTokens,
    budgetTokens,
    utilizationPercent,
    overBudget
  };
}

/**
 * Calculates per-scope token counts from assembled prompt
 * Phase 1: Used for audit trail
 * @param prompt The assembled prompt with scope delimiters
 * @returns Token counts per scope
 */
export function calculatePerScopeTokens(prompt: string): Record<string, number> {
  const scopeTokens: Record<string, number> = {};
  
  // Match all scope blocks: === SCOPE_BEGIN === ... === SCOPE_END ===
  const scopeRegex = /=== ([A-Z_]+)_BEGIN ===\n(.*?)\n=== \1_END ===/gs;
  let match;
  
  while ((match = scopeRegex.exec(prompt)) !== null) {
    const scopeName = match[1].toLowerCase();
    const scopeContent = match[2];
    scopeTokens[scopeName] = estimateTokens(scopeContent);
  }
  
  return scopeTokens;
}

/**
 * Creates a budget summary for debugging
 * @param prompt The current prompt
 * @param config Budget configuration
 * @param meta Truncation metadata
 * @returns Budget summary string
 */
export function createBudgetSummary(
  prompt: string,
  config: BudgetConfig,
  meta: TruncationMeta
): string {
  const utilization = calculateBudgetUtilization(prompt, config);
  const summary = [
    `Budget: ${utilization.currentTokens}/${utilization.budgetTokens} tokens (${utilization.utilizationPercent.toFixed(1)}%)`,
    `Over budget: ${utilization.overBudget ? 'Yes' : 'No'}`
  ];

  if (meta.droppedScopes || meta.npcDroppedTiers || meta.inputTrimmed || meta.gameStateCompressed) {
    if (meta.inputTrimmed) {
      summary.push(`Input trimmed: ${meta.inputTrimmed.fromChars} → ${meta.inputTrimmed.toChars} chars`);
    }
    if (meta.gameStateCompressed) {
      summary.push('Game state compressed');
    }
    if (meta.npcDroppedTiers?.length) {
      summary.push(`NPC tiers dropped: ${meta.npcDroppedTiers.length} NPCs`);
    }
    if (meta.droppedScopes?.length) {
      summary.push(`Scopes dropped: ${meta.droppedScopes.join(', ')}`);
    }
  }

  return summary.join('\n');
}
