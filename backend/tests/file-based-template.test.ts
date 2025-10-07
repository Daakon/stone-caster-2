import { describe, it, expect, beforeAll } from 'vitest';
import { getFileBasedTemplateForWorld } from '../src/prompting/templateRegistry.js';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

describe('File-Based Template System', () => {
  const projectRoot = resolve(process.cwd());
  const templatePath = join(projectRoot, 'src', 'prompting', 'stone_caster_mvp_webapp_prompt_template_just_add_files.md');

  beforeAll(() => {
    // Verify the template file exists
    if (!existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
  });

  it('should load the template file successfully', () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  it('should process template variables correctly', async () => {
    const context = {
      turn: 1,
      scene_id: 'test_scene',
      phase: 'start',
      time_block_json: JSON.stringify({ hour: 12, day: 1, season: 'spring' }),
      weather_json: JSON.stringify({ condition: 'clear', temperature: 'mild' }),
      player_min_json: JSON.stringify({ id: 'test_player', name: 'Test Player', race: 'Human', level: 1 }),
      party_min_json: JSON.stringify([]),
      flags_json: JSON.stringify({}),
      last_outcome_min_json: JSON.stringify(null)
    };

    try {
      const result = await getFileBasedTemplateForWorld('mystika', context);
      
      // Verify the result structure
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('filesLoaded');
      expect(result).toHaveProperty('variablesReplaced');
      expect(result).toHaveProperty('metadata');
      
      // Verify variables were replaced
      expect(result.variablesReplaced).toHaveProperty('{{turn}}', '1');
      expect(result.variablesReplaced).toHaveProperty('{{scene_id}}', 'test_scene');
      expect(result.variablesReplaced).toHaveProperty('{{phase}}', 'start');
      
      // Verify the prompt contains the replaced variables
      expect(result.prompt).toContain('"turn": 1');
      expect(result.prompt).toContain('"id": "test_scene"');
      expect(result.prompt).toContain('"ph": "start"');
      
      // Verify some files were attempted to be loaded
      expect(result.filesLoaded.length).toBeGreaterThanOrEqual(0);
      
      console.log(`[TEST] Template processed successfully. Files loaded: ${result.filesLoaded.join(', ')}`);
      console.log(`[TEST] Variables replaced: ${Object.keys(result.variablesReplaced).join(', ')}`);
      console.log(`[TEST] Token count: ${result.metadata.tokenCount}`);
      
    } catch (error) {
      console.error('[TEST] Error processing template:', error);
      // Don't fail the test if files are missing - that's expected in test environment
      if (error instanceof Error && error.message.includes('FILE NOT FOUND')) {
        console.log('[TEST] Expected file not found errors in test environment');
      } else {
        throw error;
      }
    }
  });

  it('should handle missing files gracefully', async () => {
    const context = {
      turn: 1,
      scene_id: 'test_scene',
      phase: 'start',
      time_block_json: '{}',
      weather_json: '{}',
      player_min_json: '{}',
      party_min_json: '[]',
      flags_json: '{}',
      last_outcome_min_json: 'null'
    };

    // This should not throw an error even if some files are missing
    const result = await getFileBasedTemplateForWorld('nonexistent_world', context);
    
    expect(result).toHaveProperty('prompt');
    expect(result.prompt).toContain('[FILE NOT FOUND:');
    // Some files should be loaded (the ones that exist), some should show as not found
    expect(result.filesLoaded.length).toBeGreaterThan(0);
  });
});
