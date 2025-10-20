/**
 * Scenario Repository for AWF (Adventure World Format) bundle system
 * Phase 3: Scenarios & Startpoints - Game startpoint data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { ScenarioRecord } from '../types/awf-scenario.js';
import { ScenarioDocV1Schema } from '../validators/awf-scenario.schema.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export interface ScenarioSearchParams {
  world_ref?: string;
  adventure_ref?: string;
  tag?: string;
  q?: string;
  limit?: number;
}

export class ScenarioRepository extends AWFBaseRepository<ScenarioRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'scenarios');
  }

  async getByIdVersion(id: string, version: string): Promise<ScenarioRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('version', version)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }
    return data as ScenarioRecord;
  }

  async list(filters?: ScenarioSearchParams): Promise<ScenarioRecord[]> {
    if (filters) {
      return this.search(filters);
    }
    
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as ScenarioRecord[];
  }

  async search(params: ScenarioSearchParams): Promise<ScenarioRecord[]> {
    const { world_ref, adventure_ref, tag, q, limit = 50 } = params;
    
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false })
      .limit(limit);

    // Apply filters
    if (world_ref) {
      query = query.eq('doc->>world_ref', world_ref);
    }
    
    if (adventure_ref) {
      query = query.eq('doc->>adventure_ref', adventure_ref);
    }
    
    if (tag) {
      query = query.contains('doc->scenario->tags', [tag]);
    }
    
    if (q) {
      // Search in display_name and synopsis
      query = query.or(`doc->scenario->display_name.ilike.%${q}%,doc->scenario->synopsis.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as ScenarioRecord[];
  }

  async upsert(record: ScenarioRecord): Promise<ScenarioRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid scenario document');
    }

    // Compute hash if not provided (for consistency with other repos)
    const hash = this.computeHash(record.doc);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert({
        ...record,
        hash
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as ScenarioRecord;
  }

  async deleteByIdVersion(id: string, version: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('version', version);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  validate(doc: unknown): boolean {
    try {
      ScenarioDocV1Schema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async validateDocument(doc: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      ScenarioDocV1Schema.parse(doc);
      return { valid: true };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
}
