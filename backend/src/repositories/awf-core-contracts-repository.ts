/**
 * Core Contracts Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Core contract data access
 */

import { AWFBaseRepository, RepositoryOptions, ActiveRepository } from './awf-base-repository.js';
import { CoreContractRecord } from '../types/awf-core-contract.js';
import { CoreContractV2Schema } from '../validators/awf-core-contract.schema.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class CoreContractsRepository extends AWFBaseRepository<CoreContractRecord> implements ActiveRepository<CoreContractRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'core_contracts');
  }

  async getByIdVersion(id: string, version: string): Promise<CoreContractRecord | null> {
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

    return data as CoreContractRecord;
  }

  async getActive(id: string): Promise<CoreContractRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as CoreContractRecord;
  }

  async upsert(record: CoreContractRecord): Promise<CoreContractRecord> {
    // Validate the document before upserting
    if (!this.validate(record.doc)) {
      throw new Error('Invalid core contract document');
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

    return data as CoreContractRecord;
  }

  validate(doc: unknown): boolean {
    try {
      CoreContractV2Schema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async setActive(id: string, version: string): Promise<void> {
    // First, deactivate all versions of this contract
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
      throw new Error(`Database error: ${error.message}`);
    }
  }
}
