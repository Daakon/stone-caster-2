import { supabaseAdmin } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { getWorldConfig } from '@shared/config/character-creation.config';
import type { PlayerV3 } from '@shared';
import { ApiErrorCode } from '@shared';

export interface PremadeCharacterDTO {
  id: string;
  worldId: string; // UUID reference to chimera_worlds.id (canonical)
  worldSlug?: string; // Optional text slug for display (legacy/denormalized)
  archetypeKey: string;
  displayName: string;
  summary: string;
  avatarUrl?: string;
  baseTraits: Record<string, unknown>;
}

export class PremadeCharactersService {
  /**
   * Validate that a world UUID exists in the canonical world table
   * @param worldId - World UUID to validate
   * @returns True if valid, false otherwise
   */
  private static async validateWorldExists(worldId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('chimera_worlds')
        .select('id')
        .eq('id', worldId)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Get all active premade characters for a specific world
   * @param worldId - World UUID (canonical reference)
   * @returns Array of premade character DTOs
   */
  static async getPremadeCharactersByWorld(worldId: string): Promise<PremadeCharacterDTO[]> {
    try {
      // Validate world UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worldId);
      if (!isUUID) {
        throw new Error(`Invalid world ID format: ${worldId}. Expected UUID.`);
      }

      // Validate world exists
      const isValid = await this.validateWorldExists(worldId);
      if (!isValid) {
        throw new Error(`World '${worldId}' not found in chimera_worlds`);
      }

      const { data, error } = await supabaseAdmin
        .from('premade_characters')
        .select('*')
        .eq('world_id', worldId)
        .eq('is_active', true)
        .order('display_name');

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
   * @param worldId - World UUID (canonical reference)
   * @param archetypeKey - Archetype identifier
   * @returns Premade character DTO or null if not found
   */
  static async getPremadeCharacter(worldId: string, archetypeKey: string): Promise<PremadeCharacterDTO | null> {
    try {
      // Validate world UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worldId);
      if (!isUUID) {
        throw new Error(`Invalid world ID format: ${worldId}. Expected UUID.`);
      }

      const { data, error } = await supabaseAdmin
        .from('premade_characters')
        .select('*')
        .eq('world_id', worldId)
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
   * Validate that a world UUID is supported (has premade characters)
   * @param worldId - World UUID to validate
   * @returns True if valid and has premade characters, false otherwise
   */
  static async validateWorldId(worldId: string): Promise<boolean> {
    try {
      // Validate world UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worldId);
      if (!isUUID) {
        return false;
      }

      // Validate world exists in canonical table
      const worldExists = await this.validateWorldExists(worldId);
      if (!worldExists) {
        return false;
      }

      // Check if world has premade characters
      const { data, error } = await supabaseAdmin
        .from('premade_characters')
        .select('id')
        .eq('world_id', worldId)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error validating world from database:', error);
        return false;
      }

      return (data || []).length > 0;
    } catch (error) {
      console.error('Unexpected error in validateWorldId:', error);
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
    // Note: getWorldConfig may need to be updated to accept worldId instead of worldSlug
    // For now, use worldSlug if available, otherwise fallback
    const worldSlug = premadeCharacter.worldSlug || 'default';
    const worldConfig = getWorldConfig(worldSlug);
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
      worldId: record.world_id, // UUID reference to chimera_worlds.id (canonical)
      worldSlug: record.world_slug || undefined, // Optional text slug for display (legacy/denormalized)
      archetypeKey: record.archetype_key,
      displayName: record.display_name,
      summary: record.summary,
      avatarUrl: record.avatar_url,
      baseTraits: record.base_traits || {},
    };
  }
}
