/**
 * Slot Rendering (DB-backed)
 * Mustache-based rendering of slot templates from database
 */

import Mustache from 'mustache';
import type { SlotType } from './registry.js';
import { getTemplate } from '../services/templates.service.js';
import { getCachedActiveTemplates } from '../services/templates-cache.js';
import { getSlotByTypeAndName } from '../services/slots.service.js';
import { renderCached } from '../services/mustache-cache.js';

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

export interface SlotPack {
  type: SlotType;
  id?: string;
  name?: string;
  version?: string;
  data: Record<string, unknown>;
}

export interface RenderSlotsOptions {
  templatesVersion?: number;
}

export interface RenderedSlot {
  slot: string;
  text: string;
  priority: number;
}

/**
 * Render slots for multiple packs (DB-backed)
 */
export async function renderSlots(
  packs: SlotPack[],
  options: RenderSlotsOptions = {}
): Promise<Record<string, RenderedSlot[]>> {
  const result: Record<string, RenderedSlot[]> = {};
  const templatesVersion = options.templatesVersion;

  // Get all active templates for the pack types (from cache)
  const packTypes = [...new Set(packs.map(p => p.type))];
  const allTemplates = await Promise.all(
    packTypes.map(type => getCachedActiveTemplates(type, templatesVersion))
  );
  const templatesByType = new Map<SlotType, Awaited<ReturnType<typeof getCachedActiveTemplates>>>();
  for (let i = 0; i < packTypes.length; i++) {
    templatesByType.set(packTypes[i], allTemplates[i]);
  }

  for (const pack of packs) {
    const packKey = pack.id || pack.name || 'unknown';
    const rendered: RenderedSlot[] = [];

    // Get templates for this pack type
    const templates = templatesByType.get(pack.type) || [];

    // Render each slot template
    for (const template of templates) {
      try {
        // Prepare context for Mustache
        const context: Record<string, unknown> = {
          ...pack.data,
          // Add type-specific prefixes for convenience
          [pack.type]: pack.data,
          // Add extras if available (from pack.data.extras or directly)
          extras: pack.data.extras || {},
          // Add helpers
          join: mustacheHelpers.join,
          truncate: mustacheHelpers.truncate,
          first: mustacheHelpers.first,
          last: mustacheHelpers.last,
        };

        // Render template (using cached compilation)
        const renderedText = renderCached(template.body, context);

        // Get slot definition for max_len and priority
        const slotDef = await getSlotByTypeAndName(pack.type, template.slot);
        const maxLen = slotDef?.max_len;
        const priority = slotDef?.priority || 0;

        let finalText = renderedText;
        if (maxLen && renderedText.length > maxLen) {
          finalText = renderedText.substring(0, maxLen - 3) + '...';
        }

        rendered.push({
          slot: template.slot,
          text: finalText,
          priority,
        });
      } catch (error) {
        console.error(`[renderSlots] Error rendering ${pack.type}.${template.slot}:`, error);
        // Continue with other slots
      }
    }

    // Sort by priority (descending), then by slot name
    rendered.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.slot.localeCompare(b.slot);
    });

    if (rendered.length > 0) {
      result[packKey] = rendered;
    }
  }

  return result;
}

/**
 * Render slots for a single pack and return as record (DB-backed)
 */
export async function renderSlotsForPack(
  pack: SlotPack,
  options: RenderSlotsOptions = {}
): Promise<Record<string, string>> {
  const rendered = await renderSlots([pack], options);
  const packKey = pack.id || pack.name || 'unknown';
  const slots = rendered[packKey] || [];

  const result: Record<string, string> = {};
  for (const slot of slots) {
    result[slot.slot] = slot.text;
  }

  return result;
}

