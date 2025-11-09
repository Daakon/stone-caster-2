/**
 * Budget Engine
 * Deterministic token budgeting with stable trim order
 */

import type { BudgetInput, BudgetOutput, LinearSection, TrimResult, Category } from './budget-types.js';
import { CATEGORY_PRECEDENCE } from './budget-types.js';
import { estimateTokens } from './tokenizer.js';

const TRIM_MARKER = '… [[trimmed]]';
const MIN_CHARS_GUARDRAIL_RATIO = 0.75; // Sum of min_chars should not exceed 75% of budget
// Soft budget per slot (Phase 7: Performance & Stability)
// If a slot regularly exceeds this token count, surface a non-blocking warning
const SOFT_BUDGET_PER_SLOT_TOKENS = parseInt(process.env.PROMPT_SOFT_BUDGET_PER_SLOT_TOKENS || '2000', 10);

/**
 * Extract category from section key
 */
function getCategory(key: string): Category {
  if (key.startsWith('core.')) return 'CORE';
  if (key.startsWith('ruleset.')) return 'RULESET';
  if (key.startsWith('module.')) return 'MODULES';
  if (key.startsWith('world.')) return 'WORLD';
  if (key.startsWith('scenario.')) return 'SCENARIO';
  if (key.startsWith('npc.')) return 'NPCS';
  if (key.startsWith('state.')) return 'STATE';
  if (key.startsWith('input.')) return 'INPUT';
  return 'INPUT'; // Default fallback
}

/**
 * Find last newline before position (to avoid cutting mid-sentence)
 */
function findLastNewline(text: string, maxPos: number): number {
  const before = text.substring(0, maxPos);
  const lastNewline = before.lastIndexOf('\n');
  return lastNewline > 0 ? lastNewline : maxPos;
}

/**
 * Avoid cutting inside code fences
 */
function findSafeTrimPosition(text: string, maxChars: number): number {
  // Check if we're inside a code fence
  const before = text.substring(0, maxChars);
  const codeFenceMatches = before.match(/```/g);
  if (codeFenceMatches && codeFenceMatches.length % 2 === 1) {
    // Odd number of fences = we're inside one
    // Find the last complete fence before maxChars
    const lastFence = before.lastIndexOf('```');
    if (lastFence > 0) {
      // Back off to previous newline after the fence
      const afterFence = before.substring(lastFence + 3);
      const nextNewline = afterFence.indexOf('\n');
      if (nextNewline > 0) {
        return lastFence + 3 + nextNewline;
      }
      return lastFence; // Fallback: trim at fence
    }
  }
  
  // Not in a fence, find last newline
  return findLastNewline(text, maxChars);
}

/**
 * Apply budget to linear sections
 */
