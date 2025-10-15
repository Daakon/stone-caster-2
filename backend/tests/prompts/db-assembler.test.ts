import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabasePromptAssembler } from '../../src/prompts/db-assembler.js';
import { PromptRepository, type PromptSegment } from '../../src/repositories/prompt.repository.js';
import type { PromptContext } from '../../src/prompts/schemas.js';

// Mock the prompt repository
const mockPromptRepository = {
  getCachedPromptSegments: vi.fn(),
  clearCache: vi.fn(),
};

vi.mock('../../src/repositories/prompt.repository.js', () => ({
  PromptRepository: vi.fn().mockImplementation(() => mockPromptRepository),
}));

describe('DatabasePromptAssembler', () => {
  let assembler: DatabasePromptAssembler;
  let mockRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = mockPromptRepository;
    assembler = new DatabasePromptAssembler(mockRepository as any);
  });

  describe('assemblePrompt', () => {
    const mockContext: PromptContext = {
      character: {
        name: 'Test Character',
        race: 'Human',
        skills: { combat: 50, stealth: 60 },
        inventory: ['sword', 'potion'],
        relationships: { 'npc-1': 70 },
        goals: { short_term: ['find treasure'], long_term: ['save the world'] },
        flags: { has_sword: true },
        reputation: { 'town-1': 80 },
      },
      game: {
        id: 'game-123',
        turn_index: 5,
        summary: 'Adventure in progress',
        current_scene: 'forest-clearing',
        state_snapshot: { location: 'forest', time: 'day' },
        option_id: 'option-1',
      },
      world: {
        name: 'Mystika',
        setting: 'Fantasy world',
        genre: 'Fantasy',
        themes: ['magic', 'adventure'],
        rules: { magic_system: 'elemental' },
        mechanics: { combat: 'turn-based' },
        lore: 'Ancient magical world',
        logic: { physics: 'magical' },
      },
      adventure: {
        name: 'Whispercross',
        scenes: ['forest-clearing', 'ancient-ruins'],
        objectives: ['find the artifact', 'defeat the guardian'],
        npcs: [{ id: 'npc-1', name: 'Guide' }],
        places: [{ id: 'place-1', name: 'Forest' }],
        triggers: [{ id: 'trigger-1', condition: 'enters_forest' }],
      },
      runtime: {
        ticks: 150,
        presence: 'calm',
        ledgers: { gold: 100 },
        flags: { quest_started: true },
        last_acts: [{ type: 'MOVE', target: 'forest' }],
        style_hint: 'cinematic',
      },
      system: {
        schema_version: '1.0.0',
        prompt_version: '1.0.0',
        load_order: ['core', 'engine', 'content'],
        hash: 'test-hash',
      },
    };

    const mockSegments: PromptSegment[] = [
      {
        id: 'segment-1',
        layer: 'core',
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'any',
        sort_order: 1,
        version: '1.0.0',
        content: 'Core system instructions: You are a game master.',
        metadata: { variables: ['character.name'] },
      },
      {
        id: 'segment-2',
        layer: 'engine',
        world_slug: null,
        adventure_slug: null,
        scene_id: null,
        turn_stage: 'any',
        sort_order: 2,
        version: '1.0.0',
        content: 'Engine rules: Use AWF format for responses.',
        metadata: { variables: ['game.turn_index'] },
      },
      {
        id: 'segment-3',
        layer: 'content',
        world_slug: 'mystika',
        adventure_slug: 'whispercross',
        scene_id: null,
        turn_stage: 'any',
        sort_order: 3,
        version: '1.0.0',
        content: 'Adventure context: {{adventure.name}} in {{world.name}}.',
        metadata: { variables: ['adventure.name', 'world.name'] },
      },
    ];

    it('should assemble prompt from database segments', async () => {
      mockRepository.getCachedPromptSegments.mockResolvedValue(mockSegments);

      const result = await assembler.assemblePrompt(mockContext);

      expect(mockRepository.getCachedPromptSegments).toHaveBeenCalledWith({
        world_slug: 'mystika',
        adventure_slug: 'whispercross',
        include_start: false,
        scene_id: 'forest-clearing',
        include_enhancements: true,
      });

      expect(result.prompt).toContain('RPG Storyteller AI System');
      expect(result.prompt).toContain('Core system instructions: You are a game master.');
      expect(result.prompt).toContain('Engine rules: Use AWF format for responses.');
      expect(result.prompt).toContain('Adventure context: Whispercross in Mystika.');
      expect(result.audit.templateIds).toEqual(['segment-1', 'segment-2', 'segment-3']);
      expect(result.metadata.totalSegments).toBe(3);
    });

    it('should handle empty segments', async () => {
      mockRepository.getCachedPromptSegments.mockResolvedValue([]);

      await expect(assembler.assemblePrompt(mockContext))
        .rejects.toThrow('No prompt segments found for world: Mystika');
    });

    it('should handle segment processing errors', async () => {
      const segmentsWithError = [
        ...mockSegments,
        {
          id: 'error-segment',
          layer: 'core',
          world_slug: null,
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 4,
          version: '1.0.0',
          content: '{{invalid.variable}}', // Invalid variable
          metadata: {},
        },
      ];

      mockRepository.getCachedPromptSegments.mockResolvedValue(segmentsWithError);

      const result = await assembler.assemblePrompt(mockContext);

      expect(result.metadata.warnings).toBeDefined();
      expect(result.metadata.warnings?.length).toBeGreaterThan(0);
    });

    it('should process file inclusions', async () => {
      const segmentsWithFileInclusion = [
        {
          id: 'segment-with-file',
          layer: 'core',
          world_slug: null,
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 1,
          version: '1.0.0',
          content: 'Core instructions <<<FILE core.prompt.json >>>',
          metadata: {},
        },
      ];

      mockRepository.getCachedPromptSegments.mockResolvedValue(segmentsWithFileInclusion);

      // Mock file system read
      const mockReadFileSync = vi.fn().mockReturnValue('{"segments": [{"content": "File content"}]}');
      vi.doMock('fs', () => ({
        readFileSync: mockReadFileSync,
      }));

      const result = await assembler.assemblePrompt(mockContext);

      expect(result.prompt).toContain('Core instructions');
      // Note: File inclusion testing would require more complex mocking
    });
  });

  describe('validateContext', () => {
    it('should validate required context fields', () => {
      const validContext: PromptContext = {
        game: { id: 'game-123', turn_index: 5 },
        world: { name: 'Mystika' },
        system: { schema_version: '1.0.0', prompt_version: '1.0.0', load_order: [], hash: 'test' },
      };

      const result = assembler.validateContext(validContext);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should identify missing required fields', () => {
      const invalidContext: PromptContext = {
        game: { id: 'game-123', turn_index: 5 },
        world: { name: 'Mystika' },
        system: { schema_version: '1.0.0', prompt_version: '1.0.0', load_order: [], hash: 'test' },
      };

      // Remove required field
      delete (invalidContext as any).game.id;

      const result = assembler.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('game.id');
    });
  });

  describe('context building', () => {
    it('should build context object with all character fields', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['character.name']).toBe('Test Character');
      expect(contextObject['character.race']).toBe('Human');
      expect(contextObject['character.skills']).toEqual({ combat: 50, stealth: 60 });
      expect(contextObject['character.inventory']).toEqual(['sword', 'potion']);
      expect(contextObject['character.relationships']).toEqual({ 'npc-1': 70 });
      expect(contextObject['character.goals']).toEqual({ short_term: ['find treasure'], long_term: ['save the world'] });
      expect(contextObject['character.flags']).toEqual({ has_sword: true });
      expect(contextObject['character.reputation']).toEqual({ 'town-1': 80 });
    });

    it('should build context object with game fields', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['game.id']).toBe('game-123');
      expect(contextObject['game.turn_index']).toBe(5);
      expect(contextObject['game.summary']).toBe('Adventure in progress');
      expect(contextObject['game.current_scene']).toBe('forest-clearing');
      expect(contextObject['game.state_snapshot']).toEqual({ location: 'forest', time: 'day' });
      expect(contextObject['game.option_id']).toBe('option-1');
    });

    it('should build context object with world fields', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['world.name']).toBe('Mystika');
      expect(contextObject['world.setting']).toBe('Fantasy world');
      expect(contextObject['world.genre']).toBe('Fantasy');
      expect(contextObject['world.themes']).toEqual(['magic', 'adventure']);
      expect(contextObject['world.rules']).toEqual({ magic_system: 'elemental' });
      expect(contextObject['world.mechanics']).toEqual({ combat: 'turn-based' });
      expect(contextObject['world.lore']).toBe('Ancient magical world');
      expect(contextObject['world.logic']).toEqual({ physics: 'magical' });
    });

    it('should build context object with adventure fields', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['adventure.name']).toBe('Whispercross');
      expect(contextObject['adventure.scenes']).toEqual(['forest-clearing', 'ancient-ruins']);
      expect(contextObject['adventure.objectives']).toEqual(['find the artifact', 'defeat the guardian']);
      expect(contextObject['adventure.npcs']).toEqual([{ id: 'npc-1', name: 'Guide' }]);
      expect(contextObject['adventure.places']).toEqual([{ id: 'place-1', name: 'Forest' }]);
      expect(contextObject['adventure.triggers']).toEqual([{ id: 'trigger-1', condition: 'enters_forest' }]);
    });

    it('should build context object with runtime fields', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['runtime.ticks']).toBe(150);
      expect(contextObject['runtime.presence']).toBe('calm');
      expect(contextObject['runtime.ledgers']).toEqual({ gold: 100 });
      expect(contextObject['runtime.flags']).toEqual({ quest_started: true });
      expect(contextObject['runtime.last_acts']).toEqual([{ type: 'MOVE', target: 'forest' }]);
      expect(contextObject['runtime.style_hint']).toBe('cinematic');
    });

    it('should build context object with system fields', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['system.schema_version']).toBe('1.0.0');
      expect(contextObject['system.prompt_version']).toBe('1.0.0');
      expect(contextObject['system.load_order']).toEqual(['core', 'engine', 'content']);
      expect(contextObject['system.hash']).toBe('test-hash');
    });

    it('should build JSON variables for template compatibility', () => {
      const context = mockContext;
      const contextObject = (assembler as any).buildContextObject(context);

      expect(contextObject['world_name']).toBe('Mystika');
      expect(contextObject['adventure_name']).toBe('Whispercross');
      expect(contextObject['game_state_json']).toBeDefined();
      expect(contextObject['player_state_json']).toBeDefined();
      expect(contextObject['rng_json']).toBeDefined();
      expect(contextObject['player_input_text']).toBe('Test input for prompt assembly');
    });
  });

  describe('prompt formatting', () => {
    it('should create proper prompt header', () => {
      const context = mockContext;
      const header = (assembler as any).createPromptHeader(context);

      expect(header).toContain('RPG Storyteller AI System');
      expect(header).toContain('World: Mystika');
      expect(header).toContain('Player: Test Character (Human)');
      expect(header).toContain('Adventure: Whispercross');
      expect(header).toContain('Scene: forest-clearing');
      expect(header).toContain('Turn: 6');
    });

    it('should create proper prompt footer', () => {
      const context = mockContext;
      const footer = (assembler as any).createPromptFooter(context);

      expect(footer).toContain('Output Requirements');
      expect(footer).toContain('AWF v1 format');
      expect(footer).toContain('JSON object');
      expect(footer).toContain('scn');
      expect(footer).toContain('txt');
      expect(footer).toContain('choices');
      expect(footer).toContain('acts');
      expect(footer).toContain('val');
    });

    it('should create final prompt with proper structure', () => {
      const segments = ['Segment 1', 'Segment 2'];
      const context = mockContext;
      const prompt = (assembler as any).createFinalPrompt(segments, context);

      expect(prompt).toContain('RPG Storyteller AI System');
      expect(prompt).toContain('Segment 1');
      expect(prompt).toContain('Segment 2');
      expect(prompt).toContain('Output Requirements');
    });
  });
});
