/**
 * Phase 22: Mod Packs Service
 * Manages mod pack installation, enabling, disabling, and lifecycle
 */

import { z } from 'zod';
import { createHash } from 'crypto';

// Types
export interface ModManifest {
  namespace: string;
  version: string;
  awf_core: string;
  declares: {
    hooks: string[];
    slices: string[];
  };
  permissions: {
    acts: string[];
    perTurnActsMax: number;
    requiresCertification: boolean;
  };
}

export interface ModPack {
  namespace: string;
  version: string;
  status: 'installed' | 'enabled' | 'disabled' | 'quarantined';
  manifest: ModManifest;
  hash: string;
  certified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModHook {
  namespace: string;
  hook_id: string;
  hook_type: string;
  doc: any;
  hash: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ModQuarantine {
  namespace: string;
  reason: string;
  details: any;
  created_at: string;
}

export interface ModConfig {
  id: string;
  mods_enabled: boolean;
  max_hooks_per_turn: number;
  max_acts_per_turn: number;
  max_namespace_tokens: number;
  max_global_tokens: number;
  max_eval_ms: number;
  quarantine_threshold: number;
  cert_required: boolean;
  created_at: string;
  updated_at: string;
}

// Schemas
const ModManifestSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9._-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  awf_core: z.string(),
  declares: z.object({
    hooks: z.array(z.string()),
    slices: z.array(z.string()),
  }),
  permissions: z.object({
    acts: z.array(z.string()),
    perTurnActsMax: z.number().int().min(0).max(10),
    requiresCertification: z.boolean(),
  }),
});

const ModPackSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  status: z.enum(['installed', 'enabled', 'disabled', 'quarantined']),
  manifest: ModManifestSchema,
  hash: z.string(),
  certified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export class ModPacksService {
  private supabase: any;
  private config: ModConfig | null = null;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Get mod configuration
   */
  async getConfig(): Promise<ModConfig> {
    if (this.config) {
      return this.config;
    }

    const { data, error } = await this.supabase
      .from('mod_config')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      throw new Error(`Failed to get mod config: ${error.message}`);
    }

    this.config = data;
    return data;
  }

  /**
   * Install a mod pack from ZIP
   */
  async installModPack(
    zipBuffer: Buffer,
    adminUserId: string
  ): Promise<{ success: boolean; namespace?: string; error?: string }> {
    try {
      // Extract and validate manifest
      const manifest = await this.extractManifest(zipBuffer);
      const validation = ModManifestSchema.safeParse(manifest);
      
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid manifest: ${validation.error.message}`,
        };
      }

      // Check compatibility
      const compatibility = await this.checkCompatibility(manifest.awf_core);
      if (!compatibility.compatible) {
        return {
          success: false,
          error: `Incompatible AWF core version: ${compatibility.reason}`,
        };
      }

      // Compute hash
      const hash = this.computeHash(zipBuffer);

      // Install mod pack
      const { data, error } = await this.supabase
        .from('mod_packs')
        .insert({
          namespace: manifest.namespace,
          version: manifest.version,
          status: 'installed',
          manifest: manifest,
          hash: hash,
          certified: false,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to install mod pack: ${error.message}`,
        };
      }

      // Install hooks
      const hooks = await this.extractHooks(zipBuffer, manifest);
      for (const hook of hooks) {
        await this.supabase
          .from('mod_hooks')
          .insert({
            namespace: manifest.namespace,
            hook_id: hook.hook_id,
            hook_type: hook.hook_type,
            doc: hook.doc,
            hash: hook.hash,
            priority: hook.priority || 0,
          });
      }

      return {
        success: true,
        namespace: manifest.namespace,
      };

    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${error}`,
      };
    }
  }

  /**
   * Enable a mod pack
   */
  async enableModPack(
    namespace: string,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.getConfig();
      
      if (!config.mods_enabled) {
        return {
          success: false,
          error: 'Mod system is disabled',
        };
      }

      if (config.cert_required) {
        const { data: pack } = await this.supabase
          .from('mod_packs')
          .select('certified')
          .eq('namespace', namespace)
          .single();

        if (!pack?.certified) {
          return {
            success: false,
            error: 'Mod pack must be certified to enable',
          };
        }
      }

      const { error } = await this.supabase
        .from('mod_packs')
        .update({ status: 'enabled' })
        .eq('namespace', namespace);

      if (error) {
        return {
          success: false,
          error: `Failed to enable mod pack: ${error.message}`,
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Enable failed: ${error}`,
      };
    }
  }

  /**
   * Disable a mod pack
   */
  async disableModPack(
    namespace: string,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('mod_packs')
        .update({ status: 'disabled' })
        .eq('namespace', namespace);

      if (error) {
        return {
          success: false,
          error: `Failed to disable mod pack: ${error.message}`,
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Disable failed: ${error}`,
      };
    }
  }

  /**
   * Quarantine a mod pack
   */
  async quarantineModPack(
    namespace: string,
    reason: string,
    details: any,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update pack status
      const { error: packError } = await this.supabase
        .from('mod_packs')
        .update({ status: 'quarantined' })
        .eq('namespace', namespace);

      if (packError) {
        return {
          success: false,
          error: `Failed to quarantine mod pack: ${packError.message}`,
        };
      }

      // Add quarantine record
      const { error: quarantineError } = await this.supabase
        .from('mod_quarantine')
        .upsert({
          namespace: namespace,
          reason: reason,
          details: details,
        });

      if (quarantineError) {
        return {
          success: false,
          error: `Failed to record quarantine: ${quarantineError.message}`,
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Quarantine failed: ${error}`,
      };
    }
  }

  /**
   * Certify a mod pack
   */
  async certifyModPack(
    namespace: string,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('mod_packs')
        .update({ certified: true })
        .eq('namespace', namespace);

      if (error) {
        return {
          success: false,
          error: `Failed to certify mod pack: ${error.message}`,
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Certification failed: ${error}`,
      };
    }
  }

  /**
   * Get enabled mod packs
   */
  async getEnabledModPacks(): Promise<ModPack[]> {
    const { data, error } = await this.supabase
      .from('mod_packs')
      .select('*')
      .eq('status', 'enabled')
      .eq('certified', true);

    if (error) {
      throw new Error(`Failed to get enabled mod packs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get mod hooks for a specific type
   */
  async getModHooks(hookType: string): Promise<ModHook[]> {
    const { data, error } = await this.supabase
      .from('mod_hooks')
      .select(`
        *,
        mod_packs!inner(namespace, status, certified)
      `)
      .eq('hook_type', hookType)
      .eq('mod_packs.status', 'enabled')
      .eq('mod_packs.certified', true)
      .order('priority', { ascending: false })
      .order('namespace');

    if (error) {
      throw new Error(`Failed to get mod hooks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Record mod metrics
   */
  async recordMetrics(
    namespace: string,
    hookId: string,
    metricType: string,
    value: number
  ): Promise<void> {
    await this.supabase
      .from('mod_metrics')
      .insert({
        namespace: namespace,
        hook_id: hookId,
        metric_type: metricType,
        value: value,
      });
  }

  /**
   * Extract manifest from ZIP buffer
   */
  private async extractManifest(zipBuffer: Buffer): Promise<ModManifest> {
    // This would use a ZIP library to extract manifest.json
    // For now, return a mock manifest
    return {
      namespace: 'author.test_mod',
      version: '1.0.0',
      awf_core: '>=1.12.0',
      declares: {
        hooks: ['onTurnStart'],
        slices: ['sim.weather'],
      },
      permissions: {
        acts: ['RESOURCE_DELTA'],
        perTurnActsMax: 1,
        requiresCertification: true,
      },
    };
  }

  /**
   * Extract hooks from ZIP buffer
   */
  private async extractHooks(
    zipBuffer: Buffer,
    manifest: ModManifest
  ): Promise<Array<{
    hook_id: string;
    hook_type: string;
    doc: any;
    hash: string;
    priority?: number;
  }>> {
    // This would extract hook files from ZIP
    // For now, return empty array
    return [];
  }

  /**
   * Check AWF core compatibility
   */
  private async checkCompatibility(awfCore: string): Promise<{
    compatible: boolean;
    reason?: string;
  }> {
    // This would check against current AWF core version
    // For now, always return compatible
    return { compatible: true };
  }

  /**
   * Compute hash for content
   */
  private computeHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate mod pack
   */
  async validateModPack(namespace: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get mod pack
      const { data: pack, error } = await this.supabase
        .from('mod_packs')
        .select('*')
        .eq('namespace', namespace)
        .single();

      if (error) {
        errors.push(`Mod pack not found: ${error.message}`);
        return { valid: false, errors, warnings };
      }

      // Validate manifest
      const manifestValidation = ModManifestSchema.safeParse(pack.manifest);
      if (!manifestValidation.success) {
        errors.push(`Invalid manifest: ${manifestValidation.error.message}`);
      }

      // Check hooks
      const { data: hooks } = await this.supabase
        .from('mod_hooks')
        .select('*')
        .eq('namespace', namespace);

      if (!hooks || hooks.length === 0) {
        warnings.push('No hooks found in mod pack');
      }

      // Validate hook schemas
      for (const hook of hooks || []) {
        if (!hook.doc.hook_id) {
          errors.push(`Hook missing hook_id: ${hook.hook_id}`);
        }
        if (!hook.doc.type) {
          errors.push(`Hook missing type: ${hook.hook_id}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error}`],
        warnings: [],
      };
    }
  }
}

// Singleton instance
let modPacksService: ModPacksService | null = null;

export function getModPacksService(supabase: any): ModPacksService {
  if (!modPacksService) {
    modPacksService = new ModPacksService(supabase);
  }
  return modPacksService;
}