export async function applyBudget(input: BudgetInput): Promise<BudgetOutput> {
  const { linearSections, maxTokens } = input;
  const warnings: string[] = [];
  const trims: TrimResult[] = [];

  // Step 1: Tokenize each section
  const sectionsWithTokens = await Promise.all(
    linearSections.map(async (section) => ({
      ...section,
      tokens: await estimateTokens(section.text),
    }))
  );

  const totalTokensBefore = sectionsWithTokens.reduce((sum, s) => sum + s.tokens, 0);

  // Phase 7: Soft budget per slot warnings (non-blocking)
  for (const section of sectionsWithTokens) {
    if (section.tokens > SOFT_BUDGET_PER_SLOT_TOKENS) {
      warnings.push(`Slot "${section.key}" exceeds soft budget (${section.tokens} > ${SOFT_BUDGET_PER_SLOT_TOKENS} tokens). Consider shortening this slot.`);
    }
  }

  // Step 2: Check if we're under budget
  if (totalTokensBefore <= maxTokens) {
    return {
      sections: linearSections,
      totalTokensBefore,
      totalTokensAfter: totalTokensBefore,
      trims: [],
      warnings: [],
    };
  }

  // Step 3: Validate min_chars guardrail
  const totalMinChars = sectionsWithTokens.reduce((sum, s) => {
    const minChars = s.slot?.min_chars || 0;
    return sum + minChars;
  }, 0);

  const maxMinChars = Math.floor(maxTokens * MIN_CHARS_GUARDRAIL_RATIO * 4); // Convert tokens to chars (rough)
  if (totalMinChars > maxMinChars) {
    warnings.push(`min_chars sum (${totalMinChars}) exceeds guardrail (${maxMinChars}), reducing proportionally`);
    // Reduce min_chars proportionally
    const ratio = maxMinChars / totalMinChars;
    for (const section of sectionsWithTokens) {
      if (section.slot?.min_chars) {
        section.slot.min_chars = Math.floor(section.slot.min_chars * ratio);
      }
    }
  }

  // Step 4: Build trim order
  // Sort by: category precedence, then priority DESC, then must_keep (false first), then key ASC
  const sortedSections = [...sectionsWithTokens].sort((a, b) => {
    const catA = getCategory(a.key);
    const catB = getCategory(b.key);
    const precA = CATEGORY_PRECEDENCE[catA];
    const precB = CATEGORY_PRECEDENCE[catB];

    if (precA !== precB) {
      return precA - precB; // Lower precedence = trim first
    }

    // Same category: sort by priority DESC (higher priority = trim later)
    const priorityA = a.slot?.priority || 0;
    const priorityB = b.slot?.priority || 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // Same priority: must_keep=false trims first
    const mustKeepA = a.slot?.must_keep || false;
    const mustKeepB = b.slot?.must_keep || false;
    if (mustKeepA !== mustKeepB) {
      return mustKeepA ? 1 : -1; // false comes first
    }

    // Same must_keep: sort by key ASC
    return a.key.localeCompare(b.key);
  });

  // Step 5: Trim loop
  let currentTokens = totalTokensBefore;
  const trimmedSections = sectionsWithTokens.map(s => ({ ...s }));

  for (const section of sortedSections) {
    if (currentTokens <= maxTokens) {
      break;
    }

    const sectionIndex = trimmedSections.findIndex(s => s.key === section.key);
    if (sectionIndex === -1) continue;

    const trimmedSection = trimmedSections[sectionIndex];
    const originalText = trimmedSection.text;
    const originalTokens = section.tokens;
    const minChars = trimmedSection.slot?.min_chars || 0;
    const mustKeep = trimmedSection.slot?.must_keep || false;

    // Calculate target length
    const tokensToRemove = currentTokens - maxTokens;
    const charsPerToken = originalText.length / originalTokens; // Rough estimate
    const charsToRemove = Math.ceil(tokensToRemove * charsPerToken);
    const targetLength = Math.max(0, originalText.length - charsToRemove);

    // Respect min_chars for must_keep sections
    const finalTargetLength = mustKeep
      ? Math.max(minChars, targetLength)
      : Math.max(0, targetLength);

    if (finalTargetLength >= originalText.length) {
      // Can't trim this section further
      continue;
    }

    // Find safe trim position
    const safeTrimPos = findSafeTrimPosition(originalText, finalTargetLength);
    const trimmedText = originalText.substring(0, safeTrimPos) + TRIM_MARKER;

    // Update section
    trimmedSection.text = trimmedText;
    const newTokens = await estimateTokens(trimmedText);
    const removedChars = originalText.length - trimmedText.length;
    const removedTokens = originalTokens - newTokens;

    currentTokens -= removedTokens;

    trims.push({
      key: section.key,
      removedChars,
      removedTokens,
    });
  }

  // Step 6: Fallback if still over budget
  if (currentTokens > maxTokens) {
    warnings.push('fallback_trim_applied');
    
    // Uniformly shave all sections (including must_keep) but preserve headers
    const excessTokens = currentTokens - maxTokens;
    const charsPerToken = trimmedSections.reduce((sum, s) => sum + s.text.length, 0) / currentTokens;
    const excessChars = Math.ceil(excessTokens * charsPerToken);
    const charsPerSection = Math.ceil(excessChars / trimmedSections.length);

    for (const section of trimmedSections) {
      const originalText = section.text;
      // Find header (first line or first ##)
      const headerMatch = originalText.match(/^(#+ .+?\n)/);
      const headerLength = headerMatch ? headerMatch[1].length : 0;
      const bodyStart = headerLength;
      
      if (originalText.length - bodyStart <= charsPerSection) {
        continue; // Can't trim more
      }

      const targetLength = Math.max(headerLength, originalText.length - charsPerSection);
      const safeTrimPos = findSafeTrimPosition(originalText, targetLength);
      const trimmedText = originalText.substring(0, safeTrimPos) + TRIM_MARKER;

      const originalTokens = await estimateTokens(originalText);
      const newTokens = await estimateTokens(trimmedText);
      const removedChars = originalText.length - trimmedText.length;
      const removedTokens = originalTokens - newTokens;

      section.text = trimmedText;
      currentTokens -= removedTokens;

      trims.push({
        key: section.key,
        removedChars,
        removedTokens,
      });
    }
  }

  const totalTokensAfter = currentTokens;

  return {
    sections: trimmedSections.map(({ tokens, ...rest }) => rest), // Remove tokens from output
    totalTokensBefore,
    totalTokensAfter,
    trims,
    warnings,
  };
}

/**
 * Count tokens for a given text (utility for tests)
 */
export async function countTokens(text: string): Promise<number> {
  return estimateTokens(text);
}

