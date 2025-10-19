/**
 * NPC Repository for AWF (Adventure World Format) bundle system
 * Phase 2: NPC Registry - Reusable character pool data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { NPCRecord } from '../types/awf-npc.js';
import { NPCDocV1Schema } from '../validators/awf-npc.schema.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class NPCRepository extends AWFBaseRepository<NPCRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'npcs');
  }

  async getByIdVersion(id: string, version: string): Promise<NPCRecord | null> {
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
    return data as NPCRecord;
  }

  async list(): Promise<NPCRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as NPCRecord[];
  }

  async listByIds(ids: { id: string; version?: string }[]): Promise<NPCRecord[]> {
    if (ids.length === 0) return [];

    const queries = ids.map(({ id, version }) => {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id);
      
      if (version) {
        query = query.eq('version', version);
      } else {
        // Get latest version if no version specified
        query = query.order('version', { ascending: false }).limit(1);
      }
      
      return query;
    });

    const results = await Promise.all(queries);
    const records: NPCRecord[] = [];

    for (const { data, error } of results) {
      if (error) {
        console.warn(`Failed to fetch NPC: ${error.message}`);
        continue;
      }
      if (data && data.length > 0) {
        records.push(data[0] as NPCRecord);
      }
    }

    return records;
  }

  async searchByTags(tags: string[], limit = 20): Promise<NPCRecord[]> {
    if (tags.length === 0) return [];

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .overlaps('doc->npc->tags', tags)
      .limit(limit);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as NPCRecord[];
  }

  async upsert(record: NPCRecord): Promise<NPCRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid NPC document');
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

    return data as NPCRecord;
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
      NPCDocV1Schema.parse(doc);
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
      NPCDocV1Schema.parse(doc);
      return { valid: true };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
}
