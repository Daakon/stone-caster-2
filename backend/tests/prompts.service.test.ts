import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptsService } from '../src/services/prompts.service.js';
import { configService } from '../src/services/config.service.js';
import { debugService } from '../src/services/debug.service.js';

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

  beforeEach(() => {
    vi.clearAllMocks();
    promptsService = new PromptsService();
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
        prompt: 'Test prompt content',
        needsApproval: true,
        promptId: expect.stringMatching(/^initial_test-game-id_\d+$/),
        metadata: {
          worldId: 'test-world-id',
          characterId: 'test-character-id',
          turnIndex: 0,
          tokenCount: 25, // Math.ceil('Test prompt content'.length / 4)
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
