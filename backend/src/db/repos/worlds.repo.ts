/**
 * Worlds Repository
 * Handles CRUD operations for Chimera worlds
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { WorldDefinition } from '@shared/types/chimera-authoring';
import { WorldDefinitionSchema } from '@shared/types/chimera-authoring';

export class WorldsRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new world
   * @param world - The WorldDefinition object
   * @param key - Optional key (defaults to world.id)
   * @param ownerId - Optional owner ID
   * @returns The ID of the created world
   */
  async create(world: WorldDefinition, key?: string, ownerId?: string): Promise<string> {
    // Validate the world definition
    const validated = WorldDefinitionSchema.parse(world);

    const worldKey = key || validated.id;

    const { data, error } = await (this.supabase
      .from('chimera_worlds') as any)
      .insert({
        key: worldKey,
        definition: validated as unknown as Record<string, unknown>,
        owner_id: ownerId || null,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create world: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create world: No data returned');
    }

    return data.id;
  }

  /**
   * Get a world by key
   * @param key - The world key
   * @returns WorldDefinition or null if not found
   */
  async findByKey(key: string): Promise<WorldDefinition | null> {
    const { data, error } = await (this.supabase
      .from('chimera_worlds') as any)
      .select('definition')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find world by key: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return WorldDefinitionSchema.parse(data.definition);
  }

  /**
   * Get a world by ID
   * @param id - The world UUID
   * @returns WorldDefinition or null if not found
   */
  async findById(id: string): Promise<WorldDefinition | null> {
    const { data, error } = await (this.supabase
      .from('chimera_worlds') as any)
      .select('definition')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find world by ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return WorldDefinitionSchema.parse(data.definition);
  }

  /**
   * Get the key for a world by ID
   * @param id - The world UUID
   * @returns The key or null if not found
   */
  async getKeyById(id: string): Promise<string | null> {
    const { data, error } = await (this.supabase
      .from('chimera_worlds') as any)
      .select('key')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get key by ID: ${error.message}`);
    }

    return data?.key || null;
  }

  /**
   * Update a world by key
   * @param key - The world key
   * @param world - The updated WorldDefinition object
   */
  async update(key: string, world: WorldDefinition): Promise<void> {
    // Validate the world definition
    const validated = WorldDefinitionSchema.parse(world);

    // Explicitly ensure images are preserved in definition JSONB
    const definitionToSave: any = {
      ...validated,
      images: validated.images || [], // Explicitly save images array (even if empty)
    };

    const { error } = await (this.supabase
      .from('chimera_worlds') as any)
      .update({
        definition: definitionToSave as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to update world: ${error.message}`);
    }
  }

  /**
   * Delete a world by key
   * @param key - The world key
   */
  async delete(key: string): Promise<void> {
    const { error } = await (this.supabase
      .from('chimera_worlds') as any)
      .delete()
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to delete world: ${error.message}`);
    }
  }

  /**
   * List all worlds
   * @returns Array of WorldDefinition objects
   */
  async listAll(): Promise<WorldDefinition[]> {
    const { data, error } = await (this.supabase
      .from('chimera_worlds') as any)
      .select('id, definition');

    if (error) {
      throw new Error(`Failed to list worlds: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each world definition, ensuring images are preserved
    return data.map((row) => {
      const definition = row.definition as any;
      
      // Extract images from definition if present (CRITICAL: preserve images)
      const images = Array.isArray(definition?.images) ? definition.images : [];
      
      // Parse with schema (may fail if structure doesn't match exactly)
      try {
        const parsed = WorldDefinitionSchema.parse(definition);
        // CRITICAL: Always use images from definition, even if schema parsing changed them
        return {
          ...parsed,
          id: row.id || parsed.id, // Use database UUID as ID
          images: images, // Explicitly preserve images from definition
        };
      } catch (parseError) {
        // If schema parsing fails, construct a valid WorldDefinition
        // This handles cases where definition structure doesn't match schema exactly
        // CRITICAL: Always preserve images from definition
        const description = definition?.description 
          || definition?.description_long 
          || definition?.description_short 
          || '';
        
        return {
          id: row.id || definition?.id || '',
          name: definition?.name || definition?.display_name || '',
          description: description,
          images: images, // Explicitly preserve images from definition JSONB
          tags: definition?.tags || [],
          character_schema_extensions: definition?.character_schema_extensions || {},
          lore_fragments: definition?.lore_fragments || [],
        };
      }
    });
  }
}

