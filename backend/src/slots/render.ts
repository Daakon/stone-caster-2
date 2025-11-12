/**
 * Slot Rendering
 * Mustache-based rendering of slot templates
 */

import Mustache from 'mustache';
import { templateRegistry, slotRegistry, SlotType } from './registry.js';

/**
 * Helper functions for Mustache templates
 */
const mustacheHelpers = {
  join: (list: unknown[], separator: string = ', ') => {
    if (!Array.isArray(list)) return '';
    return list.filter(Boolean).join(separator);
  },
  truncate: (text: string, maxLen: number) => {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
  },
  first: (list: unknown[]) => {
    if (!Array.isArray(list) || list.length === 0) return '';
    return String(list[0]);
  },
  last: (list: unknown[]) => {
    if (!Array.isArray(list) || list.length === 0) return '';
    return String(list[list.length - 1]);
  },
};

/**
 * Render slots for a pack (world, ruleset, npc, etc.)
 */
export interface SlotPack {
  type: SlotType;
  id?: string;
  name?: string;
  version?: string;
  data: Record<string, unknown>;
}

export interface RenderSlotsOptions {
  templatesVersion?: string;
}

export interface RenderedSlot {
  slot: string;
  text: string;
}

/**
 * Render slots for multiple packs
 */
export function renderSlots(
  packs: SlotPack[],
  options: RenderSlotsOptions = {}
): Record<string, RenderedSlot[]> {
  const result: Record<string, RenderedSlot[]> = {};
  const templatesVersion = options.templatesVersion;

  for (const pack of packs) {
    const packKey = pack.id || pack.name || 'unknown';
    const rendered: RenderedSlot[] = [];

    // Get all slots for this pack type
    const slots = templateRegistry.getAll(pack.type);
    const slotsBySlotName = new Map<string, typeof slots[0]>();
    
    for (const slot of slots) {
      if (!slotsBySlotName.has(slot.slot)) {
        slotsBySlotName.set(slot.slot, slot);
      }
    }

    // Render each slot template
    for (const [slotName, template] of slotsBySlotName.entries()) {
      const templateDef = templateRegistry.get(
        pack.type,
        slotName,
        templatesVersion
      );

      if (!templateDef) continue;

      try {
        // Prepare context for Mustache
        const context: Record<string, unknown> = {
          ...pack.data,
          // Add type-specific prefixes for convenience
          [pack.type]: pack.data,
          // Add helpers
          join: mustacheHelpers.join,
          truncate: mustacheHelpers.truncate,
          first: mustacheHelpers.first,
          last: mustacheHelpers.last,
        };

        // Render template
        const renderedText = Mustache.render(templateDef.body, context);

        // Apply max_len if slot definition exists
        const slotDef = slotRegistry.get(pack.type, slotName);
        if (slotDef?.max_len && renderedText.length > slotDef.max_len) {
          rendered.push({
            slot: slotName,
            text: renderedText.substring(0, slotDef.max_len - 3) + '...',
          });
        } else {
          rendered.push({
            slot: slotName,
            text: renderedText,
          });
        }
      } catch (error) {
        console.error(`[renderSlots] Error rendering ${pack.type}.${slotName}:`, error);
        // Continue with other slots
      }
    }

    if (rendered.length > 0) {
      result[packKey] = rendered;
    }
  }

  return result;
}

/**
 * Render slots for a single pack and return as record
 */
export function renderSlotsForPack(
  pack: SlotPack,
  options: RenderSlotsOptions = {}
): Record<string, string> {
  const rendered = renderSlots([pack], options);
  const packKey = pack.id || pack.name || 'unknown';
  const slots = rendered[packKey] || [];

  const result: Record<string, string> = {};
  for (const slot of slots) {
    result[slot.slot] = slot.text;
  }

  return result;
}

