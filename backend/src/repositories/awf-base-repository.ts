/**
 * Base repository interface for AWF (Adventure World Format) bundle data access
 * Phase 1: Data Model - Common repository patterns
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface RepositoryOptions {
  supabase: SupabaseClient;
}

export interface BaseRepository<T> {
  getByIdVersion(id: string, version: string): Promise<T | null>;
  upsert(record: T): Promise<T>;
  validate(doc: unknown): boolean;
  computeHash(doc: unknown): string;
}

export interface ActiveRepository<T> extends BaseRepository<T> {
  getActive(id: string): Promise<T | null>;
}

export abstract class AWFBaseRepository<T> implements BaseRepository<T> {
  protected supabase: SupabaseClient;
  protected tableName: string;

  constructor(options: RepositoryOptions, tableName: string) {
    this.supabase = options.supabase;
    this.tableName = tableName;
  }

  abstract getByIdVersion(id: string, version: string): Promise<T | null>;
  abstract upsert(record: T): Promise<T>;
  abstract validate(doc: unknown): boolean;
  abstract computeHash(doc: unknown): string;

  protected async executeQuery<R>(query: Promise<{ data: R | null; error: unknown }>): Promise<R | null> {
    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    return data;
  }

  protected async executeQueryArray<R>(query: Promise<{ data: R[] | null; error: unknown }>): Promise<R[]> {
    const { data, error } = await query;
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    return data || [];
  }
}
