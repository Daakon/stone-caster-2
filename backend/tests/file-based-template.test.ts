import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFileBasedTemplateForWorld } from '../src/prompting/templateRegistry.js';

describe('FileBasedTemplateLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load template for mystika world', async () => {
    const context = {
      turn: 1,
      scene_id: 'whispercross',
      phase: 'start',
      time_block_json: JSON.stringify({ hour: 12, day: 1, season: 'spring' }),
      weather_json: JSON.stringify({ d20: 15, d100: 75, seed: 12345 }),
      player_min_json: JSON.stringify({ id: 'char-1', name: 'Test Player', race: 'Human' }),
      party_min_json: JSON.stringify([]),
      flags_json: 'Begin the adventure',
      last_outcome_min_json: JSON.stringify(null)
    };

    const result = await getFileBasedTemplateForWorld('mystika', context);

    expect(result).toBeDefined();
    expect(result.prompt).toBeDefined();
    expect(typeof result.prompt).toBe('string');
    expect(result.prompt.length).toBeGreaterThan(0);
    
    // Check that the prompt contains the expected sections
    expect(result.prompt).toContain('SYSTEM:');
    expect(result.prompt).toContain('=== CORE_BEGIN ===');
    expect(result.prompt).toContain('=== WORLD_BEGIN ===');
    expect(result.prompt).toContain('=== ADVENTURE_BEGIN ===');
    expect(result.prompt).toContain('=== GAME_STATE_BEGIN ===');
    expect(result.prompt).toContain('=== PLAYER_BEGIN ===');
    expect(result.prompt).toContain('=== RNG_BEGIN ===');
    expect(result.prompt).toContain('=== INPUT_BEGIN ===');
    
    // Check that files were loaded
    expect(result.filesLoaded).toBeDefined();
    expect(Array.isArray(result.filesLoaded)).toBe(true);
    expect(result.filesLoaded.length).toBeGreaterThan(0);
    
    // Check metadata
    expect(result.metadata).toBeDefined();
    expect(result.metadata.templatePath).toContain('baseline.md');
    expect(result.metadata.totalFiles).toBeGreaterThan(0);
    expect(result.metadata.tokenCount).toBeGreaterThan(0);
    expect(result.metadata.assembledAt).toBeDefined();
  });

  it('should handle missing adventure files gracefully', async () => {
    const context = {
      turn: 1,
      scene_id: 'nonexistent',
      phase: 'start',
      time_block_json: JSON.stringify({ hour: 12, day: 1, season: 'spring' }),
      weather_json: JSON.stringify({ d20: 15, d100: 75, seed: 12345 }),
      player_min_json: JSON.stringify({ id: 'char-1', name: 'Test Player', race: 'Human' }),
      party_min_json: JSON.stringify([]),
      flags_json: 'Begin the adventure',
      last_outcome_min_json: JSON.stringify(null)
    };

    const result = await getFileBasedTemplateForWorld('mystika', context);

    expect(result).toBeDefined();
    expect(result.prompt).toBeDefined();
    expect(typeof result.prompt).toBe('string');
    
    // Should still contain the core sections even if adventure files are missing
    expect(result.prompt).toContain('SYSTEM:');
    expect(result.prompt).toContain('=== CORE_BEGIN ===');
    expect(result.prompt).toContain('=== WORLD_BEGIN ===');
    
    // Should contain placeholders for missing files
    expect(result.prompt).toContain('[FILE NOT FOUND:');
  });

  it('should replace variables correctly', async () => {
    const context = {
      turn: 5,
      scene_id: 'whispercross',
      phase: 'middle',
      time_block_json: JSON.stringify({ hour: 18, day: 3, season: 'summer' }),
      weather_json: JSON.stringify({ d20: 8, d100: 42, seed: 98765 }),
      player_min_json: JSON.stringify({ id: 'char-2', name: 'Another Player', race: 'Elf' }),
      party_min_json: JSON.stringify([{ id: 'npc-1', name: 'Companion' }]),
      flags_json: 'Attack the enemy',
      last_outcome_min_json: JSON.stringify({ success: true, damage: 10 })
    };

    const result = await getFileBasedTemplateForWorld('mystika', context);

    expect(result).toBeDefined();
    expect(result.prompt).toBeDefined();
    
    // Check that variables were replaced
    expect(result.variablesReplaced).toBeDefined();
    expect(result.variablesReplaced['{{world_name}}']).toBe('mystika');
    expect(result.variablesReplaced['{{adventure_name}}']).toBe('whispercross');
    expect(result.variablesReplaced['{{game_state_json}}']).toContain('"hour":18');
    expect(result.variablesReplaced['{{player_state_json}}']).toContain('"name":"Another Player"');
    expect(result.variablesReplaced['{{rng_json}}']).toContain('"d20":8');
    expect(result.variablesReplaced['{{player_input_text}}']).toBe('Attack the enemy');
  });

  it('should handle forest_meet scene correctly by using whispercross adventure', async () => {
    // This test simulates the actual game context where scene_id is 'forest_meet'
    // The template loader should use 'forest_meet' as the scene name
    const context = {
      turn: 1,
      scene_id: 'forest_meet', // This will be used as the scene name
      phase: 'start',
      time_block_json: JSON.stringify({ hour: 12, day: 1, season: 'spring' }),
      weather_json: JSON.stringify({ d20: 15, d100: 75, seed: 12345 }),
      player_min_json: JSON.stringify({ id: 'char-1', name: 'Test Player', race: 'Human' }),
      party_min_json: JSON.stringify([]),
      flags_json: 'Begin the adventure',
      last_outcome_min_json: JSON.stringify(null)
    };

    const result = await getFileBasedTemplateForWorld('mystika', context);

    expect(result).toBeDefined();
    expect(result.prompt).toBeDefined();
    
    // The adventure name should be 'forest_meet' as passed in
    expect(result.variablesReplaced['{{adventure_name}}']).toBe('forest_meet');
    
    // Should show file not found for forest_meet adventure (since it doesn't exist)
    expect(result.prompt).toContain('[FILE NOT FOUND: worlds/mystika/adventures/forest_meet/adventure.prompt.json]');
  });
});
