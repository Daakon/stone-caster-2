import { supabaseAdmin } from './supabase.js';
import { WorldValidationService } from './worldValidation.service.js';
import type { Character } from 'shared';
import { v4 as uuidv4 } from 'uuid';

export interface CreateCharacterInput {
  name: string;
  race: string;
  class: string;
  level?: number;
  experience?: number;
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
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
  worldSlug: string;
}

export interface UpdateCharacterInput {
  name?: string;
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
  worldSlug?: string;
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
      // Validate world slug
      const worldValidation = await WorldValidationService.validateWorldSlug(input.worldSlug);
      if (!worldValidation.isValid) {
        throw new Error(worldValidation.error || 'Invalid world slug');
      }

      // Calculate health if not provided
      const currentHealth = input.currentHealth ?? input.maxHealth ?? this.calculateMaxHealth(input.attributes.constitution);
      const maxHealth = input.maxHealth ?? this.calculateMaxHealth(input.attributes.constitution);

      const characterData = {
        id: uuidv4(),
        name: input.name,
        race: input.race,
        class: input.class,
        level: input.level ?? 1,
        experience: input.experience ?? 0,
        attributes: input.attributes,
        skills: input.skills ?? [],
        inventory: input.inventory ?? [],
        current_health: currentHealth,
        max_health: maxHealth,
        world_slug: input.worldSlug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Set owner based on user type
        ...(isGuest ? { cookie_id: ownerId } : { user_id: ownerId })
      };

      const { data, error } = await supabaseAdmin
        .from('characters')
        .insert([characterData])
        .select()
        .single();

      if (error) {
        console.error('Error creating character:', error);
        throw new Error(`Failed to create character: ${error.message}`);
      }

      return this.mapCharacterFromDb(data);
    } catch (error) {
      console.error('CharactersService.createCharacter error:', error);
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
      let query = supabaseAdmin
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by owner
      if (isGuest) {
        query = query.eq('cookie_id', ownerId);
      } else {
        query = query.eq('user_id', ownerId);
      }

      // Additional filters
      if (options.worldSlug) {
        query = query.eq('world_slug', options.worldSlug);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching characters:', error);
        throw new Error(`Failed to fetch characters: ${error.message}`);
      }

      return (data || []).map(this.mapCharacterFromDb);
    } catch (error) {
      console.error('CharactersService.getCharacters error:', error);
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

      return this.mapCharacterFromDb(data);
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
      race: dbRow.race,
      class: dbRow.class,
      level: dbRow.level,
      experience: dbRow.experience,
      attributes: dbRow.attributes,
      skills: dbRow.skills,
      inventory: dbRow.inventory,
      currentHealth: dbRow.current_health,
      maxHealth: dbRow.max_health,
      worldSlug: dbRow.world_slug,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
    };
  }
}
