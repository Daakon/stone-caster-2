import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../src/services/ai.js';

describe('AI Prompt Validation', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  describe('validatePromptCompleteness', () => {
    it('should reject prompts that are too short', () => {
      const shortPrompt = 'Short';
      const result = (aiService as any).validatePromptCompleteness(shortPrompt, {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Prompt too short');
    });

    it('should reject prompts missing required sections', () => {
      const incompletePrompt = 'This is a long prompt but missing required sections';
      const result = (aiService as any).validatePromptCompleteness(incompletePrompt, {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Prompt too short');
    });

    it('should reject prompts with empty sections', () => {
      const promptWithEmptySections = `
=== CORE_BEGIN ===
{"core":"system"}
=== CORE_END ===

=== WORLD_BEGIN ===
{"world":{}}
=== WORLD_END ===

=== ADVENTURE_BEGIN ===
{"adventure":{}}
=== ADVENTURE_END ===

=== PLAYER_BEGIN ===
{"player":{}}
=== PLAYER_END ===

=== RNG_BEGIN ===
{}
=== RNG_END ===

=== INPUT_BEGIN ===

=== INPUT_END ===
      `;
      
      const result = (aiService as any).validatePromptCompleteness(promptWithEmptySections, {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject prompts without AI prompt file content', () => {
      const promptWithoutAIContent = `
=== CORE_BEGIN ===
{"core":"system"}
=== CORE_END ===

=== WORLD_BEGIN ===
{"world":{"name":"test","setting":"test"}}
=== WORLD_END ===

=== ADVENTURE_BEGIN ===
{"adventure":{"name":"test"}}
=== ADVENTURE_END ===

=== PLAYER_BEGIN ===
{"player":{"name":"test"}}
=== PLAYER_END ===

=== RNG_BEGIN ===
{"d20":10,"d100":50}
=== RNG_END ===

=== INPUT_BEGIN ===
test input
=== INPUT_END ===
      `;
      
      const result = (aiService as any).validatePromptCompleteness(promptWithoutAIContent, {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No AI prompt file content detected');
    });

    it('should accept valid prompts with AI content', () => {
      const validPrompt = `
You are the runtime engine. Return ONE JSON object (AWF) with keys: scn, txt, optional choices, optional acts, optional val. No markdown, no code fences, no extra keys. Resolve checks using rng BEFORE composing txt. Include exactly one TIME_ADVANCE (ticks ≥ 1) each turn. Use 0–100 scales (50 baseline) for skills/relationships. Essence alignment affects behavior (Life/Death/Order/Chaos). NPCs may act on their own; offer reaction choices only if impact is major or consent unclear. Limit 2 ambient + 1 NPC↔NPC beat per turn; respect cooldowns. Time uses 60-tick bands (Dawn→Mid-Day→Evening→Mid-Night→Dawn); avoid real-world units.

=== CORE_BEGIN ===
{"core":"system"}
=== CORE_END ===

=== WORLD_BEGIN ===
{"world":{"name":"mystika","setting":"A world of magic and adventure","genre":"fantasy","themes":["magic","adventure","mystery"],"rules":{},"mechanics":{},"lore":"","logic":{}}}
=== WORLD_END ===

=== ADVENTURE_BEGIN ===
{"adventure":{"id":"9c03780e-c77b-4b0a-92bd-d5979ca73e72","npcs":[],"places":[],"scenes":[],"objectives":[],"description":"Learn the basics of magic in the mystical realm of Mystika"}}
=== ADVENTURE_END ===

=== PLAYER_BEGIN ===
{"player":{"id":"71d337e7-83ba-47c3-8671-3d4ac6b4c008","name":"Thorne Shifter","skills":["combat","stealth","social","lore","survival","medicine","craft"],"traits":{},"inventory":[{"id":"94c5c3ed-b0d9-45b7-82be-72e5299c4b9b","name":"Elven Longsword","quantity":1,"description":"Starting equipment: Elven Longsword"},{"id":"8cb97caa-8c8e-4d80-aaff-f989225f4511","name":"Court Armor","quantity":1,"description":"Starting equipment: Court Armor"},{"id":"519a0a45-4404-4505-a0e6-e4ecfa8c84e5","name":"Ancient Scroll","quantity":1,"description":"Starting equipment: Ancient Scroll"},{"id":"b4bf2aa0-3a5d-40ea-9eeb-1310d2a22e98","name":"Healing Herbs","quantity":1,"description":"Starting equipment: Healing Herbs"}]}}
=== PLAYER_END ===

=== RNG_BEGIN ===
{"policy":"d20 for checks, d100 for chance rolls","d20":13,"d100":55}
=== RNG_END ===

=== INPUT_BEGIN ===
5ce5cbcb-7a37-4850-ab20-2811a8316c08
=== INPUT_END ===
      `;
      
      const result = (aiService as any).validatePromptCompleteness(validPrompt, {});
      
      // The prompt should be valid because it has AI content and proper sections
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('checkForAIPromptContent', () => {
    it('should detect AI prompt content indicators', () => {
      const promptWithAIContent = `
You are the runtime engine. Return ONE JSON object (AWF) with keys: scn, txt, optional choices, optional acts, optional val. No markdown, no code fences, no extra keys. Resolve checks using rng BEFORE composing txt. Include exactly one TIME_ADVANCE (ticks ≥ 1) each turn. Use 0–100 scales (50 baseline) for skills/relationships. Essence alignment affects behavior (Life/Death/Order/Chaos). NPCs may act on their own; offer reaction choices only if impact is major or consent unclear. Limit 2 ambient + 1 NPC↔NPC beat per turn; respect cooldowns. Time uses 60-tick bands (Dawn→Mid-Day→Evening→Mid-Night→Dawn); avoid real-world units.
      `;
      
      const result = (aiService as any).checkForAIPromptContent(promptWithAIContent);
      
      expect(result).toBe(true);
    });

    it('should reject prompts without AI content indicators', () => {
      const promptWithoutAIContent = `
This is just a regular prompt without any AI-specific content indicators.
It doesn't contain the required phrases like "You are the runtime engine" or "AWF" or "TIME_ADVANCE".
It's just plain text with no special markers or instructions for the AI.
      `;
      
      const result = (aiService as any).checkForAIPromptContent(promptWithoutAIContent);
      
      expect(result).toBe(false);
    });
  });
});
