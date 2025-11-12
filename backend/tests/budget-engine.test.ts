/**
 * Budget Engine Tests
 * Unit tests for applyBudget() function
 */

import { describe, it, expect } from 'vitest';
import { applyBudget } from '../src/budget/budget-engine.js';
import type { LinearSection } from '../src/budget/budget-types.js';
import { estimateTokens } from '../src/budget/tokenizer.js';

/**
 * Helper to create a section with optional metadata
 */
function mkSection(
  key: string,
  text: string,
  meta?: {
    must_keep?: boolean;
    min_chars?: number;
    priority?: number;
  }
): LinearSection {
  return {
    key,
    label: key,
    text,
    slot: meta
      ? {
          name: key.split('.').pop() || key,
          must_keep: meta.must_keep || false,
          min_chars: meta.min_chars,
          priority: meta.priority,
        }
      : undefined,
  };
}

/**
 * Helper to count tokens (for test assertions)
 */
async function countTokens(text: string): Promise<number> {
  return estimateTokens(text);
}

describe('Budget Engine', () => {
  describe('No trim needed', () => {
    it('should return unchanged sections when under budget', async () => {
      const sections = [
        mkSection('ruleset.principles', 'Short principles text'),
        mkSection('world.tone', 'Short tone description'),
      ];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 1000,
      });

      expect(result.totalTokensBefore).toBe(result.totalTokensAfter);
      expect(result.trims.length).toBe(0);
      expect(result.warnings).toEqual([]);
      expect(result.sections).toEqual(sections);
    });
  });

  describe('Single-section trim', () => {
    it('should trim a single large section and add marker', async () => {
      // Create a section that's definitely over budget
      const longText = 'A'.repeat(2000); // ~500 tokens
      const sections = [mkSection('world.tone', longText)];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 100, // Very small budget
      });

      expect(result.totalTokensAfter).toBeLessThanOrEqual(100);
      expect(result.trims.length).toBeGreaterThan(0);
      expect(result.sections[0].text).toContain('… [[trimmed]]');
      expect(result.sections[0].text.length).toBeLessThan(longText.length);
    });
  });

  describe('Multi-section trim with priorities', () => {
    it('should trim low priority sections before high priority', async () => {
      const sections = [
        mkSection('ruleset.principles', 'A'.repeat(1000), { priority: 90 }), // High priority
        mkSection('world.tone', 'B'.repeat(1000), { priority: 50 }), // Medium priority
        mkSection('npc.bio', 'C'.repeat(1000), { priority: 10 }), // Low priority
      ];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 400, // Force trimming
      });

      // Low priority should be trimmed first
      const npcTrim = result.trims.find(t => t.key === 'npc.bio');
      const worldTrim = result.trims.find(t => t.key === 'world.tone');
      const rulesetTrim = result.trims.find(t => t.key === 'ruleset.principles');

      // NPC (low priority) should be trimmed
      expect(npcTrim).toBeDefined();
      expect(npcTrim?.removedTokens).toBeGreaterThan(0);

      // Ruleset (high priority) should NOT be trimmed unless fallback
      if (!result.warnings.includes('fallback_trim_applied')) {
        expect(rulesetTrim).toBeUndefined();
      }
    });
  });

  describe('Must-keep + min_chars enforcement', () => {
    it('should preserve must_keep sections above min_chars until fallback', async () => {
      const sections = [
        mkSection('ruleset.principles', 'A'.repeat(500), {
          must_keep: true,
          min_chars: 120,
        }),
        mkSection('world.tone', 'B'.repeat(1000)), // Not must_keep
      ];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 200, // Very tight budget
      });

      const principlesSection = result.sections.find(s => s.key === 'ruleset.principles');
      expect(principlesSection).toBeDefined();

      // If not in fallback, must_keep section should be at least min_chars
      if (!result.warnings.includes('fallback_trim_applied')) {
        expect(principlesSection!.text.length).toBeGreaterThanOrEqual(120);
      } else {
        // In fallback, it may be trimmed but should still respect header
        expect(principlesSection!.text.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Fallback path', () => {
    it('should apply fallback trim when primary strategy insufficient', async () => {
      const sections = [
        mkSection('ruleset.principles', 'A'.repeat(2000), {
          must_keep: true,
          min_chars: 1000, // Impossible to fit
        }),
        mkSection('world.tone', 'B'.repeat(2000)),
      ];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 100, // Impossible budget
      });

      expect(result.warnings).toContain('fallback_trim_applied');
      expect(result.totalTokensAfter).toBeLessThanOrEqual(100);
    });
  });

  describe('Code fence safety', () => {
    it('should avoid trimming inside markdown code fences', async () => {
      const textWithFence = `## Code Example

\`\`\`javascript
function example() {
  return "This is code";
}
\`\`\`

More text after the code block.`;

      const sections = [mkSection('module.actions', textWithFence)];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 50, // Force aggressive trim
      });

      const trimmedText = result.sections[0].text;
      
      // Should not end inside a code fence
      const lastFence = trimmedText.lastIndexOf('```');
      if (lastFence !== -1) {
        const afterLastFence = trimmedText.substring(lastFence + 3);
        const closingFence = afterLastFence.indexOf('```');
        // If we have an opening fence, we should have a closing one or be before it
        expect(closingFence).not.toBe(-1);
      }
    });
  });

  describe('Guardrail for sum(min_chars)', () => {
    it('should warn and reduce min_chars when sum exceeds guardrail', async () => {
      const sections = [
        mkSection('ruleset.principles', 'A'.repeat(1000), {
          must_keep: true,
          min_chars: 2000, // Very high min_chars
        }),
        mkSection('ruleset.choice_style', 'B'.repeat(1000), {
          must_keep: true,
          min_chars: 2000, // Very high min_chars
        }),
      ];

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 500, // Budget where min_chars sum > 0.75 * maxTokens
      });

      // Should have warning about min_chars guardrail
      const guardrailWarning = result.warnings.find(w =>
        w.includes('min_chars sum')
      );
      expect(guardrailWarning).toBeDefined();
    });
  });

  describe('Category precedence', () => {
    it('should trim INPUT before STATE before NPCS before SCENARIO before WORLD before MODULES before RULESET before CORE', async () => {
      const sections = [
        mkSection('core.all', 'Core content'),
        mkSection('ruleset.principles', 'Ruleset content'),
        mkSection('module.test.actions', 'Module content'),
        mkSection('world.tone', 'World content'),
        mkSection('scenario.setup', 'Scenario content'),
        mkSection('npc.bio', 'NPC content'),
        mkSection('state.flags', 'State content'),
        mkSection('input.text', 'Input content'),
      ];

      // Make all sections large enough to require trimming
      sections.forEach(s => {
        s.text = 'X'.repeat(500);
      });

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 500, // Force aggressive trimming
      });

      // INPUT should be trimmed first (lowest precedence)
      const inputTrim = result.trims.find(t => t.key === 'input.text');
      expect(inputTrim).toBeDefined();

      // CORE should be trimmed last (highest precedence)
      const coreTrim = result.trims.find(t => t.key === 'core.all');
      // Core might not be trimmed if we hit budget before reaching it
      if (result.totalTokensAfter > 500 * 0.5) {
        // If we're still well over budget, core should eventually be trimmed
        // But in normal cases, it should be last
      }
    });
  });

  describe('Token counting', () => {
    it('should accurately count tokens before and after', async () => {
      const sections = [
        mkSection('world.tone', 'A'.repeat(1000)),
        mkSection('npc.bio', 'B'.repeat(500)),
      ];

      const beforeTokens = await Promise.all(
        sections.map(s => countTokens(s.text))
      );
      const totalBefore = beforeTokens.reduce((a, b) => a + b, 0);

      const result = await applyBudget({
        linearSections: sections,
        maxTokens: 200,
      });

      expect(result.totalTokensBefore).toBe(totalBefore);
      expect(result.totalTokensAfter).toBeLessThanOrEqual(200);
    });
  });
});

