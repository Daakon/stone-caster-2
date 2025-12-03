import { supabaseAdmin } from './supabase.js';
import { WorldValidationService } from './worldValidation.service.js';
import { PremadeCharactersService } from './premade-characters.service.js';
import type { Character } from '@shared';
import { v4 as uuidv4 } from 'uuid';

export interface CreateCharacterInput {
  name: string;
  worldId: string; // UUID reference to world
  worldSlug?: string; // Optional text slug for display (legacy support)
  // Generic world-specific data
  worldData?: Record<string, unknown>;
  // Legacy fields for backward compatibility
  race?: string;
  class?: string;
  level?: number;
  experience?: number;
  attributes?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
  skills?: string[];
  inventory?: Array<{
    id: string;
    name: string;
    description: string;
    quantity: number;
  }>;
  currentHealth?: number;
  maxHealth?: number;
}

export interface CreateCharacterFromPremadeInput {
  worldId: string; // UUID reference to world
  worldSlug?: string; // Optional text slug for display (legacy support)
  name?: string;
  archetypeKey?: string;
  fromPremade: boolean;
}

export interface UpdateCharacterInput {
  name?: string;
  // Generic world-specific data
  worldData?: Record<string, unknown>;
  // Legacy fields for backward compatibility
  race?: string;
  class?: string;
  level?: number;
  experience?: number;
  attributes?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
  skills?: string[];
  inventory?: Array<{
    id: string;
    name: string;
    description: string;
    quantity: number;
  }>;
  currentHealth?: number;
  maxHealth?: number;
  worldSlug?: string;
}

export interface CharacterQueryOptions {
  userId?: string;
  cookieId?: string;
  worldSlug?: string; // Optional text slug for filtering (legacy support)
  worldId?: string; // UUID for world_id (preferred - direct reference)
  limit?: number;
  offset?: number;
}

/**
 * Characters Service - manages character CRUD operations
 * Handles both authenticated users and guest users via cookies
 */
export class CharactersService {
  /**
   * Create a new character
   */
  static async createCharacter(
    input: CreateCharacterInput,
    ownerId: string,
    isGuest: boolean = false
  ): Promise<Character> {
    try {
      // Validate world exists (optional validation - can be removed if not needed)
      // Note: world_id is now a UUID that directly references the canonical world table
      
      // Calculate health if not provided (for legacy characters)
      const currentHealth = input.currentHealth ?? input.maxHealth ?? (input.attributes?.constitution ? this.calculateMaxHealth(input.attributes.constitution) : 100);
      const maxHealth = input.maxHealth ?? (input.attributes?.constitution ? this.calculateMaxHealth(input.attributes.constitution) : 100);

      const characterData = {
        id: uuidv4(),
        name: input.name,
        world_slug: input.worldSlug || null, // Optional text slug for display (legacy support)
        world_id: input.worldId, // UUID (source of truth - direct reference)
        world_data: input.worldData ?? {},
        // Legacy fields for backward compatibility
        race: input.race,
        class: input.class,
        level: input.level ?? 1,
        experience: input.experience ?? 0,
        attributes: input.attributes,
        skills: input.skills ?? [],
        inventory: input.inventory ?? [],
        current_health: currentHealth,
        max_health: maxHealth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Set owner based on user type
        // Support both cookie_id and user_id for seamless guest-to-user migration
        ...(isGuest ? { cookie_id: ownerId } : { user_id: ownerId })
      };

      console.log('[CHARACTER_CREATE_DATA]', {
        ...characterData,
        world_data: '[REDACTED]',
      });

      const { data, error } = await supabaseAdmin
        .from('characters')
        .insert([characterData])
        .select()
        .single();

      if (error) {
        console.error('Error creating character:', error);
        throw new Error(`Failed to create character: ${error.message}`);
      }

      console.log('[CHARACTER_CREATED_DB_ROW]', {
        id: data.id,
        world_slug: data.world_slug,
        world_id: data.world_id,
        world_id_type: typeof data.world_id,
      });

      return this.mapCharacterFromDb(data);
    } catch (error) {
      console.error('CharactersService.createCharacter error:', error);
      throw error;
    }
  }

