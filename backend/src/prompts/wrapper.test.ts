/**
 * Unit tests for the prompt wrapper system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptWrapper, type GameStateData } from './wrapper.js';
import type { PromptContext } from './schemas.js';

describe('PromptWrapper', () => {
  let wrapper: PromptWrapper;
  let mockContext: PromptContext;
  let mockGameState: GameStateData;

  beforeEach(() => {
    wrapper = new PromptWrapper();
    
    mockContext = {
      game: {
        id: 'test-game-123',
        turn_index: 5,
        summary: 'Test game turn 6',
        current_scene: 'test-scene',
        state_snapshot: { test: 'data' },
        option_id: 'test-option',
      },
      world: {
        name: 'test-world',
        setting: 'A test world',
        genre: 'fantasy',
        themes: ['magic', 'adventure'],
        rules: {},
        mechanics: {},
        lore: 'Test lore',
        logic: {},
      },
      character: {
        name: 'Test Character',
        race: 'human',
        skills: { stealth: 50, magic: 60 },
        inventory: ['sword', 'potion'],
        relationships: {},
        goals: { short_term: ['survive'], long_term: ['become hero'] },
        flags: {},
        reputation: {},
      },
      adventure: {
        name: 'test-adventure',
        scenes: [],
        objectives: ['complete quest'],
        npcs: [],
        places: [],
        triggers: [],
      },
      runtime: {
        ticks: 5,
        presence: 'present',
        ledgers: {},
        flags: {},
        last_acts: [],
        style_hint: 'neutral',
      },
      system: {
        schema_version: '1.0.0',
        prompt_version: '2.0.0',
        load_order: [],
        hash: 'test-hash',
      },
    };

    mockGameState = {
      time: {
        band: 'mid_day_to_evening',
        ticks: 30,
      },
      rng: {
        policy: 'd20 for checks, d100 for chance rolls',
        d20: 15,
        d100: 75,
      },
      playerInput: 'Look around carefully',
      isFirstTurn: false,
    };
  });

  describe('RNG Data Generation', () => {
    it('should generate RNG data with policy and values', () => {
      const rngData = wrapper.generateRNGData();
      
      expect(rngData.policy).toBe('d20 for checks, d100 for chance rolls');
      expect(rngData.d20).toBeGreaterThanOrEqual(1);
      expect(rngData.d20).toBeLessThanOrEqual(20);
      expect(rngData.d100).toBeGreaterThanOrEqual(1);
      expect(rngData.d100).toBeLessThanOrEqual(100);
    });
  });

  describe('Time Data Generation', () => {
    it('should generate time data with correct band and ticks', () => {
      const timeData = wrapper.generateTimeData(90);
      
      expect(['dawn_to_mid_day', 'mid_day_to_evening', 'evening_to_mid_night', 'mid_night_to_dawn'])
        .toContain(timeData.band);
      expect(timeData.ticks).toBeGreaterThanOrEqual(0);
      expect(timeData.ticks).toBeLessThan(60);
    });

    it('should cycle through bands correctly', () => {
      const time0 = wrapper.generateTimeData(0);
      const time60 = wrapper.generateTimeData(60);
      const time120 = wrapper.generateTimeData(120);
      
      expect(time0.band).toBe('dawn_to_mid_day');
      expect(time60.band).toBe('mid_day_to_evening');
      expect(time120.band).toBe('evening_to_mid_night');
    });
  });

  describe('Player Input Resolution', () => {
    it('should resolve choice ID to label', () => {
      const choices = [
        { id: 'choice-1', label: 'Look around' },
        { id: 'choice-2', label: 'Continue forward' },
        { id: 'choice-3', label: 'Check inventory' },
      ];
      
      const resolved = wrapper.resolvePlayerInput('choice-2', choices);
      expect(resolved).toBe('Continue forward');
    });

    it('should return optionId if choice not found', () => {
      const choices = [
        { id: 'choice-1', label: 'Look around' },
      ];
      
      const resolved = wrapper.resolvePlayerInput('unknown-choice', choices);
      expect(resolved).toBe('unknown-choice');
    });
  });

  describe('Content Fixes Validation', () => {
    it('should validate RNG policy presence', () => {
      const gameState: GameStateData = {
        time: { band: 'mid_day_to_evening', ticks: 30 },
        rng: { policy: 'd20 for checks, d100 for chance rolls', d20: 15, d100: 75 },
        playerInput: 'Look around',
        isFirstTurn: false,
      };

      const validation = wrapper.validateContentFixes(gameState, {}, {}, {});
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing RNG policy', () => {
      const gameState: GameStateData = {
        time: { band: 'mid_day_to_evening', ticks: 30 },
        rng: { policy: '', d20: 0, d100: 0 },
        playerInput: 'Look around',
        isFirstTurn: false,
      };

      const validation = wrapper.validateContentFixes(gameState, {}, {}, {});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('RNG policy and values must be present each turn');
    });

    it('should validate time format uses bands + ticks', () => {
      const gameState: GameStateData = {
        time: { band: 'mid_day_to_evening', ticks: 30 },
        rng: { policy: 'd20 for checks, d100 for chance rolls', d20: 15, d100: 75 },
        playerInput: 'Look around',
        isFirstTurn: false,
      };

      const validation = wrapper.validateContentFixes(gameState, {}, {}, {});
      expect(validation.valid).toBe(true);
    });

    it('should detect invalid time format', () => {
      const gameState: GameStateData = {
        time: { band: '', ticks: NaN },
        rng: { policy: 'd20 for checks, d100 for chance rolls', d20: 15, d100: 75 },
        playerInput: 'Look around',
        isFirstTurn: false,
      };

      const validation = wrapper.validateContentFixes(gameState, {}, {}, {});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Time must use band + ticks format');
    });

    it('should detect UUID input instead of text', () => {
      const gameState: GameStateData = {
        time: { band: 'mid_day_to_evening', ticks: 30 },
        rng: { policy: 'd20 for checks, d100 for chance rolls', d20: 15, d100: 75 },
        playerInput: '123e4567-e89b-12d3-a456-426614174000',
        isFirstTurn: false,
      };

      const validation = wrapper.validateContentFixes(gameState, {}, {}, {});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Player input must be text, not UUID');
    });

    it('should validate band naming consistency', () => {
      const gameState: GameStateData = {
        time: { band: 'mid_day_to_evening', ticks: 30 },
        rng: { policy: 'd20 for checks, d100 for chance rolls', d20: 15, d100: 75 },
        playerInput: 'Look around',
        isFirstTurn: false,
      };

      // Create data with both correct and incorrect forms in the same object
      const coreData = { time: 'mid-day', other: 'midday' }; // Mixed naming
      const worldData = { time: 'mid-night' };
      const adventureData = { time: 'midnight' }; // Inconsistent naming

      const validation = wrapper.validateContentFixes(gameState, coreData, worldData, adventureData);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Band names must use mid-day and mid-night consistently');
    });
  });

  describe('Prompt Assembly', () => {
    it('should assemble prompt with correct section order', async () => {
      const result = await wrapper.assemblePrompt(
        mockContext,
        mockGameState,
        { core: 'test-core' },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      expect(result.prompt).toContain('You are the runtime engine');
      expect(result.prompt).toContain('=== CORE_BEGIN ===');
      expect(result.prompt).toContain('=== WORLD_BEGIN ===');
      expect(result.prompt).toContain('=== ADVENTURE_BEGIN ===');
      expect(result.prompt).toContain('=== PLAYER_BEGIN ===');
      expect(result.prompt).toContain('=== RNG_BEGIN ===');
      expect(result.prompt).toContain('=== INPUT_BEGIN ===');
    });

    it('should include GAME_STATE section only on first turn', async () => {
      const firstTurnState = { ...mockGameState, isFirstTurn: true };
      
      const result = await wrapper.assemblePrompt(
        mockContext,
        firstTurnState,
        { core: 'test-core' },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      expect(result.prompt).toContain('=== GAME_STATE_BEGIN ===');
    });

    it('should not include GAME_STATE section on subsequent turns', async () => {
      const result = await wrapper.assemblePrompt(
        mockContext,
        mockGameState,
        { core: 'test-core' },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      expect(result.prompt).not.toContain('=== GAME_STATE_BEGIN ===');
    });

    it('should minify JSON in sections', async () => {
      const result = await wrapper.assemblePrompt(
        mockContext,
        mockGameState,
        { core: 'test-core', nested: { data: 'value' } },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      // Check that JSON is minified (no spaces/newlines)
      expect(result.prompt).toContain('{"core":"test-core","nested":{"data":"value"}}');
      expect(result.prompt).not.toContain('  '); // No indentation
    });

    it('should collapse redundant blank lines', async () => {
      const result = await wrapper.assemblePrompt(
        mockContext,
        mockGameState,
        { core: 'test-core' },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      // Should not have more than 2 consecutive newlines
      expect(result.prompt).not.toMatch(/\n{3,}/);
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata', async () => {
      const result = await wrapper.assemblePrompt(
        mockContext,
        mockGameState,
        { core: 'test-core' },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      expect(result.metadata.sections).toEqual([
        'SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'
      ]);
      expect(result.metadata.tokenCount).toBeGreaterThan(0);
      expect(result.metadata.assembledAt).toBeDefined();
    });

    it('should include GAME_STATE in metadata on first turn', async () => {
      const firstTurnState = { ...mockGameState, isFirstTurn: true };
      
      const result = await wrapper.assemblePrompt(
        mockContext,
        firstTurnState,
        { core: 'test-core' },
        { world: 'test-world' },
        { adventure: 'test-adventure' },
        { player: 'test-player' }
      );

      expect(result.metadata.sections).toContain('GAME_STATE');
    });
  });
});
