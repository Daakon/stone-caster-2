/**
 * Core Rulesets Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Core vs Rulesets Framework Split - Ruleset data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { CoreRulesetRecord } from '../types/awf-core.js';
import { CoreRulesetV1Schema } from '../validators/awf-ruleset.schema.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class CoreRulesetsRepository extends AWFBaseRepository<CoreRulesetRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'core_rulesets');
  }

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

  async list(): Promise<CoreRulesetRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as CoreRulesetRecord[];
  }

  async upsert(record: CoreRulesetRecord): Promise<CoreRulesetRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid core ruleset document');
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

    return data as CoreRulesetRecord;
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
      CoreRulesetV1Schema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }
}
