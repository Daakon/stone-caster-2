/**
 * Phase 17: Loot & Vendor Engine
 * Handles loot generation, vendor interactions, and pricing
 */

import { z } from 'zod';

// Types
export interface LootEntry {
  id: string;
  weight: number;
  quantity: [number, number]; // [min, max]
}

export interface LootTable {
  id: string;
  rolls: number;
  entries: LootEntry[];
}

export interface LootResult {
  items: Array<{ id: string; quantity: number }>;
  currency: Array<{ key: string; amount: number }>;
}

export interface VendorStock {
  id: string;
  quantity: number;
  price: number;
}

export interface Vendor {
  id: string;
  currency: string;
  stock: VendorStock[];
  buySpread: number; // 0.0 to 1.0
  sellSpread: number; // 0.0 to 1.0
  refresh: 'daily' | 'weekly' | 'never';
}

export interface VendorTrade {
  success: boolean;
  cost?: number;
  value?: number;
  errors: string[];
}

// Schemas
const LootEntrySchema = z.object({
  id: z.string(),
  weight: z.number().min(0),
  quantity: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
});

const LootTableSchema = z.object({
  id: z.string(),
  rolls: z.number().int().min(1),
  entries: z.array(LootEntrySchema),
});

const VendorStockSchema = z.object({
  id: z.string(),
  quantity: z.number().int().min(0),
  price: z.number().min(0),
});

const VendorSchema = z.object({
  id: z.string(),
  currency: z.string(),
  stock: z.array(VendorStockSchema),
  buySpread: z.number().min(0).max(1),
  sellSpread: z.number().min(0).max(1),
  refresh: z.enum(['daily', 'weekly', 'never']),
});

export class LootVendorEngine {
  private lootTables: Map<string, LootTable> = new Map();
  private vendors: Map<string, Vendor> = new Map();
  private itemRegistry: Map<string, any> = new Map();

  constructor() {
    // Initialize with empty registries
  }

  /**
   * Roll loot from table
   */
  rollLoot(
    tableId: string,
    sessionId: string,
    turnId: number,
    nodeId: string
  ): LootResult {
    const table = this.lootTables.get(tableId);
    if (!table) {
      throw new Error(`Unknown loot table: ${tableId}`);
    }

    const result: LootResult = {
      items: [],
      currency: [],
    };

    // Generate deterministic seed
    const seed = this.generateSeed(sessionId, turnId, nodeId, tableId);
    const rng = this.createRNG(seed);

    // Roll for each entry
    for (let roll = 0; roll < table.rolls; roll++) {
      for (const entry of table.entries) {
        const rollValue = rng();
        if (rollValue < entry.weight) {
          const quantity = this.randomInt(
            entry.quantity[0],
            entry.quantity[1],
            rng
          );

          if (entry.id.startsWith('gold') || entry.id === 'gold') {
            result.currency.push({
              key: 'gold',
              amount: quantity,
            });
          } else {
            // Check if item already exists
            const existingItem = result.items.find(item => item.id === entry.id);
            if (existingItem) {
              existingItem.quantity += quantity;
            } else {
              result.items.push({
                id: entry.id,
                quantity,
              });
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Buy item from vendor
   */
  buyFromVendor(
    vendorId: string,
    itemId: string,
    quantity: number,
    playerCurrency: Record<string, number>
  ): VendorTrade {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) {
      return {
        success: false,
        errors: [`Unknown vendor: ${vendorId}`],
      };
    }

    const stockItem = vendor.stock.find(item => item.id === itemId);
    if (!stockItem) {
      return {
        success: false,
        errors: [`Item not available: ${itemId}`],
      };
    }

    if (stockItem.quantity < quantity) {
      return {
        success: false,
        errors: [`Insufficient stock: ${stockItem.quantity} < ${quantity}`],
      };
    }

    const totalCost = stockItem.price * quantity;
    const playerGold = playerCurrency[vendor.currency] || 0;

    if (playerGold < totalCost) {
      return {
        success: false,
        errors: [`Insufficient currency: ${playerGold} < ${totalCost}`],
      };
    }

    // Update stock
    stockItem.quantity -= quantity;

    return {
      success: true,
      cost: totalCost,
      errors: [],
    };
  }

  /**
   * Sell item to vendor
   */
  sellToVendor(
    vendorId: string,
    itemId: string,
    quantity: number
  ): VendorTrade {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) {
      return {
        success: false,
        errors: [`Unknown vendor: ${vendorId}`],
      };
    }

    const stockItem = vendor.stock.find(item => item.id === itemId);
    if (!stockItem) {
      return {
        success: false,
        errors: [`Vendor doesn't buy: ${itemId}`],
      };
    }

    const sellPrice = Math.floor(stockItem.price * vendor.buySpread);
    const totalValue = sellPrice * quantity;

    return {
      success: true,
      value: totalValue,
      errors: [],
    };
  }

  /**
   * Calculate item price
   */
  calculateItemPrice(
    itemId: string,
    rarity: string,
    tier: number
  ): number {
    const item = this.itemRegistry.get(itemId);
    if (!item) {
      return 0;
    }

    const basePrice = 10; // Default base price
    const rarityFactors: Record<string, number> = {
      common: 1.0,
      uncommon: 1.5,
      rare: 2.0,
      epic: 3.0,
      legendary: 5.0,
    };

    const tierFactor = 1 + (tier - 1) * 0.5;
    const rarityFactor = rarityFactors[rarity] || 1.0;

    return Math.floor(basePrice * tierFactor * rarityFactor);
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(
    sessionId: string,
    turnId: number,
    nodeId: string,
    tableId: string
  ): number {
    const seedString = `${sessionId}-${turnId}-${nodeId}-${tableId}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create deterministic RNG
   */
  private createRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Generate random integer
   */
  private randomInt(min: number, max: number, rng: () => number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  /**
   * Set registries (for testing)
   */
  setLootTables(tables: Map<string, LootTable>): void {
    this.lootTables = tables;
  }

  setVendors(vendors: Map<string, Vendor>): void {
    this.vendors = vendors;
  }

  setItemRegistry(registry: Map<string, any>): void {
    this.itemRegistry = registry;
  }
}

// Singleton instance
export const lootVendorEngine = new LootVendorEngine();