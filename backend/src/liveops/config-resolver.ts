// Phase 28: LiveOps Remote Configuration System
// Deterministic config resolver with scope precedence and memoization

import { createClient } from '@supabase/supabase-js';
import { LiveOpsConfig, LiveOpsConfigSchema, mergeLiveOpsConfigs, createDefaultLiveOpsConfig } from './levers-schema';

export interface ResolverContext {
  sessionId: string;
  worldId?: string;
  adventureId?: string;
  experimentId?: string;
  variation?: string;
  now?: Date;
}

export interface ResolvedConfig {
  config: LiveOpsConfig;
  explain: ConfigExplanation;
  cacheKey: string;
  resolvedAt: Date;
}

export interface ConfigExplanation {
  scope: string;
  appliedConfigs: Array<{
    scope: string;
    scopeRef: string;
    configId: string;
    name: string;
    appliedAt: Date;
  }>;
  mergedFields: Record<string, {
    value: any;
    source: string;
    sourceConfigId: string;
  }>;
}

export class LiveOpsConfigResolver {
  private supabase;
  private cache = new Map<string, { config: ResolvedConfig; expiresAt: Date }>();
  private cacheTTL: number;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    cacheTTLMs: number = 60000 // 1 minute default
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.cacheTTL = cacheTTLMs;
  }

  /**
   * Resolve effective config for a given context
   * Deterministic resolution with scope precedence: global -> world -> adventure -> experiment -> session
   */
  async resolveEffectiveConfig(context: ResolverContext): Promise<ResolvedConfig> {
    const cacheKey = this.generateCacheKey(context);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.config;
    }

    const now = context.now || new Date();
    const explain: ConfigExplanation = {
      scope: this.determineScope(context),
      appliedConfigs: [],
      mergedFields: {}
    };

    // Get configs in precedence order
    const configs = await this.getConfigsInPrecedenceOrder(context, now);
    
    // Start with default config
    let mergedConfig = createDefaultLiveOpsConfig();
    
    // Apply configs in precedence order (last-writer-wins)
    for (const configRecord of configs) {
      const configData = configRecord.payload as Partial<LiveOpsConfig>;
      
      // Merge config
      mergedConfig = mergeLiveOpsConfigs(mergedConfig, configData);
      
      // Track explanation
      explain.appliedConfigs.push({
        scope: configRecord.scope,
        scopeRef: configRecord.scope_ref,
        configId: configRecord.config_id,
        name: configRecord.name,
        appliedAt: configRecord.updated_at
      });
      
      // Track field sources
      for (const [key, value] of Object.entries(configData)) {
        if (value !== undefined) {
          explain.mergedFields[key] = {
            value,
            source: configRecord.scope,
            sourceConfigId: configRecord.config_id
          };
        }
      }
    }

    // Validate final config
    const validation = LiveOpsConfigSchema.safeParse(mergedConfig);
    if (!validation.success) {
      throw new Error(`Invalid merged config: ${validation.error.message}`);
    }

    const resolvedConfig: ResolvedConfig = {
      config: validation.data,
      explain,
      cacheKey,
      resolvedAt: now
    };

    // Cache the result
    this.cache.set(cacheKey, {
      config: resolvedConfig,
      expiresAt: new Date(now.getTime() + this.cacheTTL)
    });

    return resolvedConfig;
  }

  /**
   * Get configs in precedence order from database
   */
  private async getConfigsInPrecedenceOrder(context: ResolverContext, now: Date) {
    const { data, error } = await this.supabase
      .from('liveops_configs')
      .select('*')
      .eq('status', 'active')
      .lte('valid_from', now.toISOString())
      .or('valid_to.is.null,valid_to.gt.' + now.toISOString())
      .order('scope', { ascending: true }); // global, world, adventure, experiment, session

    if (error) {
      throw new Error(`Failed to fetch configs: ${error.message}`);
    }

    // Filter by scope and scope_ref
    const filteredConfigs = data.filter(config => {
      switch (config.scope) {
        case 'global':
          return true;
        case 'world':
          return context.worldId && config.scope_ref === context.worldId;
        case 'adventure':
          return context.adventureId && config.scope_ref === context.adventureId;
        case 'experiment':
          return context.experimentId && config.scope_ref === context.experimentId;
        case 'session':
          return config.scope_ref === context.sessionId;
        default:
          return false;
      }
    });

    return filteredConfigs;
  }

  /**
   * Generate deterministic cache key
   */
  private generateCacheKey(context: ResolverContext): string {
    const parts = [
      context.sessionId,
      context.worldId || '',
      context.adventureId || '',
      context.experimentId || '',
      context.variation || ''
    ];
    return `liveops:${parts.join(':')}`;
  }

  /**
   * Determine the scope for explanation
   */
  private determineScope(context: ResolverContext): string {
    if (context.variation) return 'session';
    if (context.experimentId) return 'experiment';
    if (context.adventureId) return 'adventure';
    if (context.worldId) return 'world';
    return 'global';
  }

  /**
   * Preview config for a given context without caching
   */
  async previewConfig(context: ResolverContext): Promise<ResolvedConfig> {
    // Temporarily disable caching for preview
    const originalCacheTTL = this.cacheTTL;
    this.cacheTTL = 0;
    
    try {
      return await this.resolveEffectiveConfig(context);
    } finally {
      this.cacheTTL = originalCacheTTL;
    }
  }

  /**
   * Sample resolved config for troubleshooting
   */
  async sampleConfig(
    context: ResolverContext,
    turnId: number
  ): Promise<void> {
    const resolved = await this.resolveEffectiveConfig(context);
    
    const { error } = await this.supabase
      .from('liveops_snapshots')
      .insert({
        session_id: context.sessionId,
        turn_id: turnId,
        resolved: resolved.config
      });

    if (error) {
      console.error('Failed to sample config:', error);
    }
  }

  /**
   * Get latest snapshots for a session
   */
  async getLatestSnapshots(sessionId: string, limit: number = 10) {
    const { data, error } = await this.supabase
      .from('liveops_snapshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch snapshots: ${error.message}`);
    }

    return data;
  }

  /**
   * Clear cache for a specific context
   */
  clearCache(context: ResolverContext): void {
    const cacheKey = this.generateCacheKey(context);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; ttl: number } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttl: this.cacheTTL
    };
  }

  /**
   * Check if global freeze is active
   */
  async isGlobalFreezeActive(): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('liveops_configs')
      .select('payload')
      .eq('scope', 'global')
      .eq('status', 'active')
      .contains('payload', { LIVEOPS_GLOBAL_FREEZE: true })
      .limit(1);

    if (error) {
      console.error('Failed to check global freeze:', error);
      return false;
    }

    return data.length > 0;
  }

  /**
   * Get active configs for a scope
   */
  async getActiveConfigs(scope: string, scopeRef?: string) {
    let query = this.supabase
      .from('liveops_configs')
      .select('*')
      .eq('scope', scope)
      .eq('status', 'active');

    if (scopeRef) {
      query = query.eq('scope_ref', scopeRef);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active configs: ${error.message}`);
    }

    return data;
  }

  /**
   * Get config history for audit
   */
  async getConfigHistory(configId: string) {
    const { data, error } = await this.supabase
      .from('liveops_audit')
      .select('*')
      .eq('config_id', configId)
      .order('ts', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch config history: ${error.message}`);
    }

    return data;
  }

  /**
   * Validate config bounds before applying
   */
  validateConfigBounds(config: Partial<LiveOpsConfig>): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check token bounds
    if (config.AWF_MAX_INPUT_TOKENS !== undefined) {
      if (config.AWF_MAX_INPUT_TOKENS < 1000 || config.AWF_MAX_INPUT_TOKENS > 12000) {
        violations.push('AWF_MAX_INPUT_TOKENS must be between 1000 and 12000');
      }
    }
    
    if (config.AWF_MAX_OUTPUT_TOKENS !== undefined) {
      if (config.AWF_MAX_OUTPUT_TOKENS < 500 || config.AWF_MAX_OUTPUT_TOKENS > 8000) {
        violations.push('AWF_MAX_OUTPUT_TOKENS must be between 500 and 8000');
      }
    }
    
    // Check percentage bounds
    const percentageFields = [
      'AWF_INPUT_TOKEN_MULTIPLIER',
      'AWF_OUTPUT_TOKEN_MULTIPLIER',
      'QUEST_PACING_TEMPO_MULTIPLIER',
      'SOFT_LOCK_HINT_FREQUENCY',
      'RESOURCE_REGEN_MULTIPLIER',
      'RESOURCE_DECAY_MULTIPLIER'
    ];
    
    for (const field of percentageFields) {
      const value = (config as any)[field];
      if (value !== undefined && (value < 0 || value > 1)) {
        violations.push(`${field} must be between 0 and 1 (percentage)`);
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    };
  }
}

