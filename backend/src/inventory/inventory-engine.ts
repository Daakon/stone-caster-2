/**
 * Phase 17: Inventory & Equipment Engine
 * Handles inventory management, equipment slots, and currency
 */

import { z } from 'zod';

// Types
export interface InventoryItem {
  id: string;
  quantity: number;
  metadata?: Record<string, any>;
}

export interface InventoryMap {
  [itemId: string]: InventoryItem;
}

export interface EquipmentMap {
  [slot: string]: string; // itemId
}

export interface CurrencyState {
  [currency: string]: number;
}

export interface ItemRegistry {
  [itemId: string]: {
    id: string;
    name: string;
    category: string;
    rarity: string;
    tier: number;
    stackSize: number;
    tags: string[];
    rules?: Record<string, any>;
  };
}

// Schemas
const InventoryItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().min(0),
  metadata: z.record(z.any()).optional(),
});

const EquipmentMapSchema = z.record(z.string());

const CurrencyStateSchema = z.record(z.number().min(0));

// Equipment slots
const EQUIPMENT_SLOTS = [
  'head', 'body', 'hands', 'offhand', 'amulet', 'ring1', 'ring2'
] as const;

export class InventoryEngine {
  private itemRegistry: Map<string, any> = new Map();

  constructor() {
    // Initialize with empty registry
  }

  /**
   * Add items to inventory
   */
  addItems(
    inventory: InventoryMap,
    itemId: string,
    quantity: number,
    metadata?: Record<string, any>
  ): { success: boolean; added: number; errors: string[] } {
    const errors: string[] = [];
    
    if (quantity <= 0) {
      errors.push('Quantity must be positive');
      return { success: false, added: 0, errors };
    }

    const item = this.itemRegistry.get(itemId);
    if (!item) {
      errors.push(`Unknown item: ${itemId}`);
      return { success: false, added: 0, errors };
    }

    const currentQuantity = inventory[itemId]?.quantity || 0;
    const maxStack = item.stackSize || 999;
    const availableSpace = maxStack - currentQuantity;
    const toAdd = Math.min(quantity, availableSpace);
    
    if (toAdd > 0) {
      if (inventory[itemId]) {
        inventory[itemId].quantity += toAdd;
      } else {
        inventory[itemId] = {
          id: itemId,
          quantity: toAdd,
          metadata: metadata || {},
        };
      }
    }

    return {
      success: toAdd > 0,
      added: toAdd,
      errors,
    };
  }

  /**
   * Remove items from inventory
   */
  removeItems(
    inventory: InventoryMap,
    itemId: string,
    quantity: number
  ): { success: boolean; removed: number; errors: string[] } {
    const errors: string[] = [];
    
    if (quantity <= 0) {
      errors.push('Quantity must be positive');
      return { success: false, removed: 0, errors };
    }

    const currentQuantity = inventory[itemId]?.quantity || 0;
    const toRemove = Math.min(quantity, currentQuantity);
    
    if (toRemove > 0) {
      inventory[itemId].quantity -= toRemove;
      if (inventory[itemId].quantity <= 0) {
        delete inventory[itemId];
      }
    }

    return {
      success: toRemove > 0,
      removed: toRemove,
      errors,
    };
  }

  /**
   * Move items between inventories
   */
  moveItems(
    fromInventory: InventoryMap,
    toInventory: InventoryMap,
    itemId: string,
    quantity: number
  ): { success: boolean; moved: number; errors: string[] } {
    const errors: string[] = [];
    
    if (quantity <= 0) {
      errors.push('Quantity must be positive');
      return { success: false, moved: 0, errors };
    }

    const currentQuantity = fromInventory[itemId]?.quantity || 0;
    const toMove = Math.min(quantity, currentQuantity);
    
    if (toMove > 0) {
      // Remove from source
      const removeResult = this.removeItems(fromInventory, itemId, toMove);
      if (removeResult.success) {
        // Add to destination
        const addResult = this.addItems(toInventory, itemId, toMove);
        if (addResult.success) {
          return { success: true, moved: toMove, errors: [] };
        } else {
          // Rollback: add back to source
          this.addItems(fromInventory, itemId, toMove);
          errors.push('Destination inventory full');
        }
      }
    }

    return {
      success: false,
      moved: 0,
      errors,
    };
  }

  /**
   * Equip item to slot
   */
  equipItem(
    inventory: InventoryMap,
    equipment: EquipmentMap,
    itemId: string,
    slot: string
  ): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!EQUIPMENT_SLOTS.includes(slot as any)) {
      errors.push(`Invalid equipment slot: ${slot}`);
      return { success: false, errors };
    }

    const item = this.itemRegistry.get(itemId);
    if (!item) {
      errors.push(`Unknown item: ${itemId}`);
      return { success: false, errors };
    }

    // Check if item is in inventory
    const inventoryItem = inventory[itemId];
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      errors.push('Item not in inventory');
      return { success: false, errors };
    }

    // Check for conflicts (two-handed weapons, etc.)
    if (slot === 'hands' && item.category === 'weapon' && item.tags?.includes('two-handed')) {
      // Two-handed weapon occupies both hands
      if (equipment.hands || equipment.offhand) {
        errors.push('Two-handed weapon conflicts with equipped items');
        return { success: false, errors };
      }
    }

    // Remove from inventory
    const removeResult = this.removeItems(inventory, itemId, 1);
    if (!removeResult.success) {
      errors.push('Failed to remove item from inventory');
      return { success: false, errors };
    }

    // Equip item
    equipment[slot] = itemId;

    return { success: true, errors: [] };
  }

  /**
   * Unequip item from slot
   */
  unequipItem(
    inventory: InventoryMap,
    equipment: EquipmentMap,
    slot: string
  ): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!EQUIPMENT_SLOTS.includes(slot as any)) {
      errors.push(`Invalid equipment slot: ${slot}`);
      return { success: false, errors };
    }

    const itemId = equipment[slot];
    if (!itemId) {
      errors.push('No item equipped in slot');
      return { success: false, errors };
    }

    // Add back to inventory
    const addResult = this.addItems(inventory, itemId, 1);
    if (!addResult.success) {
      errors.push('Inventory full, cannot unequip');
      return { success: false, errors };
    }

    // Remove from equipment
    delete equipment[slot];

    return { success: true, errors: [] };
  }

  /**
   * Validate inventory state
   */
  validateInventory(inventory: InventoryMap): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [itemId, item] of Object.entries(inventory)) {
      // Validate item exists in registry
      const registryItem = this.itemRegistry.get(itemId);
      if (!registryItem) {
        errors.push(`Unknown item in inventory: ${itemId}`);
        continue;
      }

      // Validate quantity
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for ${itemId}: ${item.quantity}`);
      }

      // Validate stack size
      const maxStack = registryItem.stackSize || 999;
      if (item.quantity > maxStack) {
        errors.push(`Stack size exceeded for ${itemId}: ${item.quantity} > ${maxStack}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get item from registry
   */
  getItem(itemId: string): any {
    return this.itemRegistry.get(itemId);
  }

  /**
   * Set item registry (for testing)
   */
  setItemRegistry(registry: Map<string, any>): void {
    this.itemRegistry = registry;
  }
}

// Singleton instance
export const inventoryEngine = new InventoryEngine();
