import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptRepository, type PromptSegment } from '../../src/repositories/prompt.repository.js';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('PromptRepository', () => {
  let repository: PromptRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PromptRepository('http://test.supabase.co', 'test-key');
  });

  describe('getPromptSegments', () => {
    it('should fetch prompt segments with correct parameters', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: 'test-id-1',
          layer: 'core',
          world_slug: null,
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 1,
          version: '1.0.0',
          content: 'Test core prompt content',
          metadata: { variables: ['test'] },
        },
        {
          id: 'test-id-2',
          layer: 'engine',
          world_slug: 'mystika',
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 2,
          version: '1.0.0',
          content: 'Test world prompt content',
          metadata: { variables: ['world'] },
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSegments,
        error: null,
      });

      const result = await repository.getPromptSegments({
        world_slug: 'mystika',
        adventure_slug: 'whispercross',
        include_start: true,
        include_enhancements: true,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('prompt_segments_for_context', {
        p_world_slug: 'mystika',
        p_adventure_slug: 'whispercross',
        p_include_start: true,
        p_scene_id: null,
        p_include_enhancements: true,
      });

      expect(result).toEqual(mockSegments);
    });

    it('should handle database errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(
        repository.getPromptSegments({
          world_slug: 'mystika',
        })
      ).rejects.toThrow('Failed to fetch prompt segments: Database connection failed');
    });

    it('should validate input parameters', async () => {
      await expect(
        repository.getPromptSegments({
          world_slug: 123 as any, // Invalid type
        })
      ).rejects.toThrow();
    });
  });

  describe('getCorePrompts', () => {
    it('should fetch core prompts without world/adventure filters', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: 'core-1',
          layer: 'core',
          world_slug: null,
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 1,
          version: '1.0.0',
          content: 'Core system prompt',
          metadata: {},
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSegments,
        error: null,
      });

      const result = await repository.getCorePrompts();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('prompt_segments_for_context', {
        p_world_slug: null,
        p_adventure_slug: null,
        p_include_start: true,
        p_scene_id: null,
        p_include_enhancements: true,
      });

      expect(result).toEqual(mockSegments);
    });
  });

  describe('getWorldPrompts', () => {
    it('should fetch world-specific prompts', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: 'world-1',
          layer: 'foundation',
          world_slug: 'mystika',
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 1,
          version: '1.0.0',
          content: 'World lore prompt',
          metadata: {},
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSegments,
        error: null,
      });

      const result = await repository.getWorldPrompts('mystika');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('prompt_segments_for_context', {
        p_world_slug: 'mystika',
        p_adventure_slug: null,
        p_include_start: true,
        p_scene_id: null,
        p_include_enhancements: true,
      });

      expect(result).toEqual(mockSegments);
    });
  });

  describe('getAdventurePrompts', () => {
    it('should fetch adventure-specific prompts', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: 'adventure-1',
          layer: 'content',
          world_slug: 'mystika',
          adventure_slug: 'whispercross',
          scene_id: null,
          turn_stage: 'start',
          sort_order: 1,
          version: '1.0.0',
          content: 'Adventure start prompt',
          metadata: {},
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSegments,
        error: null,
      });

      const result = await repository.getAdventurePrompts('mystika', 'whispercross', true);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('prompt_segments_for_context', {
        p_world_slug: 'mystika',
        p_adventure_slug: 'whispercross',
        p_include_start: true,
        p_scene_id: null,
        p_include_enhancements: true,
      });

      expect(result).toEqual(mockSegments);
    });
  });

  describe('getPromptStats', () => {
    it('should fetch prompt statistics', async () => {
      const mockStats = {
        total_prompts: 100,
        active_prompts: 95,
        locked_prompts: 5,
        layers_count: { core: 20, engine: 15, content: 60 },
        worlds_count: 3,
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockStats],
        error: null,
      });

      const result = await repository.getPromptStats();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_prompt_stats');
      expect(result).toEqual(mockStats);
    });

    it('should handle empty stats', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repository.getPromptStats();

      expect(result).toEqual({
        total_prompts: 0,
        active_prompts: 0,
        locked_prompts: 0,
        layers_count: {},
        worlds_count: 0,
      });
    });
  });

  describe('validateDependencies', () => {
    it('should validate prompt dependencies', async () => {
      const mockDependencies = [
        {
          prompt_id: 'prompt-1',
          missing_dependencies: ['missing-dep-1', 'missing-dep-2'],
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockDependencies,
        error: null,
      });

      const result = await repository.validateDependencies();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('validate_prompt_dependencies');
      expect(result).toEqual(mockDependencies);
    });
  });

  describe('caching', () => {
    it('should cache prompt segments', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: 'cached-1',
          layer: 'core',
          world_slug: null,
          adventure_slug: null,
          scene_id: null,
          turn_stage: 'any',
          sort_order: 1,
          version: '1.0.0',
          content: 'Cached prompt',
          metadata: {},
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSegments,
        error: null,
      });

      // First call
      const result1 = await repository.getCachedPromptSegments({
        world_slug: 'mystika',
      });

      // Second call should use cache
      const result2 = await repository.getCachedPromptSegments({
        world_slug: 'mystika',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockSegments);
      expect(result2).toEqual(mockSegments);
    });

    it('should clear cache', () => {
      repository.clearCache();
      // No assertions needed, just ensure no errors
    });
  });
});
