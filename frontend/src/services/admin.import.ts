/**
 * Admin Import Service
 * Import and validate entities from JSON
 */

import { supabase } from '@/lib/supabase';
import { z } from 'zod';

export interface ImportOptions {
  upsertBy: 'slug' | 'name';
  skipValidation?: boolean;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  warnings: string[];
  job_id?: string;
}

export interface ImportDiagnostic {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  value?: any;
}

// Validation schemas
const worldSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft')
});

const rulesetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  version_major: z.number().int().min(1).default(1),
  version_minor: z.number().int().min(0).default(0),
  version_patch: z.number().int().min(0).default(0)
});

const npcSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active')
});

const npcPackSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
  members: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).optional()
});

const entrySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  world_id: z.string().optional(),
  associations: z.object({
    world: z.object({ id: z.string(), name: z.string() }).optional(),
    rulesets: z.array(z.object({ id: z.string(), name: z.string(), sort_order: z.number() })).optional(),
    npcs: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    npc_packs: z.array(z.object({ id: z.string(), name: z.string() })).optional()
  }).optional()
});

export class ImportService {
  /**
   * Validate import payload
   */
  async validateImport(payload: any): Promise<{
    valid: boolean;
    diagnostics: ImportDiagnostic[];
    entities: any[];
  }> {
    const diagnostics: ImportDiagnostic[] = [];
    const entities: any[] = [];

    try {
      // Handle single entity
      if (payload.type && payload.data) {
        const result = await this.validateEntity(payload.type, payload.data);
        diagnostics.push(...result.diagnostics);
        if (result.valid) {
          entities.push(payload.data);
        }
      }
      // Handle bundle
      else if (payload.type === 'bundle' && payload.entities) {
        for (const entity of payload.entities) {
          const result = await this.validateEntity(entity.type, entity.data);
          diagnostics.push(...result.diagnostics);
          if (result.valid) {
            entities.push(entity.data);
          }
        }
      }
      // Handle array of entities
      else if (Array.isArray(payload)) {
        for (const entity of payload) {
          const result = await this.validateEntity(entity.type, entity.data);
          diagnostics.push(...result.diagnostics);
          if (result.valid) {
            entities.push(entity.data);
          }
        }
      }
      else {
        diagnostics.push({
          type: 'error',
          message: 'Invalid payload format. Expected single entity, bundle, or array of entities.'
        });
      }

      return {
        valid: diagnostics.filter(d => d.type === 'error').length === 0,
        diagnostics,
        entities
      };
    } catch (error) {
      return {
        valid: false,
        diagnostics: [{
          type: 'error',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        entities: []
      };
    }
  }

  /**
   * Validate a single entity
   */
  private async validateEntity(type: string, data: any): Promise<{
    valid: boolean;
    diagnostics: ImportDiagnostic[];
  }> {
    const diagnostics: ImportDiagnostic[] = [];

    try {
      let schema;
      switch (type) {
        case 'world':
          schema = worldSchema;
          break;
        case 'ruleset':
          schema = rulesetSchema;
          break;
        case 'npc':
          schema = npcSchema;
          break;
        case 'npc_pack':
          schema = npcPackSchema;
          break;
        case 'entry':
          schema = entrySchema;
          break;
        default:
          diagnostics.push({
            type: 'error',
            message: `Unknown entity type: ${type}`
          });
          return { valid: false, diagnostics };
      }

      // Validate against schema
      const result = schema.safeParse(data);
      if (!result.success) {
        result.error.errors.forEach(err => {
          diagnostics.push({
            type: 'error',
            message: err.message,
            field: err.path.join('.'),
            value: err.input
          });
        });
        return { valid: false, diagnostics };
      }

      // Check for duplicate slugs
      const duplicateCheck = await this.checkDuplicateSlug(type, data.slug);
      if (duplicateCheck.exists) {
        diagnostics.push({
          type: 'warning',
          message: `Entity with slug '${data.slug}' already exists. Will be updated if upsertBy is 'slug'.`,
          field: 'slug',
          value: data.slug
        });
      }

      // Check foreign key references for entries
      if (type === 'entry' && data.world_id) {
        const worldExists = await this.checkEntityExists('worlds', data.world_id);
        if (!worldExists) {
          diagnostics.push({
            type: 'error',
            message: `Referenced world with ID '${data.world_id}' does not exist`,
            field: 'world_id',
            value: data.world_id
          });
        }
      }

      return { valid: diagnostics.filter(d => d.type === 'error').length === 0, diagnostics };
    } catch (error) {
      diagnostics.push({
        type: 'error',
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return { valid: false, diagnostics };
    }
  }

  /**
   * Apply import with upsert strategy
   */
  async applyImport(
    payload: any, 
    options: ImportOptions = { upsertBy: 'slug' }
  ): Promise<ImportResult> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Create import job record
    const { data: job, error: jobError } = await supabase
      .from('content_import_jobs')
      .insert({
        kind: payload.type || 'bundle',
        payload,
        status: 'validated',
        created_by: session.user.id
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create import job: ${jobError.message}`);
    }

    try {
      const validation = await this.validateImport(payload);
      if (!validation.valid) {
        await supabase
          .from('content_import_jobs')
          .update({ 
            status: 'failed',
            report: { errors: validation.diagnostics.filter(d => d.type === 'error') }
          })
          .eq('id', job.id);

        return {
          success: false,
          created: 0,
          updated: 0,
          errors: validation.diagnostics.filter(d => d.type === 'error').map(d => d.message),
          warnings: validation.diagnostics.filter(d => d.type === 'warning').map(d => d.message)
        };
      }

      const result = await this.processEntities(validation.entities, options);
      
      // Update job status
      await supabase
        .from('content_import_jobs')
        .update({ 
          status: 'applied',
          report: result
        })
        .eq('id', job.id);

      return {
        ...result,
        job_id: job.id
      };
    } catch (error) {
      await supabase
        .from('content_import_jobs')
        .update({ 
          status: 'failed',
          report: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
        .eq('id', job.id);

      throw error;
    }
  }

  /**
   * Process entities for import
   */
  private async processEntities(entities: any[], options: ImportOptions): Promise<{
    success: boolean;
    created: number;
    updated: number;
    errors: string[];
    warnings: string[];
  }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const entity of entities) {
      try {
        const result = await this.upsertEntity(entity, options);
        if (result.created) created++;
        if (result.updated) updated++;
        if (result.warning) warnings.push(result.warning);
      } catch (error) {
        errors.push(`Failed to process entity '${entity.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      created,
      updated,
      errors,
      warnings
    };
  }

  /**
   * Upsert a single entity
   */
  private async upsertEntity(entity: any, options: ImportOptions): Promise<{
    created: boolean;
    updated: boolean;
    warning?: string;
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Determine table name
    let tableName: string;
    switch (entity.type) {
      case 'world':
        tableName = 'worlds';
        break;
      case 'ruleset':
        tableName = 'rulesets';
        break;
      case 'npc':
        tableName = 'npcs';
        break;
      case 'npc_pack':
        tableName = 'npc_packs';
        break;
      case 'entry':
        tableName = 'entries';
        break;
      default:
        throw new Error(`Unknown entity type: ${entity.type}`);
    }

    // Check if entity exists
    const existing = await this.findExistingEntity(tableName, entity, options.upsertBy);
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from(tableName)
        .update({
          ...entity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Failed to update entity: ${error.message}`);
      }

      return { created: false, updated: true };
    } else {
      // Create new
      const { error } = await supabase
        .from(tableName)
        .insert({
          ...entity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to create entity: ${error.message}`);
      }

      return { created: true, updated: false };
    }
  }

  /**
   * Find existing entity by slug or name
   */
  private async findExistingEntity(tableName: string, entity: any, upsertBy: 'slug' | 'name'): Promise<any> {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(upsertBy, entity[upsertBy])
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check for existing entity: ${error.message}`);
    }

    return data;
  }

  /**
   * Check if entity exists by ID
   */
  private async checkEntityExists(tableName: string, id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .eq('id', id)
      .single();

    return !error && !!data;
  }

  /**
   * Check for duplicate slug
   */
  private async checkDuplicateSlug(type: string, slug: string): Promise<{ exists: boolean; entity?: any }> {
    let tableName: string;
    switch (type) {
      case 'world':
        tableName = 'worlds';
        break;
      case 'ruleset':
        tableName = 'rulesets';
        break;
      case 'npc':
        tableName = 'npcs';
        break;
      case 'npc_pack':
        tableName = 'npc_packs';
        break;
      case 'entry':
        tableName = 'entries';
        break;
      default:
        return { exists: false };
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('slug', slug)
      .single();

    return { exists: !error && !!data, entity: data };
  }
}

export const importService = new ImportService();
