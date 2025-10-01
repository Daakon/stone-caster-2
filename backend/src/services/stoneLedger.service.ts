import { supabaseAdmin } from './supabase.js';

export interface LedgerEntry {
  owner: string;
  delta: number;
  reason: string;
  game_id?: string;
  turn_id?: string;
  idempotency_key?: string;
  new_balance?: number;
}

export class StoneLedgerService {
  /**
   * Append an immutable ledger entry
   * @param entry - Ledger entry data
   * @returns The ID of the created ledger entry
   */
  async append(entry: LedgerEntry): Promise<string> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_ledger')
        .insert({
          ...entry,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating ledger entry:', error);
        throw new Error(`Failed to create ledger entry: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('Unexpected error in ledger append:', error);
      throw error;
    }
  }

  /**
   * Get ledger entries for a specific owner
   * @param owner - User ID or guest cookie ID
   * @param limit - Maximum number of entries to return
   * @param offset - Number of entries to skip
   * @returns Array of ledger entries
   */
  async getEntries(
    owner: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Array<LedgerEntry & { id: string; created_at: string }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_ledger')
        .select('*')
        .eq('owner', owner)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching ledger entries:', error);
        throw new Error(`Failed to fetch ledger entries: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error in getEntries:', error);
      throw error;
    }
  }

  /**
   * Get ledger entries for a specific game
   * @param gameId - Game ID
   * @param limit - Maximum number of entries to return
   * @param offset - Number of entries to skip
   * @returns Array of ledger entries
   */
  async getGameEntries(
    gameId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Array<LedgerEntry & { id: string; created_at: string }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_ledger')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching game ledger entries:', error);
        throw new Error(`Failed to fetch game ledger entries: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error in getGameEntries:', error);
      throw error;
    }
  }

  /**
   * Get total spent for a specific game
   * @param gameId - Game ID
   * @returns Total amount spent (negative number)
   */
  async getGameTotalSpent(gameId: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_ledger')
        .select('delta')
        .eq('game_id', gameId)
        .eq('reason', 'TURN_SPEND');

      if (error) {
        console.error('Error calculating game total spent:', error);
        throw new Error(`Failed to calculate game total spent: ${error.message}`);
      }

      return data?.reduce((sum, entry) => sum + entry.delta, 0) || 0;
    } catch (error) {
      console.error('Unexpected error in getGameTotalSpent:', error);
      throw error;
    }
  }
}

export const stoneLedgerService = new StoneLedgerService();
