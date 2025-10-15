import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Schema for prompt segment from RPC
const PromptSegmentSchema = z.object({
  id: z.string().uuid(),
  layer: z.string(),
  world_slug: z.string().nullable(),
  adventure_slug: z.string().nullable(),
  scene_id: z.string().nullable(),
  turn_stage: z.string(),
  sort_order: z.number(),
  version: z.string(),
  content: z.string(),
  metadata: z.record(z.any()),
});

export type PromptSegment = z.infer<typeof PromptSegmentSchema>;

// Schema for prompt context parameters
const PromptContextParamsSchema = z.object({
  world_slug: z.string().optional(),
  adventure_slug: z.string().optional(),
  include_start: z.boolean().default(true),
  scene_id: z.string().optional(),
  include_enhancements: z.boolean().default(true),
});

export type PromptContextParams = z.infer<typeof PromptContextParamsSchema>;

/**
 * Repository for managing prompt segments from the database
 */
export class PromptRepository {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get prompt segments for a given context using the RPC function
   */
  async getPromptSegments(params: PromptContextParams): Promise<PromptSegment[]> {
    try {
      // Validate input parameters
      const validatedParams = PromptContextParamsSchema.parse(params);

      const { data, error } = await this.supabase
        .rpc('prompt_segments_for_context', {
          p_world_slug: validatedParams.world_slug || null,
          p_adventure_slug: validatedParams.adventure_slug || null,
          p_include_start: validatedParams.include_start,
          p_scene_id: validatedParams.scene_id || null,
          p_include_enhancements: validatedParams.include_enhancements,
        });

      if (error) {
        throw new Error(`Failed to fetch prompt segments: ${error.message}`);
      }

      // Validate and parse the response
      const segments = z.array(PromptSegmentSchema).parse(data || []);
      
      console.log(`[PROMPT_REPOSITORY] Retrieved ${segments.length} prompt segments for context:`, {
        world: validatedParams.world_slug,
        adventure: validatedParams.adventure_slug,
        scene: validatedParams.scene_id,
        includeStart: validatedParams.include_start,
        includeEnhancements: validatedParams.include_enhancements,
      });

      return segments;
    } catch (error) {
      console.error('[PROMPT_REPOSITORY] Error fetching prompt segments:', error);
      throw error;
    }
  }

  /**
   * Get prompt segments for a specific world and adventure
   */
  async getAdventurePrompts(worldSlug: string, adventureSlug: string, includeStart: boolean = true): Promise<PromptSegment[]> {
    return this.getPromptSegments({
      world_slug: worldSlug,
      adventure_slug: adventureSlug,
      include_start: includeStart,
      include_enhancements: true,
    });
  }

  /**
   * Get core system prompts (no world/adventure specific)
   */
  async getCorePrompts(): Promise<PromptSegment[]> {
    return this.getPromptSegments({
      include_start: true,
      include_enhancements: true,
    });
  }

  /**
   * Get world-specific prompts
   */
  async getWorldPrompts(worldSlug: string): Promise<PromptSegment[]> {
    return this.getPromptSegments({
      world_slug: worldSlug,
      include_start: true,
      include_enhancements: true,
    });
  }

  /**
   * Get prompt statistics
   */
  async getPromptStats(): Promise<{
    total_prompts: number;
    active_prompts: number;
    locked_prompts: number;
    layers_count: Record<string, number>;
    worlds_count: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_prompt_stats');

      if (error) {
        throw new Error(`Failed to fetch prompt stats: ${error.message}`);
      }

      return data[0] || {
        total_prompts: 0,
        active_prompts: 0,
        locked_prompts: 0,
        layers_count: {},
        worlds_count: 0,
      };
    } catch (error) {
      console.error('[PROMPT_REPOSITORY] Error fetching prompt stats:', error);
      throw error;
    }
  }

  /**
   * Validate prompt dependencies
   */
  async validateDependencies(): Promise<Array<{
    prompt_id: string;
    missing_dependencies: string[];
  }>> {
    try {
      const { data, error } = await this.supabase
        .rpc('validate_prompt_dependencies');

      if (error) {
        throw new Error(`Failed to validate dependencies: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('[PROMPT_REPOSITORY] Error validating dependencies:', error);
      throw error;
    }
  }

  /**
   * Cache prompt segments with a simple in-memory cache
   */
  private cache = new Map<string, { segments: PromptSegment[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getCachedPromptSegments(params: PromptContextParams): Promise<PromptSegment[]> {
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[PROMPT_REPOSITORY] Using cached segments for key: ${cacheKey}`);
      return cached.segments;
    }

    const segments = await this.getPromptSegments(params);
    this.cache.set(cacheKey, { segments, timestamp: Date.now() });
    
    return segments;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[PROMPT_REPOSITORY] Cache cleared');
  }
}
