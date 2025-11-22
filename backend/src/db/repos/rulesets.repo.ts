/**
 * Rulesets Repository
 * Handles CRUD operations for Chimera ruleset templates
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';
import { RulesetDefinitionSchema } from '@shared/types/chimera-authoring';

export class RulesetsRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new ruleset template
   * Extracts ui_category and exclusion_group from the definition and stores them as columns
   * @param def - The RulesetDefinition object
   * @returns The ID of the created ruleset
   */
  async create(def: RulesetDefinition): Promise<string> {
    // Validate the definition
    const validated = RulesetDefinitionSchema.parse(def);

    // Extract ui_category and exclusion_group for indexing/filtering
    const ui_category = validated.ui_category;
    const exclusion_group = validated.exclusion_group;

    // Use the id from the definition as the key, or generate one
    const key = validated.id;

    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .insert({
        key,
        ui_category,
        exclusion_group,
        dependencies: validated.dependencies,
        definition: validated as unknown as Record<string, unknown>,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create ruleset: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create ruleset: No data returned');
    }

    return data.id;
  }

  /**
   * Find rulesets by UI category
   * @param category - The UI category to filter by
   * @returns Array of RulesetDefinition objects
   */
  async findByCategory(category: string): Promise<RulesetDefinition[]> {
    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('definition')
      .eq('ui_category', category);

    if (error) {
      throw new Error(`Failed to find rulesets by category: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each definition
    return data.map((row) => {
      const parsed = RulesetDefinitionSchema.parse(row.definition);
      return parsed;
    });
  }

  /**
   * Find rulesets by their IDs
   * @param ids - Array of ruleset IDs (keys)
   * @returns Array of RulesetDefinition objects
   */
  async findByIds(ids: string[]): Promise<RulesetDefinition[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('definition')
      .in('key', ids);

    if (error) {
      throw new Error(`Failed to find rulesets by IDs: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each definition
    return data.map((row) => {
      const parsed = RulesetDefinitionSchema.parse(row.definition);
      return parsed;
    });
  }

  /**
   * Get a single ruleset by key
   * @param key - The ruleset key
   * @returns RulesetDefinition or null if not found
   */
  async findByKey(key: string): Promise<RulesetDefinition | null> {
    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('definition')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find ruleset by key: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return RulesetDefinitionSchema.parse(data.definition);
  }

  /**
   * Get a single ruleset by UUID
   * @param id - The ruleset UUID
   * @returns RulesetDefinition or null if not found
   */
  async findById(id: string): Promise<RulesetDefinition | null> {
    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('definition')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find ruleset by ID: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return RulesetDefinitionSchema.parse(data.definition);
  }

  /**
   * Get the key for a ruleset by UUID
   * @param id - The ruleset UUID
   * @returns The key or null if not found or key is empty
   */
  async getKeyById(id: string): Promise<string | null> {
    console.log('[RulesetsRepository] getKeyById() called with UUID:', id);
    
    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('key')
      .eq('id', id)
      .single();

    console.log('[RulesetsRepository] getKeyById() Supabase response:', { data, error });

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[RulesetsRepository] getKeyById() Not found (PGRST116)');
        return null; // Not found
      }
      console.error('[RulesetsRepository] getKeyById() Error:', error);
      throw new Error(`Failed to get key by ID: ${error.message}`);
    }

    // Handle empty string key (legacy data)
    const key = data?.key && data.key.trim() !== '' ? data.key : null;
    console.log('[RulesetsRepository] getKeyById() Returning key:', key);
    return key;
  }

  /**
   * Update a ruleset by UUID (for cases where key is missing)
   * @param id - The ruleset UUID
   * @param def - The updated RulesetDefinition object
   */
  async updateById(id: string, def: RulesetDefinition): Promise<void> {
    console.log('[RulesetsRepository] updateById() called with UUID:', id);
    console.log('[RulesetsRepository] updateById() definition:', JSON.stringify(def, null, 2));
    
    // Validate the definition
    const validated = RulesetDefinitionSchema.parse(def);
    console.log('[RulesetsRepository] updateById() validated definition');

    // Extract ui_category and exclusion_group for indexing/filtering
    const ui_category = validated.ui_category;
    const exclusion_group = validated.exclusion_group;
    console.log('[RulesetsRepository] updateById() extracted fields:', { ui_category, exclusion_group });

    // Use the id from definition as the key if key is missing
    const key = validated.id;
    console.log('[RulesetsRepository] updateById() using key from definition:', key);

    const updatePayload = {
      key, // Set/update the key from the definition
      ui_category,
      exclusion_group,
      dependencies: validated.dependencies,
      definition: validated as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };
    console.log('[RulesetsRepository] updateById() update payload:', JSON.stringify(updatePayload, null, 2));

    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .update(updatePayload)
      .eq('id', id)
      .select();

    console.log('[RulesetsRepository] updateById() Supabase response:', { data, error });

    if (error) {
      console.error('[RulesetsRepository] updateById() Supabase error:', error);
      throw new Error(`Failed to update ruleset: ${error.message}`);
    }
    
    console.log('[RulesetsRepository] updateById() Success');
  }

  /**
   * Update a ruleset by key
   * @param key - The ruleset key
   * @param def - The updated RulesetDefinition object
   */
  async update(key: string, def: RulesetDefinition): Promise<void> {
    console.log('[RulesetsRepository] update() called with key:', key);
    console.log('[RulesetsRepository] update() definition:', JSON.stringify(def, null, 2));
    
    // Validate the definition
    const validated = RulesetDefinitionSchema.parse(def);
    console.log('[RulesetsRepository] update() validated definition');

    // Extract ui_category and exclusion_group for indexing/filtering
    const ui_category = validated.ui_category;
    const exclusion_group = validated.exclusion_group;
    console.log('[RulesetsRepository] update() extracted fields:', { ui_category, exclusion_group });

    const updatePayload = {
      ui_category,
      exclusion_group,
      dependencies: validated.dependencies,
      definition: validated as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };
    console.log('[RulesetsRepository] update() update payload:', JSON.stringify(updatePayload, null, 2));

    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .update(updatePayload)
      .eq('key', key)
      .select();

    console.log('[RulesetsRepository] update() Supabase response:', { data, error });

    if (error) {
      console.error('[RulesetsRepository] update() Supabase error:', error);
      throw new Error(`Failed to update ruleset: ${error.message}`);
    }
    
    console.log('[RulesetsRepository] update() Success');
  }
}

