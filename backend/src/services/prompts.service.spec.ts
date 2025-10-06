import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptsService } from './prompts.service.js';
import { getTemplatesForWorld, PromptTemplateMissingError } from '../prompting/templateRegistry.js';
import { ServiceError } from '../utils/serviceError.js';
import { ApiErrorCode } from '@shared/types/api.js';

// Mock the template registry
vi.mock('../prompting/templateRegistry.js', () => ({
  getTemplatesForWorld: vi.fn(),
  PromptTemplateMissingError: class extends Error {
    constructor(public world: string) {
      super(`No templates found for world: ${world}`);
      this.name = 'PromptTemplateMissingError';
    }
  },
}));

// Mock other dependencies
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    })),
  },
}));

vi.mock('../config/index.js', () => ({
  configService: {
    getAi: vi.fn(() => ({
      promptSchemaVersion: '1.0.0',
    })),
  },
}));

vi.mock('./content.service.js', () => ({
  ContentService: {
    getWorldBySlug: vi.fn(() => ({
      slug: 'mystika',
      name: 'Mystika',
      description: 'A mystical world',
      tags: ['fantasy', 'magic'],
    })),
  },
}));

vi.mock('./debug.service.js', () => ({
  debugService: {
    logPrompt: vi.fn(() => 'prompt-id-123'),
  },
}));

describe('PromptsService', () => {
  let promptsService: PromptsService;
  const mockGetTemplatesForWorld = vi.mocked(getTemplatesForWorld);

  beforeEach(() => {
    vi.clearAllMocks();
    promptsService = new PromptsService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('buildPrompt', () => {
    const mockGameContext = {
      id: 'game-123',
      world_id: 'mystika',
      character_id: 'char-123',
      state_snapshot: { current_scene: 'opening' },
      turn_index: 1,
    };

    const mockTemplateBundle = {
      core: {
        system: 'System prompt content',
        tools: 'Tools prompt content',
        formatting: 'Formatting prompt content',
        safety: 'Safety prompt content',
      },
      world: {
        lore: 'World lore content',
        logic: 'World logic content',
        style: 'World style content',
      },
      adventures: {
        falebridge: 'Adventure content',
      },
    };

    it('should assemble prompt when bundle is present', async () => {
      mockGetTemplatesForWorld.mockResolvedValue(mockTemplateBundle);

      const result = await promptsService.buildPrompt(mockGameContext, 'option-123');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('RPG Storyteller AI System');
      expect(result).toContain('System prompt content');
      expect(result).toContain('World lore content');
      expect(result).toContain('Adventure content');
      expect(mockGetTemplatesForWorld).toHaveBeenCalledWith('mystika');
    });

    it('should map PromptTemplateMissingError to ServiceError(422)', async () => {
      mockGetTemplatesForWorld.mockRejectedValue(new PromptTemplateMissingError('mystika'));

      await expect(promptsService.buildPrompt(mockGameContext, 'option-123'))
        .rejects.toThrow(ServiceError);

      try {
        await promptsService.buildPrompt(mockGameContext, 'option-123');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).statusCode).toBe(422);
        expect((error as ServiceError).error.code).toBe(ApiErrorCode.PROMPT_TEMPLATE_MISSING);
        expect((error as ServiceError).error.message).toContain('No templates available for world');
        expect((error as ServiceError).error.details).toEqual({ world: 'mystika' });
      }
    });

    it('should handle other errors as internal errors', async () => {
      mockGetTemplatesForWorld.mockRejectedValue(new Error('Unexpected error'));

      await expect(promptsService.buildPrompt(mockGameContext, 'option-123'))
        .rejects.toThrow('Failed to build prompt: Unexpected error');
    });

    it('should work with minimal template bundle', async () => {
      const minimalBundle = {
        core: {
          system: 'Minimal system content',
        },
        world: {
          lore: 'Minimal world content',
        },
      };

      mockGetTemplatesForWorld.mockResolvedValue(minimalBundle);

      const result = await promptsService.buildPrompt(mockGameContext, 'option-123');

      expect(result).toBeDefined();
      expect(result).toContain('Minimal system content');
      expect(result).toContain('Minimal world content');
    });

    it('should handle guest player context', async () => {
      const guestGameContext = {
        ...mockGameContext,
        character_id: undefined,
      };

      mockGetTemplatesForWorld.mockResolvedValue(mockTemplateBundle);

      const result = await promptsService.buildPrompt(guestGameContext, 'option-123');

      expect(result).toBeDefined();
      expect(result).toContain('Guest Player');
    });

    it('should include adventure content when available', async () => {
      const bundleWithAdventures = {
        ...mockTemplateBundle,
        adventures: {
          falebridge: 'Falebridge adventure content',
          whispercross: 'Whispercross adventure content',
        },
      };

      mockGetTemplatesForWorld.mockResolvedValue(bundleWithAdventures);

      const result = await promptsService.buildPrompt(mockGameContext, 'option-123');

      expect(result).toContain('Falebridge adventure content');
      expect(result).toContain('Whispercross adventure content');
    });

    it('should handle missing world template gracefully', async () => {
      // Mock ContentService to return null for world template
      const { ContentService } = await import('./content.service.js');
      vi.mocked(ContentService.getWorldBySlug).mockResolvedValue(null);

      mockGetTemplatesForWorld.mockResolvedValue(mockTemplateBundle);

      await expect(promptsService.buildPrompt(mockGameContext, 'option-123'))
        .rejects.toThrow('World template not found: mystika');
    });
  });
});
