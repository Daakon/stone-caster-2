/**
 * Rulesets Repository
 * Handles CRUD operations for Chimera ruleset templates
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase-client.js';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';
import { RulesetDefinitionSchema } from '@shared/types/chimera-authoring';

export class RulesetsRepository {
  constructor(private supabase: SupabaseClient<Database>) { }

  /**
   * Generate a unique key from a name
   * Creates a slug-like identifier that's safe for use as a database key
   */
  private generateKeyFromName(name: string): string {
    if (!name || !name.trim()) {
      // Fallback to timestamp-based key if name is empty
      return `ruleset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // Convert to lowercase, replace spaces with dashes, remove special chars
    const baseKey = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return baseKey || `ruleset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Ensure a key is unique by appending a suffix if needed
   */
  private async ensureUniqueKey(baseKey: string): Promise<string> {
    let key = baseKey;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Check if key exists
      const { data, error } = await this.supabase
        .from('chimera_ruleset_templates')
        .select('key')
        .eq('key', key)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found", which is what we want
        throw new Error(`Failed to check key uniqueness: ${error.message}`);
      }

      if (!data) {
        // Key doesn't exist, we can use it
        return key;
      }

      // Key exists, append a suffix
      attempts++;
      key = `${baseKey}-${attempts}`;
    }

    // Fallback to timestamp-based key if we can't find a unique one
    return `ruleset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

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
    // Extract description fields for separate storage
    const description_short = validated.description_short || null;
    const description_long = validated.description_long || null;

    // Use the id from the definition as the key, or generate one from the name
    let key = validated.id?.trim() || '';

    // If id is empty, generate a unique key from the name
    if (!key) {
      const baseKey = this.generateKeyFromName(validated.name);
      key = await this.ensureUniqueKey(baseKey);
    } else {
      // If id is provided, check if it already exists (for create operations, this should fail)
      const { data: existing } = await this.supabase
        .from('chimera_ruleset_templates')
        .select('key')
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        throw new Error(`Ruleset with key "${key}" already exists. Please use a different key or leave it empty to auto-generate.`);
      }
    }

    // Update the definition with the final key
    const definitionWithKey = {
      ...validated,
      id: key,
    };

    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .insert({
        key,
        ui_category,
        exclusion_group,
        description_short,
        description_long,
        dependencies: validated.dependencies,
        definition: definitionWithKey as unknown as Record<string, unknown>,
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
      .select('id, key, definition')
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
      return { ...parsed, id: row.id, key: row.key || parsed.id || parsed.key };
    });
  }

  /**
   * Find ruleset IDs by their keys (slugs)
   * Efficiently resolves a list of slugs to their corresponding UUIDs
   * @param keys - Array of ruleset keys (slugs)
   * @returns Array of UUID strings
   */
  async findIdsByKeys(keys: string[]): Promise<string[]> {
    if (!keys || keys.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('id')
      .in('key', keys);

    if (error) {
      throw new Error(`Failed to find ruleset IDs by keys: ${error.message}`);
    }

    return (data || []).map(row => row.id);
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
      .select('id, key, definition')
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
      return { ...parsed, id: row.id, key: row.key || parsed.id || parsed.key };
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
    // Extract description fields
    const description_short = validated.description_short || null;
    const description_long = validated.description_long || null;
    console.log('[RulesetsRepository] updateById() extracted fields:', { ui_category, exclusion_group, description_short, description_long });

    // Use the id from definition as the key if key is missing
    const key = validated.id;
    console.log('[RulesetsRepository] updateById() using key from definition:', key);

    const updatePayload = {
      key, // Set/update the key from the definition
      ui_category,
      exclusion_group,
      description_short,
      description_long,
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
    // Extract description fields
    const description_short = validated.description_short || null;
    const description_long = validated.description_long || null;
    console.log('[RulesetsRepository] update() extracted fields:', { ui_category, exclusion_group, description_short, description_long });

    const updatePayload = {
      ui_category,
      exclusion_group,
      description_short,
      description_long,
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

  /**
   * List all rulesets
   * @returns Array of RulesetDefinition objects
   */
  async listAll(): Promise<RulesetDefinition[]> {
    const { data, error } = await this.supabase
      .from('chimera_ruleset_templates')
      .select('id, key, definition')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list rulesets: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Parse and validate each definition
    return data.map((row) => {
      const parsed = RulesetDefinitionSchema.parse(row.definition);
      // Ensure 'key' is set from the DB column (preferred) or the definition ID
      return { ...parsed, id: row.id, key: row.key || parsed.id };
    });
  }
}

