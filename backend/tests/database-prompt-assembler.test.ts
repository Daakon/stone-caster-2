import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabasePromptAssembler, DatabasePromptError } from '../src/prompts/database-prompt-assembler.js';

// Mock the prompt repository
const mockPromptRepository = {
  getCachedPromptSegments: vi.fn(),
  clearCache: vi.fn(),
};

describe('DatabasePromptAssembler', () => {
  let assembler: DatabasePromptAssembler;

  beforeEach(() => {
    vi.clearAllMocks();
    assembler = new DatabasePromptAssembler(mockPromptRepository as any);
  });

  describe('assemblePrompt', () => {
    it('should assemble prompt successfully with database segments', async () => {
      // Mock database segments
      const mockSegments = [
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
      ];

      mockPromptRepository.getCachedPromptSegments.mockResolvedValue(mockSegments);

      const params = {
        worldSlug: 'mystika',
        adventureSlug: 'adv.whispercross.start.v3',
        startingSceneId: 'forest_meet',
        includeEnhancements: true
      };

      const result = await assembler.assemblePrompt(params);

      expect(result.promptText).toContain('You are a game master');
      expect(result.promptText).toContain('World: mystika');
      expect(result.metadata.totalSegments).toBe(2);
      expect(result.audit.templateIds).toEqual(['core-system', 'world-mystika']);
    });

    it('should throw DB_PROMPTS_EMPTY when no segments found', async () => {
      mockPromptRepository.getCachedPromptSegments.mockResolvedValue([]);

      const params = {
        worldSlug: 'mystika',
        adventureSlug: 'adv.whispercross.start.v3',
        startingSceneId: 'forest_meet',
        includeEnhancements: true
      };

      await expect(assembler.assemblePrompt(params)).rejects.toThrow(DatabasePromptError);
      await expect(assembler.assemblePrompt(params)).rejects.toThrow('DB_PROMPTS_EMPTY');
    });

    it('should throw DB_PROMPTS_UNAVAILABLE when repository fails', async () => {
      mockPromptRepository.getCachedPromptSegments.mockRejectedValue(new Error('Database connection failed'));

      const params = {
        worldSlug: 'mystika',
        adventureSlug: 'adv.whispercross.start.v3',
        startingSceneId: 'forest_meet',
        includeEnhancements: true
      };

      await expect(assembler.assemblePrompt(params)).rejects.toThrow(DatabasePromptError);
      await expect(assembler.assemblePrompt(params)).rejects.toThrow('DB_PROMPTS_UNAVAILABLE');
    });

    it('should process segments with variable replacement', async () => {
      const mockSegments = [
        {
          id: 'test-segment',
          content: 'Hello {{world.name}}! Adventure: {{adventure.name}}.',
          version: '1.0.0',
          layer: 'core',
          metadata: {}
        }
      ];

      mockPromptRepository.getCachedPromptSegments.mockResolvedValue(mockSegments);

      const params = {
        worldSlug: 'mystika',
        adventureSlug: 'adv.whispercross.start.v3',
        startingSceneId: 'forest_meet',
        includeEnhancements: true
      };

      const result = await assembler.assemblePrompt(params);

      expect(result.promptText).toContain('Hello mystika!');
      expect(result.promptText).toContain('Adventure: adv.whispercross.start.v3');
    });

    it('should create proper prompt structure with header and footer', async () => {
      const mockSegments = [
        {
          id: 'test-segment',
          content: 'Test content',
          version: '1.0.0',
          layer: 'core',
          metadata: {}
        }
      ];

      mockPromptRepository.getCachedPromptSegments.mockResolvedValue(mockSegments);

      const params = {
        worldSlug: 'mystika',
        adventureSlug: 'adv.whispercross.start.v3',
        startingSceneId: 'forest_meet',
        includeEnhancements: true
      };

      const result = await assembler.assemblePrompt(params);

      expect(result.promptText).toContain('# RPG Storyteller AI System');
      expect(result.promptText).toContain('## Context');
      expect(result.promptText).toContain('**World**: mystika');
      expect(result.promptText).toContain('**Adventure**: adv.whispercross.start.v3');
      expect(result.promptText).toContain('**Scene**: forest_meet');
      expect(result.promptText).toContain('## Output Requirements');
      expect(result.promptText).toContain('Return a single JSON object in AWF v1 format');
    });

    it('should handle segment processing errors gracefully', async () => {
      const mockSegments = [
        {
          id: 'valid-segment',
          content: 'Valid content',
          version: '1.0.0',
          layer: 'core',
          metadata: {}
        },
        {
          id: 'error-segment',
          content: 'Content that will cause error',
          version: '1.0.0',
          layer: 'core',
          metadata: {}
        }
      ];

      // Mock the processSegment method to throw for one segment
      const originalProcessSegment = (assembler as any).processSegment;
      vi.spyOn(assembler as any, 'processSegment').mockImplementation((segment: any) => {
        if (segment.id === 'error-segment') {
          throw new Error('Processing error');
        }
        return Promise.resolve(segment.content);
      });

      mockPromptRepository.getCachedPromptSegments.mockResolvedValue(mockSegments);

      const params = {
        worldSlug: 'mystika',
        adventureSlug: 'adv.whispercross.start.v3',
        startingSceneId: 'forest_meet',
        includeEnhancements: true
      };

      const result = await assembler.assemblePrompt(params);

      expect(result.promptText).toContain('Valid content');
      expect(result.metadata.warnings).toBeDefined();
      expect(result.metadata.warnings).toContain('Failed to process segment error-segment');
    });
  });

  describe('DatabasePromptError', () => {
    it('should create error with proper code and context', () => {
      const error = new DatabasePromptError(
        'DB_PROMPTS_EMPTY',
        'No segments found',
        { worldSlug: 'mystika', adventureSlug: 'test', startingSceneId: 'scene' }
      );

      expect(error.code).toBe('DB_PROMPTS_EMPTY');
      expect(error.message).toBe('No segments found');
      expect(error.context).toEqual({
        worldSlug: 'mystika',
        adventureSlug: 'test',
        startingSceneId: 'scene'
      });
    });
  });
});
