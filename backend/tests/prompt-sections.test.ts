import { describe, it, expect, beforeEach } from 'vitest';
import { PromptWrapper } from '../src/prompts/wrapper.js';
import type { PromptContext, GameStateData } from '../src/prompts/wrapper.js';

describe('Prompt Sections Validation', () => {
  let promptWrapper: PromptWrapper;

  beforeEach(() => {
    promptWrapper = new PromptWrapper();
  });

  it('should include CORE section in generated prompt', async () => {
    const context: PromptContext = {
      game: {
        id: 'test-game',
        turn_index: 0,
        summary: 'Test Game',
        current_scene: 'forest_meet',
        state_snapshot: {},
        option_id: 'game_start',
      },
      world: {
        name: 'mystika',
        setting: 'A world of magic and adventure',
        genre: 'fantasy',
        themes: ['magic', 'adventure', 'mystery'],
        rules: {},
        mechanics: {},
        lore: '',
        logic: {},
      },
      character: {
        name: 'Test Character',
        race: 'Elf',
        class: 'Wizard',
        level: 1,
        skills: {},
        inventory: [],
        relationships: {},
        goals: { short_term: [], long_term: [] },
        flags: {},
        reputation: {},
      },
      adventure: {
        name: 'Test Adventure',
        scenes: [],
        objectives: [],
        npcs: [],
        places: [],
        triggers: [],
      },
      runtime: {
        ticks: 0,
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
        hash: 'wrapper-v1',
      },
    };

    const gameState: GameStateData = {
      time: { band: 'dawn_to_mid_day', ticks: 0 },
      rng: { d20: 10, d100: 50, seed: 12345, policy: 'd20 for checks, d100 for chance rolls' },
      playerInput: 'Begin the adventure "adventure_test" from its starting scene "forest_meet".',
      isFirstTurn: true,
    };

    const result = await promptWrapper.assemblePrompt(
      context,
      gameState,
      { core: 'system' },
      { world: context.world },
      { adventure: context.adventure },
      { player: context.character }
    );

    // Check that CORE section is present
    expect(result.prompt).toContain('=== CORE_BEGIN ===');
    expect(result.prompt).toContain('=== CORE_END ===');
    expect(result.prompt).toContain('{"core":"system"}');
  });

  it('should include WORLD section in generated prompt', async () => {
    const context: PromptContext = {
      game: {
        id: 'test-game',
        turn_index: 0,
        summary: 'Test Game',
        current_scene: 'forest_meet',
        state_snapshot: {},
        option_id: 'game_start',
      },
      world: {
        name: 'mystika',
        setting: 'A world of magic and adventure',
        genre: 'fantasy',
        themes: ['magic', 'adventure', 'mystery'],
        rules: {},
        mechanics: {},
        lore: '',
        logic: {},
      },
      character: {
        name: 'Test Character',
        race: 'Elf',
        class: 'Wizard',
        level: 1,
        skills: {},
        inventory: [],
        relationships: {},
        goals: { short_term: [], long_term: [] },
        flags: {},
        reputation: {},
      },
      adventure: {
        name: 'Test Adventure',
        scenes: [],
        objectives: [],
        npcs: [],
        places: [],
        triggers: [],
      },
      runtime: {
        ticks: 0,
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
        hash: 'wrapper-v1',
      },
    };

    const gameState: GameStateData = {
      time: { band: 'dawn_to_mid_day', ticks: 0 },
      rng: { d20: 10, d100: 50, seed: 12345, policy: 'd20 for checks, d100 for chance rolls' },
      playerInput: 'Begin the adventure "adventure_test" from its starting scene "forest_meet".',
      isFirstTurn: true,
    };

    const result = await promptWrapper.assemblePrompt(
      context,
      gameState,
      { core: 'system' },
      { world: context.world },
      { adventure: context.adventure },
      { player: context.character }
    );

    // Check that WORLD section is present
    expect(result.prompt).toContain('=== WORLD_BEGIN ===');
    expect(result.prompt).toContain('=== WORLD_END ===');
    expect(result.prompt).toContain('"name":"mystika"');
    expect(result.prompt).toContain('"setting":"A world of magic and adventure"');
  });

  it('should include all required sections in correct order', async () => {
    const context: PromptContext = {
      game: {
        id: 'test-game',
        turn_index: 0,
        summary: 'Test Game',
        current_scene: 'forest_meet',
        state_snapshot: {},
        option_id: 'game_start',
      },
      world: {
        name: 'mystika',
        setting: 'A world of magic and adventure',
        genre: 'fantasy',
        themes: ['magic', 'adventure', 'mystery'],
        rules: {},
        mechanics: {},
        lore: '',
        logic: {},
      },
      character: {
        name: 'Test Character',
        race: 'Elf',
        class: 'Wizard',
        level: 1,
        skills: {},
        inventory: [],
        relationships: {},
        goals: { short_term: [], long_term: [] },
        flags: {},
        reputation: {},
      },
      adventure: {
        name: 'Test Adventure',
        scenes: [],
        objectives: [],
        npcs: [],
        places: [],
        triggers: [],
      },
      runtime: {
        ticks: 0,
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
        hash: 'wrapper-v1',
      },
    };

    const gameState: GameStateData = {
      time: { band: 'dawn_to_mid_day', ticks: 0 },
      rng: { d20: 10, d100: 50, seed: 12345, policy: 'd20 for checks, d100 for chance rolls' },
      playerInput: 'Begin the adventure "adventure_test" from its starting scene "forest_meet".',
      isFirstTurn: true,
    };

    const result = await promptWrapper.assemblePrompt(
      context,
      gameState,
      { core: 'system' },
      { world: context.world },
      { adventure: context.adventure },
      { player: context.character }
    );

    // Check that all required sections are present
    expect(result.prompt).toContain('=== CORE_BEGIN ===');
    expect(result.prompt).toContain('=== WORLD_BEGIN ===');
    expect(result.prompt).toContain('=== ADVENTURE_BEGIN ===');
    expect(result.prompt).toContain('=== GAME_STATE_BEGIN ===');
    expect(result.prompt).toContain('=== PLAYER_BEGIN ===');
    expect(result.prompt).toContain('=== RNG_BEGIN ===');
    expect(result.prompt).toContain('=== INPUT_BEGIN ===');

    // Check that sections are in correct order
    const coreIndex = result.prompt.indexOf('=== CORE_BEGIN ===');
    const worldIndex = result.prompt.indexOf('=== WORLD_BEGIN ===');
    const adventureIndex = result.prompt.indexOf('=== ADVENTURE_BEGIN ===');
    const gameStateIndex = result.prompt.indexOf('=== GAME_STATE_BEGIN ===');
    const playerIndex = result.prompt.indexOf('=== PLAYER_BEGIN ===');
    const rngIndex = result.prompt.indexOf('=== RNG_BEGIN ===');
    const inputIndex = result.prompt.indexOf('=== INPUT_BEGIN ===');

    expect(coreIndex).toBeLessThan(worldIndex);
    expect(worldIndex).toBeLessThan(adventureIndex);
    expect(adventureIndex).toBeLessThan(gameStateIndex);
    expect(gameStateIndex).toBeLessThan(playerIndex);
    expect(playerIndex).toBeLessThan(rngIndex);
    expect(rngIndex).toBeLessThan(inputIndex);
  });
});
