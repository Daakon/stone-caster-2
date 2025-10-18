/**
 * Economy Acts Integration
 * Extends the acts system to support economy operations
 */

import { inventoryEngine, InventoryMap, EquipmentMap, CurrencyState } from '../inventory/inventory-engine.js';
import { lootVendorEngine, LootResult, VendorTrade } from './loot-vendor-engine.js';
import { craftingEngine, CraftingAttempt, CraftingResult } from '../crafting/crafting-engine.js';

export interface EconomyAct {
  type: 'ITEM_ADD' | 'ITEM_REMOVE' | 'ITEM_MOVE' | 'EQUIP' | 'UNEQUIP' | 
        'LOOT_ROLL' | 'VENDOR_BUY' | 'VENDOR_SELL' | 'CRAFT_ATTEMPT' | 'CRAFT_RESULT' | 
        'CURRENCY_DELTA';
  [key: string]: any;
}

export interface EconomyContext {
  sessionId: string;
  turnId: number;
  actor: string;
  gameState: {
    inventory: {
      player: InventoryMap;
      npcs: { [npcId: string]: InventoryMap };
    };
    equipment: {
      player: EquipmentMap;
      npcs: { [npcId: string]: EquipmentMap };
    };
    currency: CurrencyState;
    flags: Record<string, any>;
    objectives: Record<string, string>;
  };
}

export interface EconomyActionResult {
  success: boolean;
  newActs: EconomyAct[];
  updatedGameState: EconomyContext['gameState'];
  summary: {
    itemsGained: Array<{ id: string; qty: number }>;
    itemsLost: Array<{ id: string; qty: number }>;
    currencyDelta: Record<string, number>;
    equipmentChanges: Array<{ slot: string; action: string; itemId?: string }>;
  };
}

export class EconomyActsIntegration {
  private readonly maxActsPerTurn: number;

  constructor() {
    this.maxActsPerTurn = parseInt(process.env.AWF_MECH_MAX_ACTS_PER_TURN || '8');
  }

  /**
   * Process economy acts in the interpreter
   */
  async processEconomyActs(
    acts: EconomyAct[],
    context: EconomyContext
  ): Promise<EconomyActionResult> {
    const newActs: EconomyAct[] = [];
    const updatedGameState = { ...context.gameState };
    const summary = {
      itemsGained: [] as Array<{ id: string; qty: number }>,
      itemsLost: [] as Array<{ id: string; qty: number }>,
      currencyDelta: {} as Record<string, number>,
      equipmentChanges: [] as Array<{ slot: string; action: string; itemId?: string }>,
    };

    // Validate acts count
    if (acts.length > this.maxActsPerTurn) {
      throw new Error(`Too many economy acts: ${acts.length} > ${this.maxActsPerTurn}`);
    }

    // Process each act
    for (const act of acts) {
      const result = await this.processAct(act, context, updatedGameState, summary);
      newActs.push(...result.newActs);
    }

    return {
      success: true,
      newActs,
      updatedGameState,
      summary,
    };
  }

  /**
   * Process a single economy act
   */
  private async processAct(
    act: EconomyAct,
    context: EconomyContext,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): Promise<{ newActs: EconomyAct[] }> {
    const newActs: EconomyAct[] = [];

    switch (act.type) {
      case 'ITEM_ADD':
        const addResult = this.processItemAdd(act, gameState, summary);
        if (addResult.success) {
          summary.itemsGained.push({ id: act.id, qty: act.quantity || 1 });
        }
        break;

      case 'ITEM_REMOVE':
        const removeResult = this.processItemRemove(act, gameState, summary);
        if (removeResult.success) {
          summary.itemsLost.push({ id: act.id, qty: act.quantity || 1 });
        }
        break;

      case 'ITEM_MOVE':
        this.processItemMove(act, gameState, summary);
        break;

      case 'EQUIP':
        const equipResult = this.processEquip(act, gameState, summary);
        if (equipResult.success) {
          summary.equipmentChanges.push({ slot: act.slot, action: 'equip', itemId: act.id });
        }
        break;

      case 'UNEQUIP':
        const unequipResult = this.processUnequip(act, gameState, summary);
        if (unequipResult.success) {
          summary.equipmentChanges.push({ slot: act.slot, action: 'unequip' });
        }
        break;

      case 'LOOT_ROLL':
        const lootResult = this.processLootRoll(act, context, gameState, summary);
        newActs.push(...lootResult.newActs);
        break;

      case 'VENDOR_BUY':
        const buyResult = this.processVendorBuy(act, gameState, summary);
        if (buyResult.success) {
          summary.itemsGained.push({ id: act.id, qty: act.quantity || 1 });
          summary.currencyDelta[act.currency || 'gold'] = -(act.totalCost || 0);
        }
        break;

      case 'VENDOR_SELL':
        const sellResult = this.processVendorSell(act, gameState, summary);
        if (sellResult.success) {
          summary.itemsLost.push({ id: act.id, qty: act.quantity || 1 });
          summary.currencyDelta[act.currency || 'gold'] = (act.totalValue || 0);
        }
        break;

      case 'CRAFT_ATTEMPT':
        const craftResult = this.processCraftAttempt(act, context, gameState, summary);
        newActs.push(...craftResult.newActs);
        break;

      case 'CRAFT_RESULT':
        this.processCraftResult(act, gameState, summary);
        break;

      case 'CURRENCY_DELTA':
        this.processCurrencyDelta(act, gameState, summary);
        break;

      default:
        console.warn(`Unknown economy act type: ${act.type}`);
    }

    return { newActs };
  }

