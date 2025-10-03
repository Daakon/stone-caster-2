import { supabaseAdmin } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';

export interface LedgerEntry {
  id: string;
  type: 'LINK_MERGE' | 'GAME_MIGRATION' | 'STONE_MIGRATION' | 'USER_CREATION';
  userId?: string;
  guestCookieId?: string;
  canonicalGroupId?: string;
  sourceGroupId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class LedgerService {
  /**
   * Create a ledger entry for guest-to-user linking
   */
  static async createLinkMergeEntry(params: {
    userId: string;
    guestCookieId: string;
    canonicalGroupId: string;
    sourceGroupId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntry> {
    try {
      const entry: LedgerEntry = {
        id: uuidv4(),
        type: 'LINK_MERGE',
        userId: params.userId,
        guestCookieId: params.guestCookieId,
        canonicalGroupId: params.canonicalGroupId,
        sourceGroupId: params.sourceGroupId,
        metadata: params.metadata || {},
        createdAt: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('auth_ledger')
        .insert({
          id: entry.id,
          type: entry.type,
          user_id: entry.userId,
          guest_cookie_id: entry.guestCookieId,
          canonical_group_id: entry.canonicalGroupId,
          source_group_id: entry.sourceGroupId,
          metadata: entry.metadata,
          created_at: entry.createdAt,
        })
        .select()
        .single();

      if (error) throw error;

      return entry;
    } catch (error) {
      console.error('Error creating ledger entry:', error);
      throw error;
    }
  }

  /**
   * Check if a linking event has already been recorded (for idempotency)
   */
  static async hasLinkMergeEntry(params: {
    userId: string;
    guestCookieId: string;
  }): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('auth_ledger')
        .select('id')
        .eq('type', 'LINK_MERGE')
        .eq('user_id', params.userId)
        .eq('guest_cookie_id', params.guestCookieId)
        .limit(1);

      if (error) throw error;

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking ledger entry:', error);
      return false;
    }
  }

  /**
   * Get all ledger entries for a user
   */
  static async getUserLedgerEntries(userId: string): Promise<LedgerEntry[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('auth_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(entry => ({
        id: entry.id,
        type: entry.type,
        userId: entry.user_id,
        guestCookieId: entry.guest_cookie_id,
        canonicalGroupId: entry.canonical_group_id,
        sourceGroupId: entry.source_group_id,
        metadata: entry.metadata,
        createdAt: entry.created_at,
      }));
    } catch (error) {
      console.error('Error fetching user ledger entries:', error);
      throw error;
    }
  }

  /**
   * Get all ledger entries for a guest cookie
   */
  static async getGuestLedgerEntries(guestCookieId: string): Promise<LedgerEntry[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('auth_ledger')
        .select('*')
        .eq('guest_cookie_id', guestCookieId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(entry => ({
        id: entry.id,
        type: entry.type,
        userId: entry.user_id,
        guestCookieId: entry.guest_cookie_id,
        canonicalGroupId: entry.canonical_group_id,
        sourceGroupId: entry.source_group_id,
        metadata: entry.metadata,
        createdAt: entry.created_at,
      }));
    } catch (error) {
      console.error('Error fetching guest ledger entries:', error);
      throw error;
    }
  }
}


