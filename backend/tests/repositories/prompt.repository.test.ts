import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptRepository, type PromptSegment } from '../../src/repositories/prompt.repository.js';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      }))
    }))
  }))
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
          id: '550e8400-e29b-41d4-a716-446655440000',
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
          id: '550e8400-e29b-41d4-a716-446655440001',
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
          include_start: true,
          include_enhancements: true,
        })
      ).rejects.toThrow('Failed to fetch prompt segments: Database connection failed');
    });

    it('should validate input parameters', async () => {
      await expect(
        repository.getPromptSegments({
          world_slug: 123 as any, // Invalid type
          include_start: true,
          include_enhancements: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('getCorePrompts', () => {
    it('should fetch core prompts without world/adventure filters', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
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
          id: '550e8400-e29b-41d4-a716-446655440004',
          layer: 'world',
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
          id: '550e8400-e29b-41d4-a716-446655440005',
          layer: 'adventure_start',
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

    it('should handle validation errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Validation failed' }
      });

      await expect(repository.validateDependencies()).rejects.toThrow('Failed to validate dependencies: Validation failed');
    });

    it('should return empty array when no dependencies are missing', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repository.validateDependencies();

      expect(result).toEqual([]);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('validate_prompt_dependencies');
    });
  });

  describe('caching', () => {
    it('should cache prompt segments', async () => {
      const mockSegments: PromptSegment[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
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
        include_start: true,
        include_enhancements: true,
      });

      // Second call should use cache
      const result2 = await repository.getCachedPromptSegments({
        world_slug: 'mystika',
        include_start: true,
        include_enhancements: true,
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
