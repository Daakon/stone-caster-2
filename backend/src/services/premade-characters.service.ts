import { supabaseAdmin } from './supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getWorldConfig } from '@shared/config/character-creation.config';
import type { PlayerV3 } from '@shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
   * Load mock premade characters data from JSON file
   */
  private static loadMockPremadeCharacters(): any[] {
    try {
      // Path to the frontend mock data - try multiple possible locations
      const possiblePaths = [
        join(__dirname, '../../../frontend/src/mock/premadeCharacters.json'), // From backend/dist/services
        join(__dirname, '../../../../frontend/src/mock/premadeCharacters.json'), // From backend/dist
        join(process.cwd(), 'frontend/src/mock/premadeCharacters.json'), // From project root
      ];
      
      let mockPath = '';
      for (const path of possiblePaths) {
        try {
          readFileSync(path, 'utf-8');
          mockPath = path;
          break;
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!mockPath) {
        throw new Error(`Could not find premadeCharacters.json in any of the expected locations: ${possiblePaths.join(', ')}`);
      }
      
      const mockData = readFileSync(mockPath, 'utf-8');
      return JSON.parse(mockData);
    } catch (error) {
      console.error('Error loading mock premade characters:', error);
      return [];
    }
  }

  /**
   * Get all active premade characters for a specific world
   * @param worldIdentifier - World identifier (UUID or slug)
   * @returns Array of premade character DTOs
   */
  static async getPremadeCharactersByWorld(worldIdentifier: string): Promise<PremadeCharacterDTO[]> {
    try {
      // Check if worldIdentifier is a UUID (has dashes) or a slug
      const isUUID = worldIdentifier.includes('-') && worldIdentifier.length === 36;
      
      let query = supabaseAdmin
        .from('premade_characters')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      // Query by world_id (UUID) or world_slug (text)
      if (isUUID) {
        query = query.eq('world_id', worldIdentifier);
      } else {
        query = query.eq('world_slug', worldIdentifier);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching premade characters from database:', error);
        // Fall back to mock data
        return this.getMockPremadeCharactersByWorld(worldIdentifier);
      }

      const dbCharacters = (data || []).map(this.mapToDTO);
      
      // If no characters found in database, try mock data
      if (dbCharacters.length === 0) {
        console.log(`No premade characters found in database for world '${worldIdentifier}', trying mock data`);
        return this.getMockPremadeCharactersByWorld(worldIdentifier);
      }

      return dbCharacters;
    } catch (error) {
      console.error('Unexpected error in getPremadeCharactersByWorld:', error);
      // Fall back to mock data
      return this.getMockPremadeCharactersByWorld(worldIdentifier);
    }
  }

  /**
   * Get mock premade characters for a specific world
   */
  private static getMockPremadeCharactersByWorld(worldSlug: string): PremadeCharacterDTO[] {
    const mockCharacters = this.loadMockPremadeCharacters();
    const worldCharacters = mockCharacters.filter(char => char.worldId === worldSlug);
    
    return worldCharacters.map(char => ({
      id: char.id,
      worldSlug: char.worldId,
      archetypeKey: char.id, // Use the ID as archetype key for mock data
      displayName: char.name,
      summary: char.backstory,
      avatarUrl: undefined,
      baseTraits: {
        class: char.class,
        skills: char.skills,
        worldSpecificData: char.worldSpecificData,
        ...char
      },
      isActive: true,
      createdAt: char.createdAt || new Date().toISOString(),
      updatedAt: char.createdAt || new Date().toISOString()
    }));
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
      // Check if worldIdentifier is a UUID (has dashes) or a slug
      const isUUID = worldIdentifier.includes('-') && worldIdentifier.length === 36;
      
      let query = supabaseAdmin
        .from('premade_characters')
        .select('world_slug')
        .limit(1);

      // Query by world_id (UUID) or world_slug (text)
      if (isUUID) {
        query = query.eq('world_id', worldIdentifier);
      } else {
        query = query.eq('world_slug', worldIdentifier);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error validating world from database:', error);
        // Fall back to mock data validation
        return this.validateWorldSlugFromMock(worldIdentifier);
      }

      const hasDbCharacters = (data || []).length > 0;
      
      // If no characters in database, check mock data
      if (!hasDbCharacters) {
        return this.validateWorldSlugFromMock(worldIdentifier);
      }

      return hasDbCharacters;
    } catch (error) {
      console.error('Unexpected error in validateWorldSlug:', error);
      // Fall back to mock data validation
      return this.validateWorldSlugFromMock(worldIdentifier);
    }
  }

  /**
   * Validate world slug using mock data
   */
  private static validateWorldSlugFromMock(worldSlug: string): boolean {
    const mockCharacters = this.loadMockPremadeCharacters();
    return mockCharacters.some(char => char.worldId === worldSlug);
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
