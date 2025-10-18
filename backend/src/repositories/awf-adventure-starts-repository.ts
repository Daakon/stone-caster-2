/**
 * Adventure Starts Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Adventure start data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { AdventureStartRecord } from '../types/awf-docs.js';
import { AdventureStartDocSchema } from '../validators/awf-validators.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class AdventureStartsRepository extends AWFBaseRepository<AdventureStartRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'adventure_starts');
  }

  async getByIdVersion(adventureRef: string): Promise<AdventureStartRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('adventure_ref', adventureRef)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as AdventureStartRecord;
  }

  async upsert(record: AdventureStartRecord): Promise<AdventureStartRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid adventure start document');
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, { onConflict: 'adventure_ref' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as AdventureStartRecord;
  }

  validate(doc: unknown): boolean {
    try {
      AdventureStartDocSchema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async getByAdventureRef(adventureRef: string): Promise<AdventureStartRecord | null> {
    return this.getByIdVersion(adventureRef);
  }
}
