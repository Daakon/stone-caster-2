/**
 * AWF Bundle Minifier
 * Strips unnecessary fields and minifies JSON for optimal token count
 */

import type { AwfBundle } from '../types/awf-bundle.js';

/**
 * Strip unnecessary fields from bundle that aren't needed for AI inference
 * Goal: Absolute lowest token count while retaining full functionality
 */
export function stripNonEssentialFields(bundle: AwfBundle): Record<string, unknown> {
  const stripped: Record<string, unknown> = {
    awf_bundle: {}
  };
  const target = stripped.awf_bundle as Record<string, unknown>;
  const source = bundle.awf_bundle;

  // Meta: Keep only essential fields
  target.meta = {
    world: source.meta.world,
    adventure: source.meta.adventure,
    turn_id: source.meta.turn_id,
    is_first_turn: source.meta.is_first_turn,
    // Keep locale for i18n
    ...(source.meta.locale && { locale: source.meta.locale }),
    // Keep LiveOps levers (needed for AI to respect budgets)
    ...(source.meta.token_budget && { token_budget: source.meta.token_budget }),
    ...(source.meta.tool_quota && { tool_quota: source.meta.tool_quota }),
    // Strip: engine_version, timestamp (not needed for AI)
  };

  // Contract: Keep only doc (strip id, version, hash - not needed for AI)
  target.contract = {
    doc: source.contract.doc
  };

  // Core: Keep ruleset and acts_catalog (essential)
  target.core = {
    ruleset: source.core.ruleset,
    ...(source.core.contract?.acts_catalog && source.core.contract.acts_catalog.length > 0 && {
      contract: {
        acts_catalog: source.core.contract.acts_catalog
      }
    })
  };

  // World: Keep as-is (already compacted)
  if (source.world) {
    target.world = source.world;
  }

  // Adventure: Keep as-is (already compacted)
  if (source.adventure) {
    target.adventure = source.adventure;
  }

  // Scenario: Keep only if present
  if (source.scenario) {
    target.scenario = source.scenario;
  }

  // NPCs: Keep active array, strip count (redundant)
  if (source.npcs.active.length > 0) {
    target.npcs = {
      active: source.npcs.active
      // Strip: count (array length is implicit)
    };
  } else {
    target.npcs = { active: [] };
  }

  // Player: Keep essential fields, strip empty objects/arrays
  target.player = {
    id: source.player.id,
    name: source.player.name,
    ...(source.player.traits && Object.keys(source.player.traits).length > 0 && { traits: source.player.traits }),
    ...(source.player.skills && Object.keys(source.player.skills).length > 0 && { skills: source.player.skills }),
    ...(Array.isArray(source.player.inventory) && source.player.inventory.length > 0 && { inventory: source.player.inventory }),
    // Strip: metadata (typically not needed for AI inference)
  };

  // Game state: Keep as-is (essential for context)
  target.game_state = source.game_state;

  // RNG: Keep as-is (essential for determinism)
  target.rng = source.rng;

  // Input: Keep as-is (essential)
  target.input = source.input;

  return stripped;
}

/**
 * Minify JSON to absolute smallest size while remaining valid and readable to AI
 * - No whitespace
 * - No pretty-printing
 * - Removes undefined fields
 */
export function minifyBundleJson(bundle: AwfBundle): string {
  // First strip non-essential fields
  const stripped = stripNonEssentialFields(bundle);
  
  // Remove undefined values recursively
  const cleaned = removeUndefined(stripped);
  
  // Minify JSON (no whitespace, no pretty-printing)
  return JSON.stringify(cleaned);
}

/**
 * Recursively remove undefined values from object
 * Preserves null, empty arrays, and empty objects (some structures may require them)
 */
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    const cleaned = obj.map(removeUndefined);
    // Filter undefined items but preserve empty arrays (structure may require them)
    return cleaned.filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = removeUndefined(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    // Preserve object even if empty (some structures may require it)
    return cleaned;
  }
  
  return obj;
}

/**
 * Estimate token count for minified bundle
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateMinifiedTokens(minifiedJson: string): number {
  return Math.ceil(minifiedJson.length / 4);
}

