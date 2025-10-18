/**
 * Worlds Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - World data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { WorldRecord } from '../types/awf-docs.js';
import { WorldDocSchema } from '../validators/awf-validators.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class WorldsRepository extends AWFBaseRepository<WorldRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'worlds');
  }

  async getByIdVersion(id: string, version: string): Promise<WorldRecord | null> {
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

    return data as WorldRecord;
  }

  async upsert(record: WorldRecord): Promise<WorldRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid world document');
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

    return data as WorldRecord;
  }

  validate(doc: unknown): boolean {
    try {
      WorldDocSchema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async getLatestVersion(id: string): Promise<WorldRecord | null> {
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

    return data as WorldRecord;
  }

  async getAllVersions(id: string): Promise<WorldRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as WorldRecord[];
  }
}