  /**
   * Create a new character from a premade template
   */
  static async createCharacterFromPremade(
    input: CreateCharacterFromPremadeInput,
    ownerId: string,
    isGuest: boolean = false
  ): Promise<Character> {
    try {
      if (!input.fromPremade || !input.archetypeKey) {
        throw new Error('Archetype key is required when creating from premade');
      }

      // Get the premade character template from database
      // PremadeCharactersService now uses worldId (UUID) directly
      const premadeCharacter = await PremadeCharactersService.getPremadeCharacter(input.worldId, input.archetypeKey);

      if (!premadeCharacter) {
        throw new Error(`Premade character '${input.archetypeKey}' not found for world`);
      }

      // Convert premade character to PlayerV3 format
      const playerV3 = PremadeCharactersService.convertToPlayerV3(premadeCharacter, input.name);

      // Create character data with PlayerV3 format stored in world_data
      const characterData = {
        id: uuidv4(),
        name: playerV3.name,
        world_slug: input.worldSlug || null, // Optional text slug for display (legacy support)
        world_id: input.worldId, // UUID (source of truth - direct reference)
        world_data: {
          playerV3: playerV3
        },
        // Legacy fields for backward compatibility (can be removed later if not needed)
        race: playerV3.race,
        class: playerV3.role,
        level: 1,
        experience: 0,
        attributes: {
          strength: playerV3.skills.combat || 50,
          dexterity: playerV3.skills.stealth || 50,
          constitution: playerV3.skills.survival || 50,
          intelligence: playerV3.skills.lore || 50,
          wisdom: playerV3.skills.medicine || 50,
          charisma: playerV3.skills.social || 50,
        },
        skills: [],
        inventory: playerV3.inventory || [],
        current_health: 100,
        max_health: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Set owner based on user type
        // Support both cookie_id and user_id for seamless guest-to-user migration
        ...(isGuest ? { cookie_id: ownerId } : { user_id: ownerId })
      };

      const { data, error } = await supabaseAdmin
        .from('characters')
        .insert([characterData])
        .select()
        .single();

      if (error) {
        console.error('Error creating character from premade:', error);
        throw new Error(`Failed to create character: ${error.message}`);
      }

      return this.mapCharacterFromDb(data);
    } catch (error) {
      console.error('CharactersService.createCharacterFromPremade error:', error);
      throw error;
    }
  }

  /**
   * Get characters for a user
   */
  static async getCharacters(
    ownerId: string,
    isGuest: boolean = false,
    options: CharacterQueryOptions = {}
  ): Promise<Character[]> {
    try {
      console.log('[CHARACTERS_GET] Query params:', {
        ownerId,
        isGuest,
        options,
        ownerIdLength: ownerId?.length,
        ownerIdType: typeof ownerId
      });

      let query = supabaseAdmin
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by owner
      if (isGuest) {
        query = query.eq('cookie_id', ownerId);
        console.log('[CHARACTERS_GET] Filtering by cookie_id:', ownerId);
      } else {
        query = query.eq('user_id', ownerId);
        console.log('[CHARACTERS_GET] Filtering by user_id:', ownerId);
      }

      // Additional filters - support both world_id (UUID) and world_slug (text for legacy)
      // Prefer world_id (UUID) as it's the source of truth
      if (options.worldId) {
        query = query.eq('world_id', options.worldId);
        console.log('[CHARACTERS_GET] Filtering by world_id (UUID):', options.worldId);
      } else if (options.worldSlug) {
        // Legacy support: filter by world_slug (text)
        // Note: world_slug is denormalized and may not be reliable
        query = query.eq('world_slug', options.worldSlug);
        console.log('[CHARACTERS_GET] Filtering by world_slug (legacy):', options.worldSlug);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[CHARACTERS_GET] Database error:', error);
        throw new Error(`Failed to fetch characters: ${error.message}`);
      }

      console.log('[CHARACTERS_GET] Query result:', {
        count: data?.length || 0,
        sampleIds: data?.slice(0, 3).map((c: any) => ({ id: c.id, name: c.name, user_id: c.user_id, world_id: c.world_id }))
      });

      return (data || []).map(this.mapCharacterFromDb);
    } catch (error) {
      console.error('[CHARACTERS_GET] Unexpected error:', error);
      throw error;
    }
  }

  /**
   * Get a single character by ID
   */
  static async getCharacterById(
    characterId: string,
    ownerId: string,
    isGuest: boolean = false
  ): Promise<Character | null> {
    try {
      let query = supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', characterId);

      // Filter by owner
      if (isGuest) {
        query = query.eq('cookie_id', ownerId);
      } else {
        query = query.eq('user_id', ownerId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - character not found or not owned by user
          return null;
        }
        console.error('Error fetching character:', error);
        throw new Error(`Failed to fetch character: ${error.message}`);
      }

      console.log('[CHARACTER_DB_RAW_FULL]', JSON.stringify(data, null, 2));
      console.log('[CHARACTER_DB_RAW]', {
        id: data.id,
        name: data.name,
        world_slug: data.world_slug,
        world_id: data.world_id,
        world_id_type: typeof data.world_id,
      });

      const mapped = this.mapCharacterFromDb(data);
      console.log('[CHARACTER_MAPPED]', {
        id: mapped.id,
        worldSlug: mapped.worldSlug,
        worldId: mapped.worldId,
        worldId_type: typeof mapped.worldId,
      });

      return mapped;
    } catch (error) {
      console.error('CharactersService.getCharacterById error:', error);
      throw error;
    }
  }

