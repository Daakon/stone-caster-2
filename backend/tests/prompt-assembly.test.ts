import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssembler } from '../src/prompts/assembler.js';
import type { PromptContext } from '../src/prompts/schemas.js';

describe('Prompt Assembly', () => {
  let assembler: PromptAssembler;

  beforeEach(() => {
    assembler = new PromptAssembler();
  });

  describe('initialize', () => {
    it('should load prompt templates for mystika world', async () => {
      await assembler.initialize('mystika');
      
      // The assembler should have loaded templates
      expect(assembler).toBeDefined();
    });
  });

  describe('assemblePrompt', () => {
    it('should assemble a complete prompt with embedded content', async () => {
      await assembler.initialize('mystika');
      
      const context: PromptContext = {
        game: {
          id: 'test-game-123',
          turn_index: 0,
          summary: 'Test game',
          current_scene: 'forest_meet',
          state_snapshot: {},
          option_id: 'game_start'
        },
        world: {
          name: 'mystika',
          setting: 'A world of magic and adventure',
          genre: 'fantasy',
          themes: ['magic', 'adventure', 'mystery'],
          rules: {},
          mechanics: {},
          lore: '',
          logic: {}
        },
        character: {
          name: 'Thorne Shifter',
          skills: ['combat', 'stealth', 'social', 'lore', 'survival', 'medicine', 'craft'],
          traits: {},
          inventory: [],
          relationships: {},
          goals: {
            short_term: [],
            long_term: []
          },
          flags: {},
          reputation: {}
        },
        adventure: {
          name: 'Whispercross Opening',
          scenes: [],
          objectives: [],
          npcs: [],
          places: [],
          triggers: []
        },
        runtime: {
          ticks: 0,
          presence: 'present',
          ledgers: {},
          flags: {},
          last_acts: [],
          style_hint: 'neutral'
        },
        system: {
          schema_version: '1.0.0',
          prompt_version: '2.0.0',
          load_order: [],
          hash: 'test-hash'
        }
      };

      const result = await assembler.assemblePrompt(context);
      
      // Verify the prompt was assembled
      expect(result.prompt).toBeDefined();
      expect(result.prompt.length).toBeGreaterThan(1000); // Should be substantial content
      
      // Verify it contains actual AI prompt content (not placeholders)
      expect(result.prompt).toContain('You are the runtime engine');
      expect(result.prompt).toContain('Return ONE JSON object (AWF)');
      expect(result.prompt).toContain('TIME_ADVANCE');
      expect(result.prompt).toContain('essence alignment');
      
      // Should NOT contain placeholder text
      expect(result.prompt).not.toContain('<<<FILE');
      expect(result.prompt).not.toContain('>>>');
      expect(result.prompt).not.toContain('{{world_name}}');
      expect(result.prompt).not.toContain('{{adventure_name}}');
      
      // Should contain actual world content
      expect(result.prompt).toContain('Mystika');
      expect(result.prompt).toContain('magic and adventure');
      
      // Should contain proper section delimiters
      expect(result.prompt).toContain('=== CORE_BEGIN ===');
      expect(result.prompt).toContain('=== WORLD_BEGIN ===');
      expect(result.prompt).toContain('=== ADVENTURE_BEGIN ===');
      expect(result.prompt).toContain('=== PLAYER_BEGIN ===');
      expect(result.prompt).toContain('=== RNG_BEGIN ===');
      expect(result.prompt).toContain('=== INPUT_BEGIN ===');
      
      console.log('Assembled prompt length:', result.prompt.length);
      console.log('Prompt preview:', result.prompt.substring(0, 500) + '...');
    });

    it('should include proper JSON sections with actual data', async () => {
      await assembler.initialize('mystika');
      
      const context: PromptContext = {
        game: {
          id: 'test-game-123',
          turn_index: 0,
          summary: 'Test game',
          current_scene: 'forest_meet',
          state_snapshot: {},
          option_id: 'game_start'
        },
        world: {
          name: 'mystika',
          setting: 'A world of magic and adventure',
          genre: 'fantasy',
          themes: ['magic', 'adventure', 'mystery'],
          rules: {},
          mechanics: {},
          lore: '',
          logic: {}
        },
        character: {
          name: 'Thorne Shifter',
          skills: ['combat', 'stealth', 'social', 'lore', 'survival', 'medicine', 'craft'],
          traits: {},
          inventory: [],
          relationships: {},
          goals: {
            short_term: [],
            long_term: []
          },
          flags: {},
          reputation: {}
        },
        adventure: {
          name: 'Whispercross Opening',
          scenes: [],
          objectives: [],
          npcs: [],
          places: [],
          triggers: []
        },
        runtime: {
          ticks: 0,
          presence: 'present',
          ledgers: {},
          flags: {},
          last_acts: [],
          style_hint: 'neutral'
        },
        system: {
          schema_version: '1.0.0',
          prompt_version: '2.0.0',
          load_order: [],
          hash: 'test-hash'
        }
      };

      const result = await assembler.assemblePrompt(context);
      
      // Check that JSON sections contain actual data, not placeholders
      const coreMatch = result.prompt.match(/=== CORE_BEGIN ===([\s\S]*?)=== CORE_END ===/);
      expect(coreMatch).toBeTruthy();
      expect(coreMatch![1].trim()).not.toBe('{}');
      expect(coreMatch![1].trim()).not.toContain('{{');
      
      const worldMatch = result.prompt.match(/=== WORLD_BEGIN ===([\s\S]*?)=== WORLD_END ===/);
      expect(worldMatch).toBeTruthy();
      expect(worldMatch![1].trim()).not.toBe('{}');
      expect(worldMatch![1].trim()).toContain('mystika');
      
      const playerMatch = result.prompt.match(/=== PLAYER_BEGIN ===([\s\S]*?)=== PLAYER_END ===/);
      expect(playerMatch).toBeTruthy();
      expect(playerMatch![1].trim()).not.toBe('{}');
      expect(playerMatch![1].trim()).toContain('Thorne Shifter');
    });
  });
});
