import { supabaseAdmin } from './supabase.js';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  payload: Record<string, unknown>;
  updated_at: string;
}

export class FeatureFlagsService {
  /**
   * Get all feature flags
   */
  static async getAllFlags(): Promise<FeatureFlag[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .select('*')
        .order('key');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      throw error;
    }
  }

  /**
   * Update a feature flag
   */
  static async updateFlag(
    key: string,
    updates: {
      enabled?: boolean;
      payload?: Record<string, unknown>;
    }
  ): Promise<FeatureFlag> {
    try {
      const updateData: Partial<FeatureFlag> = {};
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.payload !== undefined) updateData.payload = updates.payload;

      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .update(updateData)
        .eq('key', key)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error(`Feature flag not found: ${key}`);
      }

      return data;
    } catch (error) {
      console.error(`Error updating feature flag ${key}:`, error);
      throw error;
    }
  }

  /**
   * Create a new feature flag
   */
  static async createFlag(
    key: string,
    enabled: boolean = false,
    payload: Record<string, unknown> = {}
  ): Promise<FeatureFlag> {
    try {
      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .insert({
          key,
          enabled,
          payload,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error creating feature flag ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific feature flag
   */
  static async getFlag(key: string): Promise<FeatureFlag | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error fetching feature flag ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a feature flag
   */
  static async deleteFlag(key: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('feature_flags')
        .delete()
        .eq('key', key);

      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting feature flag ${key}:`, error);
      throw error;
    }
  }
}
