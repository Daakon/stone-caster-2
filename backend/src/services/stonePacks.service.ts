import { supabaseAdmin } from './supabase.js';
import type { StonePack } from 'shared';

/**
 * Stone Packs Service - manages purchasable stone packs
 */
export class StonePacksService {
  /**
   * Get all active stone packs
   */
  static async getActivePacks(): Promise<StonePack[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_packs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching stone packs:', error);
        throw new Error(`Failed to fetch stone packs: ${error.message}`);
      }

      return (data || []).map(this.mapPackFromDb);
    } catch (error) {
      console.error('StonePacksService.getActivePacks error:', error);
      throw error;
    }
  }

  /**
   * Get a specific stone pack by ID
   */
  static async getPackById(packId: string): Promise<StonePack | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stone_packs')
        .select('*')
        .eq('id', packId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        console.error('Error fetching stone pack:', error);
        throw new Error(`Failed to fetch stone pack: ${error.message}`);
      }

      return this.mapPackFromDb(data);
    } catch (error) {
      console.error('StonePacksService.getPackById error:', error);
      throw error;
    }
  }

  /**
   * Validate that a pack exists and is active
   */
  static async validatePack(packId: string): Promise<boolean> {
    try {
      const pack = await this.getPackById(packId);
      return pack !== null;
    } catch (error) {
      console.error('StonePacksService.validatePack error:', error);
      return false;
    }
  }

  /**
   * Helper method to map database row to StonePack type
   */
  private static mapPackFromDb(dbRow: any): StonePack {
    return {
      id: dbRow.id,
      name: dbRow.name,
      description: dbRow.description,
      priceCents: dbRow.price_cents,
      currency: dbRow.currency,
      stonesShard: dbRow.stones_shard,
      stonesCrystal: dbRow.stones_crystal,
      stonesRelic: dbRow.stones_relic,
      bonusShard: dbRow.bonus_shard,
      bonusCrystal: dbRow.bonus_crystal,
      bonusRelic: dbRow.bonus_relic,
      isActive: dbRow.is_active,
      sortOrder: dbRow.sort_order,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
    };
  }
}
