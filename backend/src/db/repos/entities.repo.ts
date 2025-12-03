/**
 * Entities Repository
 * Handles CRUD operations for Chimera entities
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { EntityTemplate } from '@shared/types/chimera-authoring';
import { EntityTemplateSchema } from '@shared/types/chimera-authoring';

export class EntitiesRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new entity
   * @param entity - The EntityTemplate object
   * @param key - Optional key (defaults to entity.id)
   * @returns The ID of the created entity
   */
  async create(entity: EntityTemplate, key?: string): Promise<string> {
    // Validate the entity template
    const validated = EntityTemplateSchema.parse(entity);

    const entityKey = key || validated.id;

    const { data, error } = await this.supabase
      .from('chimera_entities')
      .insert({
        key: entityKey,
        kind: validated.kind,
        raw_data: validated.raw_data as unknown as Record<string, unknown>,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create entity: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create entity: No data returned');
    }

    return data.id;
  }

  /**
   * Get an entity by key
   * @param key - The entity key
   * @returns EntityTemplate or null if not found
   */
  async findByKey(key: string): Promise<EntityTemplate | null> {
    const { data, error } = await this.supabase
      .from('chimera_entities')
      .select('kind, raw_data')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find entity by key: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return EntityTemplateSchema.parse({
      id: key, // Use key as id for the template
      kind: data.kind,
      raw_data: data.raw_data,
    });
  }

  /**
   * Get an entity by ID
   * @param id - The entity UUID
   * @returns EntityTemplate or null if not found
   */
  async findById(id: string): Promise<EntityTemplate | null> {
    const { data, error } = await this.supabase
      .from('chimera_entities')
      .select('id, kind, raw_data')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find entity by ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return EntityTemplateSchema.parse({
      id: data.id,
      kind: data.kind,
      raw_data: data.raw_data,
    });
  }

  /**
   * Update an entity by key
   * @param key - The entity key
   * @param entity - The updated EntityTemplate object
   */
  async update(key: string, entity: EntityTemplate): Promise<void> {
    // Validate the entity template
    const validated = EntityTemplateSchema.parse(entity);

    const { error } = await this.supabase
      .from('chimera_entities')
      .update({
        kind: validated.kind,
        raw_data: validated.raw_data as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to update entity: ${error.message}`);
    }
  }

  /**
   * Delete an entity by key
   * @param key - The entity key
   */
  async delete(key: string): Promise<void> {
    const { error } = await this.supabase
      .from('chimera_entities')
      .delete()
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to delete entity: ${error.message}`);
    }
  }

  /**
   * Find entities by their IDs
   * @param ids - Array of entity UUIDs
   * @returns Array of EntityTemplate objects
   */
  async findByIds(ids: string[]): Promise<EntityTemplate[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('chimera_entities')
      .select('id, kind, raw_data')
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to find entities by IDs: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each entity template
    return data.map((row) => {
      return EntityTemplateSchema.parse({
        id: row.id,
        kind: row.kind,
        raw_data: row.raw_data,
      });
    });
  }

  /**
   * List all entities
   * @returns Array of EntityTemplate objects
   */
  async listAll(): Promise<EntityTemplate[]> {
    const { data, error } = await this.supabase
      .from('chimera_entities')
      .select('id, kind, raw_data');

    if (error) {
      throw new Error(`Failed to list entities: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each entity template
    return data.map((row) => {
      return EntityTemplateSchema.parse({
        id: row.id,
        kind: row.kind,
        raw_data: row.raw_data,
      });
    });
  }
}

