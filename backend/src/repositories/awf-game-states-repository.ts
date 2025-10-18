/**
 * Game States Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Game state data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { GameStateRecord } from '../types/awf-docs.js';
import { GameStateRecordSchema } from '../validators/awf-validators.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class GameStatesRepository extends AWFBaseRepository<GameStateRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'game_states');
  }

  async getByIdVersion(sessionId: string): Promise<GameStateRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as GameStateRecord;
  }

  async upsert(record: GameStateRecord): Promise<GameStateRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, { onConflict: 'session_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as GameStateRecord;
  }

  validate(doc: unknown): boolean {
    try {
      GameStateRecordSchema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async updateHotState(sessionId: string, hotState: Record<string, unknown>): Promise<GameStateRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        hot: hotState,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as GameStateRecord;
  }

  async updateWarmState(sessionId: string, warmState: { episodic: unknown[]; pins: unknown[] }): Promise<GameStateRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        warm: warmState,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as GameStateRecord;
  }

  async updateColdState(sessionId: string, coldState: Record<string, unknown>): Promise<GameStateRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        cold: coldState,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as GameStateRecord;
  }
}
