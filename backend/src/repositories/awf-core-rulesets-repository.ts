/**
 * AWF Core Rulesets Repository
 * CRUD operations for core rulesets (narrative/pacing/style policies)
 */

import { createClient } from '@supabase/supabase-js';
import { CoreRulesetV1Schema } from '../validators/awf-ruleset.schema.js';
import { AWFBaseRepository } from './awf-base-repository.js';
import type { ActiveRepository } from './awf-base-repository.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export interface CoreRulesetRecord {
  id: string;
  version: string;
  doc: unknown;
  hash: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export class CoreRulesetsRepository extends AWFBaseRepository<CoreRulesetRecord> implements ActiveRepository<CoreRulesetRecord> {
  constructor(supabase: ReturnType<typeof createClient>) {
    super({ supabase }, 'core_rulesets');
  }

  /**
   * Get a core ruleset by ID and version
   */
  async getByIdVersion(id: string, version: string): Promise<CoreRulesetRecord | null> {
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

    return data as CoreRulesetRecord;
  }

  /**
   * Upsert a core ruleset record
   */
  async upsert(record: CoreRulesetRecord): Promise<CoreRulesetRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid core ruleset document');
    }

    // Compute hash if not provided
    if (!record.hash) {
      (record as any).hash = this.computeHash(record.doc);
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as CoreRulesetRecord;
  }

  /**
   * Validate core ruleset document using CoreRulesetV1Schema
   */
  validate(doc: unknown): boolean {
    try {
      CoreRulesetV1Schema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compute hash for a document
   */
  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  /**
   * Validate core ruleset document using CoreRulesetV1Schema (async version)
   */
  async validateDocument(doc: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      CoreRulesetV1Schema.parse(doc);
      return { valid: true };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Create a new core ruleset version
   */
  async create(id: string, version: string, doc: unknown): Promise<CoreRulesetRecord> {
    // Validate the document
    const validation = await this.validateDocument(doc);
    if (!validation.valid) {
      throw new Error(`Invalid core ruleset document: ${validation.errors?.join(', ')}`);
    }

    // Generate hash
    const hash = this.computeHash(doc);

    // Create the record
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        id,
        version,
        doc,
        hash,
        active: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create core ruleset: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing core ruleset version
   */
  async update(id: string, version: string, doc: unknown): Promise<CoreRulesetRecord> {
    // Validate the document
    const validation = await this.validateDocument(doc);
    if (!validation.valid) {
      throw new Error(`Invalid core ruleset document: ${validation.errors?.join(', ')}`);
    }

    // Generate hash
    const hash = this.computeHash(doc);

    // Update the record
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        doc,
        hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update core ruleset: ${error.message}`);
    }

    return data;
  }

  /**
   * Activate a specific version of a core ruleset
   */
  async activate(id: string, version: string): Promise<void> {
    // First, deactivate all versions of this ruleset
    await this.supabase
      .from(this.tableName)
      .update({ active: false })
      .eq('id', id);

    // Then activate the specified version
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ active: true })
      .eq('id', id)
      .eq('version', version);

    if (error) {
      throw new Error(`Failed to activate core ruleset: ${error.message}`);
    }
  }

  /**
   * Get the active version of a core ruleset
   */
  async getActive(id: string): Promise<CoreRulesetRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No active version found
      }
      throw new Error(`Failed to get active core ruleset: ${error.message}`);
    }

    return data;
  }

  /**
   * List all versions of a core ruleset
   */
  async listVersions(id: string): Promise<CoreRulesetRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list core ruleset versions: ${error.message}`);
    }

    return data || [];
  }
}