  /**
   * Process ITEM_ADD act
   */
  private processItemAdd(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { success: boolean; reason?: string } {
    const target = act.target || 'player';
    const inventory = target === 'player' ? gameState.inventory.player : gameState.inventory.npcs[target];
    
    if (!inventory) {
      return { success: false, reason: `Unknown target: ${target}` };
    }

    const result = inventoryEngine.addItems(
      inventory,
      act.id,
      act.quantity || 1,
      act.metadata
    );

    return result;
  }

  /**
   * Process ITEM_REMOVE act
   */
  private processItemRemove(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { success: boolean; reason?: string } {
    const target = act.target || 'player';
    const inventory = target === 'player' ? gameState.inventory.player : gameState.inventory.npcs[target];
    
    if (!inventory) {
      return { success: false, reason: `Unknown target: ${target}` };
    }

    const result = inventoryEngine.removeItems(
      inventory,
      act.id,
      act.quantity || 1
    );

    return result;
  }

  /**
   * Process ITEM_MOVE act
   */
  private processItemMove(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): void {
    const fromInventory = gameState.inventory.player; // Simplified for now
    const toInventory = gameState.inventory.player; // Simplified for now

    inventoryEngine.moveItems(
      fromInventory,
      toInventory,
      act.id,
      act.quantity || 1
    );
  }

  /**
   * Process EQUIP act
   */
  private processEquip(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { success: boolean; reason?: string } {
    const inventory = gameState.inventory.player;
    const equipment = gameState.equipment.player;

    return inventoryEngine.equipItem(inventory, equipment, act.id, act.slot);
  }

  /**
   * Process UNEQUIP act
   */
  private processUnequip(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { success: boolean; reason?: string } {
    const inventory = gameState.inventory.player;
    const equipment = gameState.equipment.player;

    return inventoryEngine.unequipItem(inventory, equipment, act.slot);
  }

  /**
   * Process LOOT_ROLL act
   */
  private processLootRoll(
    act: EconomyAct,
    context: EconomyContext,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { newActs: EconomyAct[] } {
    const newActs: EconomyAct[] = [];

    try {
      const lootResult = lootVendorEngine.rollLoot(
        act.tableId!,
        context.sessionId,
        context.turnId,
        act.nodeId || 'default'
      );

      // Generate ITEM_ADD acts for looted items
      for (const item of lootResult.items) {
        newActs.push({
          type: 'ITEM_ADD',
          target: 'player',
          id: item.id,
          quantity: item.quantity,
        });
      }

      // Generate CURRENCY_DELTA acts for looted currency
      for (const currency of lootResult.currency) {
        newActs.push({
          type: 'CURRENCY_DELTA',
          key: currency.key,
          delta: currency.amount,
        });
      }
    } catch (error) {
      console.error('Loot roll failed:', error);
    }

    return { newActs };
  }

  /**
   * Process VENDOR_BUY act
   */
  private processVendorBuy(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { success: boolean; reason?: string } {
    const result = lootVendorEngine.buyFromVendor(
      act.vendorId!,
      act.id,
      act.quantity || 1,
      gameState.currency
    );

    if (result.success) {
      // Update currency
      gameState.currency[act.currency || 'gold'] -= result.cost;
    }

    return result;
  }

  /**
   * Process VENDOR_SELL act
   */
  private processVendorSell(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { success: boolean; reason?: string } {
    const result = lootVendorEngine.sellToVendor(
      act.vendorId!,
      act.id,
      act.quantity || 1
    );

    if (result.success) {
      // Update currency
      gameState.currency[act.currency || 'gold'] += result.value;
    }

    return result;
  }

  /**
   * Process CRAFT_ATTEMPT act
   */
  private processCraftAttempt(
    act: EconomyAct,
    context: EconomyContext,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): { newActs: EconomyAct[] } {
    const newActs: EconomyAct[] = [];

    try {
      const attempt: CraftingAttempt = {
        recipeId: act.recipeId!,
        inputs: act.inputs || [],
        station: act.station,
        skill: act.skill,
      };

      const result = craftingEngine.attemptCrafting(
        attempt,
        context.sessionId,
        context.turnId,
        context.actor
      );

      // Generate CRAFT_RESULT act
      newActs.push({
        type: 'CRAFT_RESULT',
        recipeId: act.recipeId,
        outcome: result.outcome,
        quality: result.quality,
        yields: result.yields,
        bonus: result.bonus,
        byproducts: result.byproducts,
      });

      // Generate ITEM_ADD acts for yields
      for (const output of result.yields) {
        newActs.push({
          type: 'ITEM_ADD',
          target: 'player',
          id: output.id,
          quantity: output.qty,
        });
      }

      // Generate ITEM_ADD acts for bonus items
      for (const bonus of result.bonus) {
        newActs.push({
          type: 'ITEM_ADD',
          target: 'player',
          id: bonus.id,
          quantity: bonus.qty,
        });
      }

      // Generate ITEM_ADD acts for byproducts
      for (const byproduct of result.byproducts) {
        newActs.push({
          type: 'ITEM_ADD',
          target: 'player',
          id: byproduct.id,
          quantity: byproduct.qty,
        });
      }
    } catch (error) {
      console.error('Craft attempt failed:', error);
    }

    return { newActs };
  }

  /**
   * Process CRAFT_RESULT act
   */
  private processCraftResult(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): void {
    // Craft result processing is handled in CRAFT_ATTEMPT
    // This is here for completeness
  }

  /**
   * Process CURRENCY_DELTA act
   */
  private processCurrencyDelta(
    act: EconomyAct,
    gameState: EconomyContext['gameState'],
    summary: EconomyActionResult['summary']
  ): void {
    const key = act.key || 'gold';
    const delta = act.delta || 0;
    const currentValue = gameState.currency[key] || 0;
    const newValue = Math.max(0, currentValue + delta);
    
    gameState.currency[key] = newValue;
    
    if (delta !== 0) {
      summary.currencyDelta[key] = (summary.currencyDelta[key] || 0) + delta;
    }
  }

  /**
   * Validate economy acts
   */
  validateEconomyActs(acts: EconomyAct[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const act of acts) {
      switch (act.type) {
        case 'ITEM_ADD':
        case 'ITEM_REMOVE':
          if (!act.id || !act.target) {
            errors.push(`${act.type} act missing required fields`);
          }
          break;

        case 'ITEM_MOVE':
          if (!act.id || !act.from || !act.to) {
            errors.push('ITEM_MOVE act missing required fields');
          }
          break;

        case 'EQUIP':
        case 'UNEQUIP':
          if (!act.slot) {
            errors.push(`${act.type} act missing slot`);
          }
          break;

        case 'LOOT_ROLL':
          if (!act.tableId) {
            errors.push('LOOT_ROLL act missing tableId');
          }
          break;

        case 'VENDOR_BUY':
        case 'VENDOR_SELL':
          if (!act.vendorId || !act.id) {
            errors.push(`${act.type} act missing required fields`);
          }
          break;

        case 'CRAFT_ATTEMPT':
          if (!act.recipeId) {
            errors.push('CRAFT_ATTEMPT act missing recipeId');
          }
          break;

        case 'CURRENCY_DELTA':
          if (!act.key || typeof act.delta !== 'number') {
            errors.push('CURRENCY_DELTA act missing key or delta');
          }
          break;

        default:
          errors.push(`Unknown economy act type: ${act.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get economy act types
   */
  getEconomyActTypes(): string[] {
    return [
      'ITEM_ADD',
      'ITEM_REMOVE',
      'ITEM_MOVE',
      'EQUIP',
      'UNEQUIP',
      'LOOT_ROLL',
      'VENDOR_BUY',
      'VENDOR_SELL',
      'CRAFT_ATTEMPT',
      'CRAFT_RESULT',
      'CURRENCY_DELTA',
    ];
  }
}

// Singleton instance
export const economyActsIntegration = new EconomyActsIntegration();
