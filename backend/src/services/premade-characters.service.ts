import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from '@shared';

export interface PremadeCharacterDTO {
  id: string;
  worldSlug: string;
  archetypeKey: string;
  displayName: string;
  summary: string;
  avatarUrl?: string;
  baseTraits: Record<string, unknown>;
}

export class PremadeCharactersService {
  /**
   * Get all active premade characters for a specific world
   * @param worldSlug - World identifier
   * @returns Array of premade character DTOs
   */
  static async getPremadeCharactersByWorld(worldSlug: string): Promise<PremadeCharacterDTO[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('premade_characters')
        .select('*')
        .eq('world_slug', worldSlug)
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        console.error('Error fetching premade characters:', error);
        throw new Error('Failed to fetch premade characters');
      }

      return (data || []).map(this.mapToDTO);
    } catch (error) {
      console.error('Unexpected error in getPremadeCharactersByWorld:', error);
      throw error;
    }
  }

  /**
   * Get a specific premade character by world and archetype
   * @param worldSlug - World identifier
   * @param archetypeKey - Archetype identifier
   * @returns Premade character DTO or null if not found
   */
  static async getPremadeCharacter(worldSlug: string, archetypeKey: string): Promise<PremadeCharacterDTO | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('premade_characters')
        .select('*')
        .eq('world_slug', worldSlug)
        .eq('archetype_key', archetypeKey)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching premade character:', error);
        throw new Error('Failed to fetch premade character');
      }

      return this.mapToDTO(data);
    } catch (error) {
      console.error('Unexpected error in getPremadeCharacter:', error);
      throw error;
    }
  }

  /**
   * Validate that a world slug is supported
   * @param worldSlug - World identifier to validate
   * @returns True if valid, false otherwise
   */
  static async validateWorldSlug(worldSlug: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('premade_characters')
        .select('world_slug')
        .eq('world_slug', worldSlug)
        .limit(1);

      if (error) {
        console.error('Error validating world slug:', error);
        return false;
      }

      return (data || []).length > 0;
    } catch (error) {
      console.error('Unexpected error in validateWorldSlug:', error);
      return false;
    }
  }

  /**
   * Map database record to DTO
   * @param record - Database record
   * @returns DTO object
   */
  private static mapToDTO(record: any): PremadeCharacterDTO {
    return {
      id: record.id,
      worldSlug: record.world_slug,
      archetypeKey: record.archetype_key,
      displayName: record.display_name,
      summary: record.summary,
      avatarUrl: record.avatar_url,
      baseTraits: record.base_traits || {},
    };
  }
}
