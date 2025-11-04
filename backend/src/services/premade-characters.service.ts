import { supabaseAdmin } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { getWorldConfig } from '@shared/config/character-creation.config';
import type { PlayerV3 } from '@shared';
import { ApiErrorCode } from '@shared';

export interface PremadeCharacterDTO {
  id: string;
  worldSlug: string;
  worldId: string; // UUID from world_id_mapping
  archetypeKey: string;
  displayName: string;
  summary: string;
  avatarUrl?: string;
  baseTraits: Record<string, unknown>;
}

export class PremadeCharactersService {
  /**
   * Normalize a world identifier (UUID or slug) to a slug if possible.
   * If a UUID is provided, attempts to resolve via world_id_mapping; otherwise
   * returns the identifier unchanged (treated as slug).
   */
  private static async resolveWorldSlug(worldIdentifier: string): Promise<string> {
    try {
      // If it's already a textual slug, return as-is
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worldIdentifier);
      if (!isUUID) return worldIdentifier;

      // Current schema uses world_id_mapping(text_id, uuid_id)
      const { data: mapRow, error: mapErr } = await supabaseAdmin
        .from('world_id_mapping')
        .select('text_id')
        .eq('uuid_id', worldIdentifier)
        .single();

      if (!mapErr && mapRow?.text_id) {
        return mapRow.text_id as string;
      }

      // Fallback: worlds_admin view exposes slug and id (uuid)
      const { data: adminWorld, error: adminErr } = await supabaseAdmin
        .from('worlds_admin')
        .select('slug')
        .eq('id', worldIdentifier)
        .single();

      if (!adminErr && (adminWorld as any)?.slug) {
        return (adminWorld as any).slug as string;
      }
    } catch {
      // ignore and fall back
    }

    // As a last resort, return the original identifier (may match world_id column)
    return worldIdentifier;
  }

  /**
   * Get all active premade characters for a specific world
   * @param worldIdentifier - World identifier (UUID or slug)
   * @returns Array of premade character DTOs
   */
  static async getPremadeCharactersByWorld(worldIdentifier: string): Promise<PremadeCharacterDTO[]> {
    try {
      // Normalize UUID -> slug if possible
      const normalized = await this.resolveWorldSlug(worldIdentifier);
      const isUUID = worldIdentifier.includes('-') && worldIdentifier.length === 36;

      let query = supabaseAdmin
        .from('premade_characters')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      // Query by world_id (UUID) or world_slug (text)
      if (isUUID) {
        // Prefer resolved slug when available to support slug-only datasets
        if (normalized && normalized !== worldIdentifier) {
          query = query.eq('world_slug', normalized);
        } else {
          query = query.eq('world_id', worldIdentifier);
        }
      } else {
        query = query.eq('world_slug', normalized);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching premade characters from database:', error);
        throw new Error(`Failed to fetch premade characters: ${error.message}`);
      }

      const dbCharacters = (data || []).map(this.mapToDTO);
      return dbCharacters;
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
   * Validate that a world identifier (UUID or slug) is supported
   * @param worldIdentifier - World identifier to validate (UUID or slug)
   * @returns True if valid, false otherwise
   */
  static async validateWorldSlug(worldIdentifier: string): Promise<boolean> {
    try {
      // Normalize to slug when possible
      const normalized = await this.resolveWorldSlug(worldIdentifier);
      const isUUID = worldIdentifier.includes('-') && worldIdentifier.length === 36;
      
      let query = supabaseAdmin
        .from('premade_characters')
        .select('world_slug')
        .limit(1);
      
      // Query by world_id (UUID) or world_slug (text)
      if (isUUID) {
        if (normalized && normalized !== worldIdentifier) {
          query = query.eq('world_slug', normalized);
        } else {
          query = query.eq('world_id', worldIdentifier);
        }
      } else {
        query = query.eq('world_slug', normalized);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error validating world from database:', error);
        return false;
      }

      const hasDbCharacters = (data || []).length > 0;
      return hasDbCharacters;
    } catch (error) {
      console.error('Unexpected error in validateWorldSlug:', error);
      return false;
    }
  }

  /**
   * Convert a premade character to PlayerV3 format
   * @param premadeCharacter - Premade character DTO
   * @param customName - Optional custom name for the character
   * @returns PlayerV3 object
   */
  static convertToPlayerV3(premadeCharacter: PremadeCharacterDTO, customName?: string): PlayerV3 {
    const worldConfig = getWorldConfig(premadeCharacter.worldSlug);
    const baseTraits = premadeCharacter.baseTraits;
    
    // Extract character data from baseTraits - now using PlayerV3 format
    const skills = baseTraits.skills as Record<string, number> || {};
    const personalityTraits = baseTraits.personality_traits as string[] || [];
    
    // Map skills to PlayerV3 format - use direct mapping if available, otherwise fallback to legacy mapping
    const playerV3Skills = {
      combat: skills.combat || skills.strength || 50,
      stealth: skills.stealth || skills.dexterity || 50,
      social: skills.social || skills.charisma || 50,
      lore: skills.lore || skills.intelligence || 50,
      survival: skills.survival || skills.constitution || 50,
      medicine: skills.medicine || skills.wisdom || 50,
      craft: skills.craft || 50
    };
    
    // Use PlayerV3 fields directly from baseTraits if available, with proper validation
    const race = (baseTraits.race as string) || worldConfig.availableRaces[0];
    const role = (baseTraits.class as string) || 'Adventurer';
    
    // Ensure essence is an array with 1-4 items
    let essence = (baseTraits.essence as string[]) || worldConfig.essenceOptions.slice(0, 2);
    if (!Array.isArray(essence) || essence.length === 0) {
      essence = worldConfig.essenceOptions.slice(0, 2);
    }
    if (essence.length > 4) {
      essence = essence.slice(0, 4);
    }
    
    const age = (baseTraits.age as string) || 'Young Adult';
    const build = (baseTraits.build as string) || 'Average';
    const eyes = (baseTraits.eyes as string) || 'Brown';
    
    // Ensure traits is an array with 2-4 items
    let traits = (baseTraits.traits as string[]) || personalityTraits.slice(0, 4);
    if (!Array.isArray(traits) || traits.length < 2) {
      traits = personalityTraits.slice(0, 4);
      if (traits.length < 2) {
        traits = ['Brave', 'Determined']; // Fallback traits
      }
    }
    if (traits.length > 4) {
      traits = traits.slice(0, 4);
    }
    
    const backstory = (baseTraits.backstory as string) || premadeCharacter.summary;
    const motivation = (baseTraits.motivation as string) || 'To fulfill their destiny';
    const inventory = (baseTraits.inventory as string[]) || [];
    const goals = (baseTraits.goals as { short_term: string[], long_term: string[] }) || { short_term: [], long_term: [] };
    
    return {
      id: uuidv4(),
      name: customName || premadeCharacter.displayName,
      role,
      race,
      essence,
      age,
      build,
      eyes,
      traits,
      backstory,
      motivation,
      skills: playerV3Skills,
      inventory,
      relationships: {},
      goals,
      flags: {},
      reputation: {}
    };
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
      worldId: record.world_id, // UUID from world_id_mapping
      archetypeKey: record.archetype_key,
      displayName: record.display_name,
      summary: record.summary,
      avatarUrl: record.avatar_url,
      baseTraits: record.base_traits || {},
    };
  }
}