  /**
   * Update a character
   */
  static async updateCharacter(
    characterId: string,
    input: UpdateCharacterInput,
    ownerId: string,
    isGuest: boolean = false
  ): Promise<Character | null> {
    try {
      // Validate world slug if provided
      if (input.worldSlug) {
        const worldValidation = await WorldValidationService.validateWorldSlug(input.worldSlug);
        if (!worldValidation.isValid) {
          throw new Error(worldValidation.error || 'Invalid world slug');
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are provided
      if (input.name !== undefined) updateData.name = input.name;
      if (input.race !== undefined) updateData.race = input.race;
      if (input.class !== undefined) updateData.class = input.class;
      if (input.level !== undefined) updateData.level = input.level;
      if (input.experience !== undefined) updateData.experience = input.experience;
      if (input.attributes !== undefined) updateData.attributes = input.attributes;
      if (input.skills !== undefined) updateData.skills = input.skills;
      if (input.inventory !== undefined) updateData.inventory = input.inventory;
      if (input.currentHealth !== undefined) updateData.current_health = input.currentHealth;
      if (input.maxHealth !== undefined) updateData.max_health = input.maxHealth;
      if (input.worldSlug !== undefined) updateData.world_slug = input.worldSlug;

      let query = supabaseAdmin
        .from('characters')
        .update(updateData)
        .eq('id', characterId);

      // Filter by owner
      if (isGuest) {
        query = query.eq('cookie_id', ownerId);
      } else {
        query = query.eq('user_id', ownerId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - character not found or not owned by user
          return null;
        }
        console.error('Error updating character:', error);
        throw new Error(`Failed to update character: ${error.message}`);
      }

      return this.mapCharacterFromDb(data);
    } catch (error) {
      console.error('CharactersService.updateCharacter error:', error);
      throw error;
    }
  }

  /**
   * Delete a character
   */
  static async deleteCharacter(
    characterId: string,
    ownerId: string,
    isGuest: boolean = false
  ): Promise<boolean> {
    try {
      let query = supabaseAdmin
        .from('characters')
        .delete()
        .eq('id', characterId);

      // Filter by owner
      if (isGuest) {
        query = query.eq('cookie_id', ownerId);
      } else {
        query = query.eq('user_id', ownerId);
      }

      const { error } = await query;

      if (error) {
        console.error('Error deleting character:', error);
        throw new Error(`Failed to delete character: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('CharactersService.deleteCharacter error:', error);
      throw error;
    }
  }

  /**
   * Check if a character exists and is owned by the user
   */
  static async isCharacterOwnedBy(
    characterId: string,
    ownerId: string,
    isGuest: boolean = false
  ): Promise<boolean> {
    try {
      const character = await this.getCharacterById(characterId, ownerId, isGuest);
      return character !== null;
    } catch (error) {
      console.error('CharactersService.isCharacterOwnedBy error:', error);
      return false;
    }
  }

  /**
   * Get character count for a user
   */
  static async getCharacterCount(
    ownerId: string,
    isGuest: boolean = false
  ): Promise<number> {
    try {
      let query = supabaseAdmin
        .from('characters')
        .select('id', { count: 'exact' });

      // Filter by owner
      if (isGuest) {
        query = query.eq('cookie_id', ownerId);
      } else {
        query = query.eq('user_id', ownerId);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error counting characters:', error);
        throw new Error(`Failed to count characters: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error('CharactersService.getCharacterCount error:', error);
      throw error;
    }
  }

  /**
   * Calculate max health based on constitution
   */
  private static calculateMaxHealth(constitution: number): number {
    // Basic formula: 8 + constitution modifier
    const modifier = Math.floor((constitution - 10) / 2);
    return Math.max(1, 8 + modifier);
  }

  /**
   * Map database row to Character type
   */
  private static mapCharacterFromDb(dbRow: any): Character {
    return {
      id: dbRow.id,
      userId: dbRow.user_id || undefined,
      cookieId: dbRow.cookie_id || undefined,
      name: dbRow.name,
      worldSlug: dbRow.world_slug || undefined, // Optional text slug for display (legacy/denormalized)
      worldId: dbRow.world_id, // UUID (direct reference to canonical world table) - source of truth
      activeGameId: dbRow.active_game_id || undefined,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      // Generic world-specific data
      worldData: dbRow.world_data || {},
      // Legacy fields for backward compatibility
      race: dbRow.race,
      class: dbRow.class,
      level: dbRow.level,
      experience: dbRow.experience,
      attributes: dbRow.attributes,
      skills: dbRow.skills,
      inventory: dbRow.inventory,
      currentHealth: dbRow.current_health,
      maxHealth: dbRow.max_health,
    };
  }
}
