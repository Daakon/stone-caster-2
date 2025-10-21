import { supabaseAdmin } from './supabase.js';
import type { StoneLedgerEntry } from '@shared';

export interface LedgerEntryInput {
  walletId: string;
  userId?: string;
  cookieGroupId?: string;
  transactionType: 'convert' | 'purchase' | 'spend' | 'regen' | 'admin_adjust' | 'STARTER';
  deltaCastingStones: number;
  deltaInventoryShard: number;
  deltaInventoryCrystal: number;
  deltaInventoryRelic: number;
  reason: string;
  packId?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerQueryOptions {
  userId?: string;
  walletId?: string;
  transactionType?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Stone Ledger Service - manages immutable transaction records
 * All stone balance changes must be recorded in the ledger
 */
export class StoneLedgerService {
  /**
   * Append a new ledger entry (immutable record)
   */
  static async appendEntry(input: LedgerEntryInput): Promise<StoneLedgerEntry> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_ledger')
        .insert({
          wallet_id: input.walletId,
          user_id: input.userId || null,
          cookie_group_id: input.cookieGroupId || null,
          transaction_type: input.transactionType,
          delta_casting_stones: input.deltaCastingStones,
          delta_inventory_shard: input.deltaInventoryShard,
          delta_inventory_crystal: input.deltaInventoryCrystal,
          delta_inventory_relic: input.deltaInventoryRelic,
          reason: input.reason,
          pack_id: input.packId || null,
          metadata: input.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error appending ledger entry:', error);
        throw new Error(`Failed to append ledger entry: ${error.message}`);
      }

      return {
        id: data.id,
        walletId: data.wallet_id,
        userId: data.user_id,
        transactionType: data.transaction_type,
        deltaCastingStones: data.delta_casting_stones,
        deltaInventoryShard: data.delta_inventory_shard,
        deltaInventoryCrystal: data.delta_inventory_crystal,
        deltaInventoryRelic: data.delta_inventory_relic,
        reason: data.reason,
        packId: data.pack_id,
        metadata: data.metadata,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('StoneLedgerService.appendEntry error:', error);
      throw error;
    }
  }

  /**
   * Get ledger entries for a user with optional filtering
   */
  static async getEntries(options: LedgerQueryOptions): Promise<StoneLedgerEntry[]> {
    try {
      let query = supabaseAdmin
        .from('stone_ledger')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      if (options.walletId) {
        query = query.eq('wallet_id', options.walletId);
      }

      if (options.transactionType) {
        query = query.eq('transaction_type', options.transactionType);
      }

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching ledger entries:', error);
        throw new Error(`Failed to fetch ledger entries: ${error.message}`);
      }

      return (data || []).map(entry => ({
        id: entry.id,
        walletId: entry.wallet_id,
        userId: entry.user_id,
        transactionType: entry.transaction_type,
        deltaCastingStones: entry.delta_casting_stones,
        deltaInventoryShard: entry.delta_inventory_shard,
        deltaInventoryCrystal: entry.delta_inventory_crystal,
        deltaInventoryRelic: entry.delta_inventory_relic,
        reason: entry.reason,
        packId: entry.pack_id,
        metadata: entry.metadata,
        createdAt: entry.created_at,
      }));
    } catch (error) {
      console.error('StoneLedgerService.getEntries error:', error);
      throw error;
    }
  }

  /**
   * Get ledger entries for a specific wallet
   */
  static async getWalletEntries(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<StoneLedgerEntry[]> {
    return this.getEntries({
      walletId,
      limit,
      offset,
    });
  }

  /**
   * Get ledger entries for a specific user
   */
  static async getUserEntries(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<StoneLedgerEntry[]> {
    return this.getEntries({
      userId,
      limit,
      offset,
    });
  }

  /**
   * Get conversion entries for a user (for audit purposes)
   */
  static async getConversionEntries(
    userId: string,
    limit: number = 20
  ): Promise<StoneLedgerEntry[]> {
    return this.getEntries({
      userId,
      transactionType: 'convert',
      limit,
    });
  }

  /**
   * Get purchase entries for a user (for audit purposes)
   */
  static async getPurchaseEntries(
    userId: string,
    limit: number = 20
  ): Promise<StoneLedgerEntry[]> {
    return this.getEntries({
      userId,
      transactionType: 'purchase',
      limit,
    });
  }

  /**
   * Calculate total stones gained/lost from ledger entries
   */
  static async calculateBalanceChanges(
    walletId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalCastingStones: number;
    totalInventoryShard: number;
    totalInventoryCrystal: number;
    totalInventoryRelic: number;
  }> {
    try {
      const entries = await this.getEntries({
        walletId,
        startDate,
        endDate,
      });

      return entries.reduce(
        (totals, entry) => ({
          totalCastingStones: totals.totalCastingStones + entry.deltaCastingStones,
          totalInventoryShard: totals.totalInventoryShard + entry.deltaInventoryShard,
          totalInventoryCrystal: totals.totalInventoryCrystal + entry.deltaInventoryCrystal,
          totalInventoryRelic: totals.totalInventoryRelic + entry.deltaInventoryRelic,
        }),
        {
          totalCastingStones: 0,
          totalInventoryShard: 0,
          totalInventoryCrystal: 0,
          totalInventoryRelic: 0,
        }
      );
    } catch (error) {
      console.error('StoneLedgerService.calculateBalanceChanges error:', error);
      throw error;
    }
  }
}
