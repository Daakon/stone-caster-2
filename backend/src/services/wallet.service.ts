import { supabaseAdmin } from './supabase.js';
import { configService } from './config.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
import type { StoneWallet } from '@shared';

export interface ConversionResult {
  fromType: 'shard' | 'crystal' | 'relic';
  fromAmount: number;
  toCastingStones: number;
  newBalance: {
    castingStones: number;
    inventoryShard: number;
    inventoryCrystal: number;
    inventoryRelic: number;
  };
}

export interface PurchaseResult {
  packId: string;
  stonesAdded: {
    shard: number;
    crystal: number;
    relic: number;
  };
  bonusAdded: {
    shard: number;
    crystal: number;
    relic: number;
  };
  newBalance: {
    castingStones: number;
    inventoryShard: number;
    inventoryCrystal: number;
    inventoryRelic: number;
  };
}

/**
 * Wallet Service - manages stone wallet operations
 * Handles conversions, purchases, and balance management
 */
export class WalletService {
  /**
   * Get or create a wallet for a user
   */
  static async getOrCreateWallet(userId: string): Promise<StoneWallet> {
    try {
      // Try to get existing wallet
      const { data: existingWallet, error: fetchError } = await supabaseAdmin
        .from('stone_wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingWallet && !fetchError) {
        return this.mapWalletFromDb(existingWallet);
      }

      // Create new wallet if it doesn't exist
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('stone_wallets')
        .insert({
          user_id: userId,
          casting_stones: 0,
          inventory_shard: 0,
          inventory_crystal: 0,
          inventory_relic: 0,
          daily_regen: 0,
          last_regen_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating wallet:', createError);
        throw new Error(`Failed to create wallet: ${createError.message}`);
      }

      return this.mapWalletFromDb(newWallet);
    } catch (error) {
      console.error('WalletService.getOrCreateWallet error:', error);
      throw error;
    }
  }

  /**
   * Convert inventory stones to casting stones
   */
  static async convertStones(
    userId: string,
    type: 'shard' | 'crystal' | 'relic',
    amount: number
  ): Promise<ConversionResult> {
    try {
      // Get conversion rates from config
      const pricingConfig = configService.getPricing();
      const conversionRates = pricingConfig.conversionRates;
      if (!conversionRates) {
        throw new Error('Conversion rates not configured');
      }

      const rate = conversionRates[type];
      if (!rate || rate <= 0) {
        throw new Error(`Invalid conversion rate for ${type}`);
      }

      // Get user's wallet
      const wallet = await this.getOrCreateWallet(userId);

      // Check sufficient inventory
      const currentInventory = this.getInventoryAmount(wallet, type);
      if (currentInventory < amount) {
        throw new Error(`Insufficient ${type} inventory. Have ${currentInventory}, need ${amount}`);
      }

      // Calculate conversion
      const castingStonesToAdd = amount * rate;

      // Update wallet balances
      const updateData: any = {
        casting_stones: wallet.castingStones + castingStonesToAdd,
      };

      // Subtract from inventory
      switch (type) {
        case 'shard':
          updateData.inventory_shard = wallet.inventoryShard - amount;
          break;
        case 'crystal':
          updateData.inventory_crystal = wallet.inventoryCrystal - amount;
          break;
        case 'relic':
          updateData.inventory_relic = wallet.inventoryRelic - amount;
          break;
      }

      const { data: updatedWallet, error: updateError } = await supabaseAdmin
        .from('stone_wallets')
        .update(updateData)
        .eq('id', wallet.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating wallet for conversion:', updateError);
        throw new Error(`Failed to update wallet: ${updateError.message}`);
      }

      // Record in ledger
      await StoneLedgerService.appendEntry({
        walletId: wallet.id,
        userId,
        transactionType: 'convert',
        deltaCastingStones: castingStonesToAdd,
        deltaInventoryShard: type === 'shard' ? -amount : 0,
        deltaInventoryCrystal: type === 'crystal' ? -amount : 0,
        deltaInventoryRelic: type === 'relic' ? -amount : 0,
        reason: `Converted ${amount} ${type} to ${castingStonesToAdd} casting stones`,
        metadata: {
          conversionType: type,
          conversionAmount: amount,
          conversionRate: rate,
        },
      });

      return {
        fromType: type,
        fromAmount: amount,
        toCastingStones: castingStonesToAdd,
        newBalance: {
          castingStones: updatedWallet.casting_stones,
          inventoryShard: updatedWallet.inventory_shard,
          inventoryCrystal: updatedWallet.inventory_crystal,
          inventoryRelic: updatedWallet.inventory_relic,
        },
      };
    } catch (error) {
      console.error('WalletService.convertStones error:', error);
      throw error;
    }
  }

  /**
   * Apply a stone pack purchase to user's wallet
   */
  static async applyPurchase(
    userId: string,
    packId: string
  ): Promise<PurchaseResult> {
    try {
      // Get the stone pack
      const { data: pack, error: packError } = await supabaseAdmin
        .from('stone_packs')
        .select('*')
        .eq('id', packId)
        .eq('is_active', true)
        .single();

      if (packError || !pack) {
        throw new Error(`Invalid or inactive stone pack: ${packId}`);
      }

      // Get user's wallet
      const wallet = await this.getOrCreateWallet(userId);

      // Calculate new balances
      const newBalances = {
        castingStones: wallet.castingStones,
        inventoryShard: wallet.inventoryShard + pack.stones_shard + pack.bonus_shard,
        inventoryCrystal: wallet.inventoryCrystal + pack.stones_crystal + pack.bonus_crystal,
        inventoryRelic: wallet.inventoryRelic + pack.stones_relic + pack.bonus_relic,
      };

      // Update wallet
      const { data: updatedWallet, error: updateError } = await supabaseAdmin
        .from('stone_wallets')
        .update({
          inventory_shard: newBalances.inventoryShard,
          inventory_crystal: newBalances.inventoryCrystal,
          inventory_relic: newBalances.inventoryRelic,
        })
        .eq('id', wallet.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating wallet for purchase:', updateError);
        throw new Error(`Failed to update wallet: ${updateError.message}`);
      }

      // Record in ledger
      await StoneLedgerService.appendEntry({
        walletId: wallet.id,
        userId,
        transactionType: 'purchase',
        deltaCastingStones: 0,
        deltaInventoryShard: pack.stones_shard + pack.bonus_shard,
        deltaInventoryCrystal: pack.stones_crystal + pack.bonus_crystal,
        deltaInventoryRelic: pack.stones_relic + pack.bonus_relic,
        reason: `Purchased ${pack.name} stone pack`,
        packId,
        metadata: {
          packName: pack.name,
          packPrice: pack.price_cents,
          packCurrency: pack.currency,
        },
      });

      return {
        packId,
        stonesAdded: {
          shard: pack.stones_shard,
          crystal: pack.stones_crystal,
          relic: pack.stones_relic,
        },
        bonusAdded: {
          shard: pack.bonus_shard,
          crystal: pack.bonus_crystal,
          relic: pack.bonus_relic,
        },
        newBalance: {
          castingStones: updatedWallet.casting_stones,
          inventoryShard: updatedWallet.inventory_shard,
          inventoryCrystal: updatedWallet.inventory_crystal,
          inventoryRelic: updatedWallet.inventory_relic,
        },
      };
    } catch (error) {
      console.error('WalletService.applyPurchase error:', error);
      throw error;
    }
  }

  /**
   * Spend casting stones (for game actions)
   */
  static async spendCastingStones(
    userId: string,
    amount: number,
    idempotencyKey: string,
    gameId: string,
    reason: string,
    isGuest: boolean = false
  ): Promise<{ success: boolean; newBalance: number; error?: string; message?: string }> {
    try {
      const wallet = await this.getWallet(userId, isGuest);

      if (wallet.castingStones < amount) {
        throw new Error(`Insufficient casting stones. Have ${wallet.castingStones}, need ${amount}`);
      }

      const newBalance = wallet.castingStones - amount;

      const { error: updateError } = await supabaseAdmin
        .from('stone_wallets')
        .update({ casting_stones: newBalance })
        .eq('id', wallet.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating wallet for spending:', updateError);
        throw new Error(`Failed to update wallet: ${updateError.message}`);
      }

      // Record in ledger
      await StoneLedgerService.appendEntry({
        walletId: wallet.id,
        userId: isGuest ? undefined : userId,
        cookieGroupId: isGuest ? userId : undefined,
        transactionType: 'spend',
        deltaCastingStones: -amount,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason,
        metadata: {},
      });

      return { success: true, newBalance };
    } catch (error) {
      console.error('WalletService.spendCastingStones error:', error);
      return { 
        success: false, 
        newBalance: 0, 
        error: 'INSUFFICIENT_INVENTORY',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's wallet balance
   */
  static async getWallet(ownerId: string, isGuest: boolean = false): Promise<StoneWallet> {
    if (isGuest) {
      return this.getOrCreateGuestWallet(ownerId);
    }
    return this.getOrCreateWallet(ownerId);
  }

  /**
   * Get or create a wallet for a guest user (cookie group)
   */
  static async getOrCreateGuestWallet(cookieGroupId: string): Promise<StoneWallet> {
    try {
      // Try to get existing wallet
      const { data: existingWallet, error: fetchError } = await supabaseAdmin
        .from('stone_wallets')
        .select('*')
        .eq('cookie_group_id', cookieGroupId)
        .single();

      if (existingWallet && !fetchError) {
        return this.mapGuestWalletFromDb(existingWallet);
      }

      // Create new wallet if it doesn't exist
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('stone_wallets')
        .insert({
          cookie_group_id: cookieGroupId,
          casting_stones: 0,
          inventory_shard: 0,
          inventory_crystal: 0,
          inventory_relic: 0,
          daily_regen: 0,
          last_regen_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating guest wallet:', createError);
        throw new Error(`Failed to create guest wallet: ${createError.message}`);
      }

      return this.mapGuestWalletFromDb(newWallet);
    } catch (error) {
      console.error('WalletService.getOrCreateGuestWallet error:', error);
      throw error;
    }
  }

  /**
   * Add casting stones to a wallet (for starter grants, etc.)
   */
  static async addCastingStones(
    ownerId: string,
    isGuest: boolean,
    amount: number,
    transactionType: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const wallet = await this.getWallet(ownerId, isGuest);

      const { error: updateError } = await supabaseAdmin
        .from('stone_wallets')
        .update({ 
          casting_stones: wallet.castingStones + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id);

      if (updateError) {
        console.error('Error updating wallet for stone grant:', updateError);
        throw new Error(`Failed to update wallet: ${updateError.message}`);
      }

      // Record in ledger
      await StoneLedgerService.appendEntry({
        walletId: wallet.id,
        userId: isGuest ? undefined : ownerId,
        cookieGroupId: isGuest ? ownerId : undefined,
        transactionType: transactionType as any,
        deltaCastingStones: amount,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: `Granted ${amount} casting stones`,
        metadata,
      });
    } catch (error) {
      console.error('WalletService.addCastingStones error:', error);
      throw error;
    }
  }

  /**
   * Helper method to get inventory amount by type
   */
  private static getInventoryAmount(wallet: StoneWallet, type: 'shard' | 'crystal' | 'relic'): number {
    switch (type) {
      case 'shard':
        return wallet.inventoryShard;
      case 'crystal':
        return wallet.inventoryCrystal;
      case 'relic':
        return wallet.inventoryRelic;
    }
  }

  /**
   * Helper method to map database row to StoneWallet type
   */
  private static mapWalletFromDb(dbRow: any): StoneWallet {
    return {
      id: dbRow.id,
      userId: dbRow.user_id,
      castingStones: dbRow.casting_stones,
      inventoryShard: dbRow.inventory_shard,
      inventoryCrystal: dbRow.inventory_crystal,
      inventoryRelic: dbRow.inventory_relic,
      dailyRegen: dbRow.daily_regen,
      lastRegenAt: dbRow.last_regen_at,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
    };
  }

  /**
   * Helper method to map guest wallet database row to StoneWallet type
   */
  private static mapGuestWalletFromDb(dbRow: any): StoneWallet {
    return {
      id: dbRow.id,
      userId: undefined, // Guest wallets don't have user_id
      castingStones: dbRow.casting_stones,
      inventoryShard: dbRow.inventory_shard,
      inventoryCrystal: dbRow.inventory_crystal,
      inventoryRelic: dbRow.inventory_relic,
      dailyRegen: dbRow.daily_regen,
      lastRegenAt: dbRow.last_regen_at,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
    };
  }
}