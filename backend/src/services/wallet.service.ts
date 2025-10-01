import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from 'shared';

export interface SpendResult {
  success: boolean;
  newBalance?: number;
  ledgerEntryId?: string;
  error?: ApiErrorCode;
  message?: string;
}

export class WalletService {
  /**
   * Spend casting stones from a user's wallet
   * @param owner - User ID or guest cookie ID
   * @param amount - Amount to spend
   * @param idempotencyKey - Unique key to prevent duplicate spends
   * @param gameId - Optional game ID for ledger tracking
   * @param turnId - Optional turn ID for ledger tracking
   * @returns SpendResult with success status and details
   */
  async spendCasting(
    owner: string,
    amount: number,
    idempotencyKey: string,
    gameId?: string,
    turnId?: string
  ): Promise<SpendResult> {
    try {
      // Check for existing idempotent operation
      const { data: existingEntry, error: ledgerError } = await supabaseAdmin
        .from('stone_ledger')
        .select('id, delta, new_balance')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (ledgerError && ledgerError.code !== 'PGRST116') {
        // PGRST116 is "not found" - other errors are real problems
        console.error('Error checking idempotency:', ledgerError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to process stone spend',
        };
      }

      if (existingEntry) {
        // Idempotent operation - return existing result
        return {
          success: true,
          newBalance: existingEntry.new_balance,
          ledgerEntryId: existingEntry.id,
        };
      }

      // Get current balance
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('stone_wallets')
        .select('balance')
        .eq('owner', owner)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Error fetching wallet:', walletError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to process stone spend',
        };
      }

      const currentBalance = wallet?.balance || 0;

      // Check sufficient balance
      if (currentBalance < amount) {
        return {
          success: false,
          error: ApiErrorCode.INSUFFICIENT_STONES,
          message: 'Insufficient casting stones',
        };
      }

      const newBalance = currentBalance - amount;

      // Create ledger entry first (for audit trail)
      const { data: ledgerEntry, error: insertError } = await supabaseAdmin
        .from('stone_ledger')
        .insert({
          owner,
          delta: -amount,
          reason: 'TURN_SPEND',
          game_id: gameId,
          turn_id: turnId,
          idempotency_key: idempotencyKey,
          new_balance: newBalance,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating ledger entry:', insertError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to process stone spend',
        };
      }

      // Update wallet balance
      const { error: updateError } = await supabaseAdmin
        .from('stone_wallets')
        .upsert({
          owner,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        console.error('Error updating wallet:', updateError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to process stone spend',
        };
      }

      return {
        success: true,
        newBalance,
        ledgerEntryId: ledgerEntry.id,
      };
    } catch (error) {
      console.error('Unexpected error in spendCasting:', error);
      return {
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Failed to process stone spend',
      };
    }
  }

  /**
   * Get current balance for a user
   * @param owner - User ID or guest cookie ID
   * @returns Current balance (0 if no wallet exists)
   */
  async getBalance(owner: string): Promise<number> {
    try {
      const { data: wallet, error } = await supabaseAdmin
        .from('stone_wallets')
        .select('balance')
        .eq('owner', owner)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching balance:', error);
        return 0;
      }

      return wallet?.balance || 0;
    } catch (error) {
      console.error('Unexpected error in getBalance:', error);
      return 0;
    }
  }

  /**
   * Grant casting stones to a user (for testing or rewards)
   * @param owner - User ID or guest cookie ID
   * @param amount - Amount to grant
   * @param reason - Reason for granting stones
   * @param gameId - Optional game ID for ledger tracking
   * @returns Success status and new balance
   */
  async grantCasting(
    owner: string,
    amount: number,
    reason: string,
    gameId?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const currentBalance = await this.getBalance(owner);
      const newBalance = currentBalance + amount;

      // Create ledger entry
      const { error: ledgerError } = await supabaseAdmin
        .from('stone_ledger')
        .insert({
          owner,
          delta: amount,
          reason,
          game_id: gameId,
          new_balance: newBalance,
          created_at: new Date().toISOString(),
        });

      if (ledgerError) {
        console.error('Error creating grant ledger entry:', ledgerError);
        return {
          success: false,
          error: 'Failed to create ledger entry',
        };
      }

      // Update wallet
      const { error: updateError } = await supabaseAdmin
        .from('stone_wallets')
        .upsert({
          owner,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        console.error('Error updating wallet for grant:', updateError);
        return {
          success: false,
          error: 'Failed to update wallet',
        };
      }

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('Unexpected error in grantCasting:', error);
      return {
        success: false,
        error: 'Failed to grant stones',
      };
    }
  }
}

export const walletService = new WalletService();
