/**
 * AWF Injection Map Repository
 * CRUD operations for versioned injection maps
 */

import { createClient } from '@supabase/supabase-js';
import { InjectionMapDocV1Schema } from '../validators/awf-injection-map.schema.js';
import { AWFBaseRepository } from './awf-base-repository.js';
import type { ActiveRepository } from './awf-base-repository.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';
import { InjectionMapDocV1, InjectionMapRecord } from '../types/awf-injection-map.js';

export class InjectionMapRepository extends AWFBaseRepository<InjectionMapRecord> {
  constructor(supabase: ReturnType<typeof createClient>) {
    super({ supabase }, 'injection_maps');
  }

  async getActive(): Promise<InjectionMapRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }
    return data as InjectionMapRecord;
  }

  async getByIdVersion(id: string, version: string): Promise<InjectionMapRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('version', version)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }
    return data as InjectionMapRecord;
  }

  async list(filters: { id?: string; is_active?: boolean } = {}): Promise<InjectionMapRecord[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (filters.id) {
      query = query.eq('id', filters.id);
    }
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    return data as InjectionMapRecord[];
  }

  async upsert(record: Omit<InjectionMapRecord, 'created_at' | 'updated_at'>): Promise<InjectionMapRecord> {
    const { id, version, label, doc, is_active } = record;
    
    // Validate document
    let validatedDoc;
    try {
      validatedDoc = InjectionMapDocV1Schema.parse(doc);
    } catch (validationError) {
      throw new Error(`Invalid injection map document: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
    }

    const hash = this.computeHash(validatedDoc);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert({ 
        id, 
        version, 
        label, 
        doc: validatedDoc, 
        is_active,
        hash 
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    return data as InjectionMapRecord;
  }

  async activate(id: string, version: string): Promise<InjectionMapRecord> {
    // Start transaction: clear all active flags, then set this one active
    const { data: clearData, error: clearError } = await this.supabase
      .from(this.tableName)
      .update({ is_active: false })
      .eq('is_active', true)
      .select();

    if (clearError) {
      throw new Error(`Database error clearing active flags: ${clearError.message}`);
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ is_active: true })
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error activating injection map: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Injection map ${id}@${version} not found`);
    }

    return data as InjectionMapRecord;
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
      InjectionMapDocV1Schema.parse(doc);
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
      InjectionMapDocV1Schema.parse(doc);
      return { valid: true };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
}