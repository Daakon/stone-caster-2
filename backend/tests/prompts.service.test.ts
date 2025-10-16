import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptsService } from '../src/services/prompts.service.js';
import { DatabasePromptService } from '../src/services/db-prompt.service.js';
import { configService } from '../src/services/config.service.js';
import { debugService } from '../src/services/debug.service.js';

// Mock dependencies
vi.mock('../src/services/config.service.js', () => ({
  configService: {
    getAi: vi.fn(() => ({
      promptSchemaVersion: '1.0.0',
      requirePromptApproval: true,
    })),
    getEnv: vi.fn(() => ({
      port: 3000,
      nodeEnv: 'test',
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
      supabaseServiceKey: 'test-service-key',
      openaiApiKey: 'test-openai-key',
      primaryAiModel: 'gpt-4o-mini',
      corsOrigin: 'http://localhost:3000',
      frontendUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:3001',
    })),
  },
}));

vi.mock('../src/services/debug.service.js', () => ({
  debugService: {
    logPrompt: vi.fn(() => 'test-prompt-id'),
  },
}));

vi.mock('../src/services/content.service.js', () => ({
  ContentService: {
    getWorldBySlug: vi.fn((slug: string) => {
      if (slug === 'test-world-id') {
        return Promise.resolve({
          slug: 'test-world-id',
          name: 'Test World',
          title: 'Test World',
          description: 'A test world for unit testing',
          genre: 'fantasy',
          setting: 'medieval',
          tone: 'adventure',
          themes: ['magic', 'adventure'],
          tags: ['fantasy', 'medieval'],
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      return Promise.resolve(null);
    }),
  },
}));

vi.mock('../src/services/db-prompt.service.js', () => ({
  DatabasePromptService: vi.fn().mockImplementation(() => ({
    assemblePrompt: vi.fn(() => Promise.resolve({
      prompt: `You are the runtime engine for a text-based RPG game. You must return ONE JSON object (AWF) that contains the game state and narrative.

=== CORE_BEGIN ===
{"core": "system"}
=== CORE_END ===

=== WORLD_BEGIN ===
{"world": "Test World", "setting": "Fantasy", "genre": "fantasy"}
=== WORLD_END ===

=== ADVENTURE_BEGIN ===
{"adventure": "Test Adventure", "scenes": []}
=== ADVENTURE_END ===

=== PLAYER_BEGIN ===
{"player": {"name": "Test Character", "level": 1}}
=== PLAYER_END ===

=== RNG_BEGIN ===
{"rng": {"d20": 10, "d100": 50}}
=== RNG_END ===

=== INPUT_BEGIN ===
Begin the adventure "Test Adventure" from its starting scene "forest_meet".
=== INPUT_END ===

You are the runtime engine for a text-based RPG game. You must return ONE JSON object (AWF) that contains the game state and narrative.

Return ONE JSON object (AWF) with the following structure:
{
  "txt": "narrative text",
  "scn": "scene_name",
  "emotion": "neutral",
  "choices": [{"id": "choice1", "label": "Option 1"}],
  "flags": {},
  "ledgers": {},
  "presence": "present",
  "last_acts": [],
  "style_hint": "neutral"
}

TIME_ADVANCE (ticks ≥ 1) - Advance the game time by the specified number of ticks.
essence alignment affects behavior - Character essence influences their actions and decisions.
NPCs may act on their own - Non-player characters can take independent actions.
The world responds to player choices - The environment changes based on player decisions.
Game state persists between turns - All changes are saved and carried forward.`,
      audit: {
        templateIds: ['test-db-template'],
        version: '1.0.0',
        hash: 'test-db-hash',
        contextSummary: {
          world: 'Test World',
          adventure: 'None',
          character: 'Test Character',
          turnIndex: 0,
        },
        tokenCount: 100,
        assembledAt: new Date().toISOString(),
      },
      metadata: {
        totalSegments: 1,
      },
    })),
  })),
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
              rules: {
                allowMagic: true,
                allowTechnology: false,
                difficultyLevel: 'medium',
                combatSystem: 'd20',
              },
              description: 'A magical fantasy world',
            },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

vi.mock('../src/prompts/assembler.js', () => ({
  PromptAssembler: vi.fn().mockImplementation(() => ({
    assemblePrompt: vi.fn(() => Promise.resolve({
      prompt: 'Test prompt content',
      audit: {
        templateIds: ['test-template'],
        version: '1.0.0',
        hash: 'test-hash',
        contextSummary: {
          world: 'Test World',
          adventure: 'None',
          character: 'Test Character',
          turnIndex: 0,
        },
        tokenCount: 100,
        assembledAt: new Date().toISOString(),
      },
      metadata: {
        totalSegments: 1,
      },
    })),
  })),
}));

describe('PromptsService', () => {
  let promptsService: PromptsService;
  let mockDatabasePromptService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabasePromptService = new DatabasePromptService();
    promptsService = new PromptsService(mockDatabasePromptService);
  });

  describe('createInitialPromptWithApproval', () => {
    it('should create initial prompt with approval mechanism', async () => {
      const gameId = 'test-game-id';
      const worldId = 'test-world-id';
      const characterId = 'test-character-id';

      const result = await promptsService.createInitialPromptWithApproval(
        gameId,
        worldId,
        characterId
      );

      expect(result).toEqual({
        prompt: expect.stringContaining('You are the runtime engine for a text-based RPG game'),
        needsApproval: true,
        promptId: expect.stringMatching(/^initial_test-game-id_\d+$/),
        metadata: {
          worldId: 'test-world-id',
          characterId: 'test-character-id',
          turnIndex: 0,
          tokenCount: expect.any(Number),
        },
      });
    });

    it('should handle missing character ID', async () => {
      const gameId = 'test-game-id';
      const worldId = 'test-world-id';

      const result = await promptsService.createInitialPromptWithApproval(
        gameId,
        worldId
      );

      expect(result.metadata.characterId).toBeUndefined();
    });

    it('should respect requirePromptApproval config', async () => {
      // Mock config to return false for requirePromptApproval
      vi.mocked(configService.getAi).mockReturnValue({
        promptSchemaVersion: '1.0.0',
        requirePromptApproval: false,
      } as any);

      const result = await promptsService.createInitialPromptWithApproval(
        'test-game-id',
        'test-world-id'
      );

      expect(result.needsApproval).toBe(false);
    });
  });

  describe('approvePrompt', () => {
    it('should approve a prompt successfully', async () => {
      const result = await promptsService.approvePrompt('test-prompt-id', true);

      expect(result).toEqual({
        success: true,
        message: 'Prompt approved successfully',
      });
    });

    it('should reject a prompt successfully', async () => {
      const result = await promptsService.approvePrompt('test-prompt-id', false);

      expect(result).toEqual({
        success: true,
        message: 'Prompt rejected successfully',
      });
    });
  });

  describe('validateResponse', () => {
    it('should validate a valid v1 response', () => {
      const validResponse = {
        narrative: 'Test narrative',
        emotion: 'neutral',
        npcResponses: [],
        suggestedActions: [],
        worldStateChanges: {},
      };

      const isValid = promptsService.validateResponse(validResponse, '1.0.0');
      expect(isValid).toBe(true);
    });

    it('should reject invalid response missing required fields', () => {
      const invalidResponse = {
        emotion: 'neutral',
        // Missing narrative
      };

      const isValid = promptsService.validateResponse(invalidResponse, '1.0.0');
      expect(isValid).toBe(false);
    });

    it('should reject response with invalid emotion', () => {
      const invalidResponse = {
        narrative: 'Test narrative',
        emotion: 'invalid-emotion',
      };

      const isValid = promptsService.validateResponse(invalidResponse, '1.0.0');
      expect(isValid).toBe(false);
    });
  });
});
