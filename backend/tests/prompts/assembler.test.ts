import { describe, it, expect, beforeAll } from 'vitest';
import { PromptAssembler } from '../../src/prompts/assembler.js';
import type { PromptContext } from '../../src/prompts/schemas.js';

describe('PromptAssembler', () => {
  let assembler: PromptAssembler;

  beforeAll(async () => {
    assembler = new PromptAssembler();
    await assembler.initialize();
  });

  it('should initialize successfully', async () => {
    expect(assembler).toBeDefined();
  });

  it('should get available worlds', async () => {
    const worlds = await assembler.getAvailableWorlds();
    expect(Array.isArray(worlds)).toBe(true);
  });

  it('should validate context', () => {
    const validContext: PromptContext = {
      game: {
        id: 'test-game',
        turn_index: 0,
        summary: 'Test game',
        current_scene: 'test-scene',
        state_snapshot: {},
        option_id: 'test-option',
      },
      world: {
        name: 'Test World',
        setting: 'Test setting',
        genre: 'fantasy',
        themes: ['adventure'],
        rules: {},
        mechanics: {},
        lore: 'Test lore',
        logic: {},
      },
      system: {
        schema_version: '1.0.0',
        prompt_version: '1.0.0',
        load_order: [],
        hash: 'test-hash',
      },
    };

    const validation = assembler.validateContext(validContext);
    expect(validation.valid).toBe(true);
    expect(validation.missing).toHaveLength(0);
  });

  it('should detect missing required context', () => {
    const invalidContext: Partial<PromptContext> = {
      game: {
        id: 'test-game',
        turn_index: 0,
        summary: 'Test game',
        current_scene: 'test-scene',
        state_snapshot: {},
        option_id: 'test-option',
      },
      // Missing world and system
    };

    const validation = assembler.validateContext(invalidContext as PromptContext);
    expect(validation.valid).toBe(false);
    expect(validation.missing.length).toBeGreaterThan(0);
  });

  it('should assemble prompt for default world', async () => {
    const context: PromptContext = {
      game: {
        id: 'test-game',
        turn_index: 0,
        summary: 'Test game',
        current_scene: 'test-scene',
        state_snapshot: {},
        option_id: 'test-option',
      },
      world: {
        name: 'default',
        setting: 'Test setting',
        genre: 'fantasy',
        themes: ['adventure'],
        rules: {},
        mechanics: {},
        lore: 'Test lore',
        logic: {},
      },
      system: {
        schema_version: '1.0.0',
        prompt_version: '1.0.0',
        load_order: [],
        hash: 'test-hash',
      },
    };

    const result = await assembler.assemblePrompt(context);
    
    expect(result).toBeDefined();
    expect(result.prompt).toBeDefined();
    expect(typeof result.prompt).toBe('string');
    expect(result.prompt.length).toBeGreaterThan(0);
    
    expect(result.audit).toBeDefined();
    expect(result.audit.templateIds).toBeDefined();
    expect(Array.isArray(result.audit.templateIds)).toBe(true);
    expect(result.audit.contextSummary).toBeDefined();
    expect(result.audit.assembledAt).toBeDefined();
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata.totalSegments).toBeGreaterThan(0);
    expect(result.metadata.loadOrder).toBeDefined();
  });
});






