/**
 * Injection Map Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Injection map data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { InjectionMapRecord } from '../types/awf-docs.js';
import { InjectionMapDocSchema } from '../validators/awf-validators.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class InjectionMapRepository extends AWFBaseRepository<InjectionMapRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'injection_map');
  }

  async getByIdVersion(id: string): Promise<InjectionMapRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as InjectionMapRecord;
  }

  async upsert(record: InjectionMapRecord): Promise<InjectionMapRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid injection map document');
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as InjectionMapRecord;
  }

  validate(doc: unknown): boolean {
    try {
      InjectionMapDocSchema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async getDefault(): Promise<InjectionMapRecord | null> {
    return this.getByIdVersion('default');
  }

  async getAll(): Promise<InjectionMapRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as InjectionMapRecord[];
  }
}
