import { supabaseAdmin } from './supabase.js';

export interface ConfigRow {
  key: string;
  value: any;
  type?: string;
  updated_at: string;
}

export interface ConfigMetaRow {
  version: number;
  updated_at: string;
}

export class AdminConfigService {
  /**
   * Get all configuration tables (full, not redacted)
   */
  static async getAllConfig(): Promise<{
    app: ConfigRow[];
    pricing: ConfigRow[];
    ai: ConfigRow[];
  }> {
    try {
      const [appRes, pricingRes, aiRes] = await Promise.all([
        supabaseAdmin.from('app_config').select('*').order('key'),
        supabaseAdmin.from('pricing_config').select('*').order('key'),
        supabaseAdmin.from('ai_config').select('*').order('key'),
      ]);

      if (appRes.error) throw appRes.error;
      if (pricingRes.error) throw pricingRes.error;
      if (aiRes.error) throw aiRes.error;

      return {
        app: appRes.data || [],
        pricing: pricingRes.data || [],
        ai: aiRes.data || [],
      };
    } catch (error) {
      console.error('Error fetching all config:', error);
      throw error;
    }
  }

  /**
   * Update a single config value and increment version
   */
  static async updateConfigValue(
    table: 'app' | 'pricing' | 'ai',
    key: string,
    value: any
  ): Promise<ConfigRow> {
    try {
      // Validate config type for app config
      if (table === 'app') {
        this.validateConfigType(table, key, value);
      }

      const tableName = `${table}_config`;
      
      // Update the config value
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .update({ value })
        .eq('key', key)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error(`Config key not found: ${key}`);
      }

      // Increment config version
      await this.incrementConfigVersion();

      return data;
    } catch (error) {
      console.error(`Error updating ${table} config:`, error);
      throw error;
    }
  }

  /**
   * Validate config type for app config
   */
  static validateConfigType(table: 'app' | 'pricing' | 'ai', key: string, value: any): void {
    if (table !== 'app') return; // Only validate app config types

    const expectedTypes: Record<string, string> = {
      cookie_ttl_days: 'number',
      idempotency_required: 'boolean',
      allow_async_turn_fallback: 'boolean',
      telemetry_sample_rate: 'number',
      drifter_enabled: 'boolean',
    };

    const expectedType = expectedTypes[key];
    if (!expectedType) return; // Unknown key, skip validation

    const actualType = typeof value.value;
    if (actualType !== expectedType) {
      throw new Error(`Invalid type for app config key ${key}: expected ${expectedType}, got ${actualType}`);
    }
  }

  /**
   * Increment config version in config_meta table
   */
  private static async incrementConfigVersion(): Promise<void> {
    try {
      // Get current version first
      const { data: currentData, error: fetchError } = await supabaseAdmin
        .from('config_meta')
        .select('version')
        .eq('id', true)
        .single();

      if (fetchError) throw fetchError;

      const currentVersion = currentData?.version || 0;
      const newVersion = currentVersion + 1;

      const { error } = await supabaseAdmin
        .from('config_meta')
        .update({ version: newVersion })
        .eq('id', true);

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing config version:', error);
      throw error;
    }
  }

  /**
   * Get config version
   */
  static async getConfigVersion(): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('config_meta')
        .select('version')
        .single();

      if (error) throw error;
      return data?.version || 1;
    } catch (error) {
      console.error('Error getting config version:', error);
      throw error;
    }
  }
}