// Factory function for creating resolver
export function createLiveOpsConfigResolver(
  supabaseUrl: string,
  supabaseKey: string,
  cacheTTLMs?: number
): LiveOpsConfigResolver {
  return new LiveOpsConfigResolver(supabaseUrl, supabaseKey, cacheTTLMs);
}

// Utility function for shadow mode (evaluate but don't apply)
export async function evaluateConfigInShadowMode(
  resolver: LiveOpsConfigResolver,
  context: ResolverContext,
  proposedConfig: Partial<LiveOpsConfig>
): Promise<{
  currentConfig: ResolvedConfig;
  proposedConfig: ResolvedConfig;
  diff: Record<string, { current: any; proposed: any }>;
  impact: {
    fieldsChanged: number;
    criticalChanges: string[];
    warnings: string[];
  };
}> {
  // Get current config
  const currentConfig = await resolver.resolveEffectiveConfig(context);
  
  // Create temporary context with proposed config
  const tempContext = { ...context };
  const proposedResolved = await resolver.previewConfig(tempContext);
  
  // Calculate diff
  const diff: Record<string, { current: any; proposed: any }> = {};
  const allKeys = new Set([
    ...Object.keys(currentConfig.config),
    ...Object.keys(proposedResolved.config)
  ]);
  
  for (const key of allKeys) {
    const currentValue = (currentConfig.config as any)[key];
    const proposedValue = (proposedResolved.config as any)[key];
    
    if (currentValue !== proposedValue) {
      diff[key] = { current: currentValue, proposed: proposedValue };
    }
  }
  
  // Analyze impact
  const criticalChanges: string[] = [];
  const warnings: string[] = [];
  
  for (const [key, change] of Object.entries(diff)) {
    if (key.includes('TOKEN') || key.includes('BUDGET')) {
      criticalChanges.push(`${key}: ${change.current} → ${change.proposed}`);
    }
    
    if (key.includes('MULTIPLIER') && Math.abs(change.proposed - change.current) > 0.5) {
      warnings.push(`${key}: Large change detected (${change.current} → ${change.proposed})`);
    }
  }
  
  return {
    currentConfig,
    proposedConfig: proposedResolved,
    diff,
    impact: {
      fieldsChanged: Object.keys(diff).length,
      criticalChanges,
      warnings
    }
  };
}
