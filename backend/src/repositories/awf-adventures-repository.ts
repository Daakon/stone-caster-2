/**
 * Adventures Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Adventure data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { AdventureRecord } from '../types/awf-docs.js';
import { AdventureDocSchema } from '../validators/awf-validators.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class AdventuresRepository extends AWFBaseRepository<AdventureRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'adventures');
  }

  async getByIdVersion(id: string, version: string): Promise<AdventureRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('version', version)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as AdventureRecord;
  }

  async upsert(record: AdventureRecord): Promise<AdventureRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid adventure document');
    }

    // Compute hash if not provided
    if (!record.hash) {
      record.hash = this.computeHash(record.doc);
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as AdventureRecord;
  }

  validate(doc: unknown): boolean {
    try {
      AdventureDocSchema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async getByWorldRef(worldRef: string): Promise<AdventureRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('world_ref', worldRef)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as AdventureRecord[];
  }

  async getLatestVersion(id: string): Promise<AdventureRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as AdventureRecord;
  }

  async getAllVersions(id: string): Promise<AdventureRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as AdventureRecord[];
  }
}
