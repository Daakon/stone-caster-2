import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptsService } from '../src/services/prompts.service.js';
import { DatabasePromptService } from '../src/services/db-prompt.service.js';
import { DatabasePromptError } from '../src/prompts/database-prompt-assembler.js';

// Mock dependencies
vi.mock('../src/services/config.service.js', () => ({
  configService: {
    getAi: vi.fn(() => ({
      promptSchemaVersion: '1.0.0',
      requirePromptApproval: true,
    })),
  },
}));

vi.mock('../src/services/debug.service.js', () => ({
  debugService: {
    logPrompt: vi.fn(() => 'test-prompt-id'),
  },
}));

vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'test-world-id',
              name: 'Test World',
              setting: 'Fantasy',
              genre: 'fantasy',
              themes: ['adventure', 'magic'],
              rules: 'Test rules',
              description: 'A magical fantasy world',
            },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('PromptsService (DB-Only)', () => {
  let promptsService: PromptsService;
  let mockDatabasePromptService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock database prompt service with successful assembly
    mockDatabasePromptService = {
      promptRepository: {
        getCachedPromptSegments: vi.fn().mockResolvedValue([
          {
            id: 'core-system',
            content: 'You are a game master. Return JSON with keys: scn, txt, choices.',
            version: '1.0.0',
            layer: 'core',
            metadata: {}
          },
          {
            id: 'world-mystika',
            content: 'World: {{world.name}}. Setting: {{world.setting}}.',
            version: '1.0.0',
            layer: 'world',
            metadata: {}
          }
        ])
      }
    };
    
    promptsService = new PromptsService(mockDatabasePromptService);
  });

  describe('createInitialPrompt', () => {
    it('should create initial prompt using database-only assembly', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        character_id: 'test-character-id',
        state_snapshot: {
          currentScene: 'forest_meet',
          adventureSlug: 'adv.whispercross.start.v3'
        },
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('# RPG Storyteller AI System');
      expect(result).toContain('**World**: mystika');
      expect(result).toContain('**Scene**: forest_meet');
      expect(result).toContain('Return a single JSON object in AWF v1 format');
      expect(result).toContain('World: Test World');
    });

    it('should handle missing character ID', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {
          currentScene: 'forest_meet',
          adventureSlug: 'adv.whispercross.start.v3'
        },
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('**Player**: Guest Player');
    });

    it('should throw DatabasePromptError when no segments found', async () => {
      // Mock database to return empty segments
      const mockEmptyDatabaseService = {
        promptRepository: {
          getCachedPromptSegments: vi.fn().mockResolvedValue([])
        }
      };

      const promptsServiceWithEmptyDB = new PromptsService(mockEmptyDatabaseService as any);
      
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {
          currentScene: 'forest_meet',
          adventureSlug: 'adv.whispercross.start.v3'
        },
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      await expect(promptsServiceWithEmptyDB.createInitialPrompt(gameContext))
        .rejects.toThrow('Database prompt error');
    });

    it('should throw DatabasePromptError when database is unavailable', async () => {
      // Mock database to throw error
      const mockErrorDatabaseService = {
        promptRepository: {
          getCachedPromptSegments: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        }
      };

      const promptsServiceWithErrorDB = new PromptsService(mockErrorDatabaseService as any);
      
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {
          currentScene: 'forest_meet',
          adventureSlug: 'adv.whispercross.start.v3'
        },
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      await expect(promptsServiceWithErrorDB.createInitialPrompt(gameContext))
        .rejects.toThrow('Database prompt error');
    });
  });

  describe('buildPrompt', () => {
    it('should build prompt for regular turns using database-only assembly', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        character_id: 'test-character-id',
        state_snapshot: {
          currentScene: 'forest_meet',
          adventureSlug: 'adv.whispercross.start.v3'
        },
        turn_index: 1,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.buildPrompt(gameContext, 'test-option');

      expect(result).toContain('# RPG Storyteller AI System');
      expect(result).toContain('**World**: mystika');
      expect(result).toContain('**Turn**: 2'); // turn_index + 1
      expect(result).toContain('Return a single JSON object in AWF v1 format');
    });

    it('should handle missing character in buildPrompt', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {
          currentScene: 'forest_meet',
          adventureSlug: 'adv.whispercross.start.v3'
        },
        turn_index: 1,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.buildPrompt(gameContext, 'test-option');

      expect(result).toContain('**Player**: Guest Player');
    });
  });

  describe('extractAdventureSlug', () => {
    it('should extract adventure slug from state snapshot', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {
          adventureSlug: 'adv.custom.start.v1'
        },
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('**Adventure**: adv.custom.start.v1');
    });

    it('should use default adventure slug when not in snapshot', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {},
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('**Adventure**: adv.mystika.start.v3');
    });
  });

  describe('extractStartingSceneId', () => {
    it('should extract scene ID from state snapshot', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {
          currentScene: 'custom_scene'
        },
        turn_index: 0,
        current_scene: 'forest_meet'
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('**Scene**: custom_scene');
    });

    it('should use current_scene when not in snapshot', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {},
        turn_index: 0,
        current_scene: 'custom_scene'
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('**Scene**: custom_scene');
    });

    it('should use default scene when none specified', async () => {
      const gameContext = {
        id: 'test-game-id',
        world_id: 'mystika',
        state_snapshot: {},
        turn_index: 0
      };

      const result = await promptsService.createInitialPrompt(gameContext);

      expect(result).toContain('**Scene**: forest_meet');
    });
  });
});
