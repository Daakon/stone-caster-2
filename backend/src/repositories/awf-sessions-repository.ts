/**
 * Sessions Repository for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Session data access
 */

import { AWFBaseRepository, RepositoryOptions } from './awf-base-repository.js';
import { SessionRecord } from '../types/awf-docs.js';
import { SessionRecordSchema } from '../validators/awf-validators.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

export class SessionsRepository extends AWFBaseRepository<SessionRecord> {
  constructor(options: RepositoryOptions) {
    super(options, 'sessions');
  }

  async getByIdVersion(sessionId: string): Promise<SessionRecord | null> {
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

    return data as SessionRecord;
  }

  async upsert(record: SessionRecord): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, { onConflict: 'session_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as SessionRecord;
  }

  validate(doc: unknown): boolean {
    try {
      SessionRecordSchema.parse(doc);
      return true;
    } catch {
      return false;
    }
  }

  computeHash(doc: unknown): string {
    return computeDocumentHash(doc);
  }

  async getByPlayerId(playerId: string): Promise<SessionRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as SessionRecord[];
  }

  async getByWorldRef(worldRef: string): Promise<SessionRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('world_ref', worldRef)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as SessionRecord[];
  }

  async getByAdventureRef(adventureRef: string): Promise<SessionRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('adventure_ref', adventureRef)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as SessionRecord[];
  }

  async incrementTurn(sessionId: string): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        turn_id: this.supabase.raw('turn_id + 1'),
        is_first_turn: false,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as SessionRecord;
  }
}
