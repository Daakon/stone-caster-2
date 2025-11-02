/**
 * Phase 2: Utility functions for prompt assembler
 */

/**
 * Estimate token count using rough approximation (chars / 4)
 * Can be swapped later for more accurate tokenizer
 */
export function roughTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Map database layer field to Scope type
 */
export function mapLayerToScope(layer: string): 'core' | 'ruleset' | 'world' | 'scenario' | 'entry' | 'npc' {
  // Normalize layer name to scope
  const normalized = layer.toLowerCase().trim();
  
  // Direct mappings
  if (normalized === 'core' || normalized === 'systems' || normalized === 'engine' || 
      normalized === 'foundation' || normalized === 'ai_behavior' || normalized === 'data_management' ||
      normalized === 'performance') {
    return 'core';
  }
  if (normalized === 'ruleset') {
    return 'ruleset';
  }
  if (normalized === 'world' || normalized === 'world-codex' || normalized === 'content') {
    return 'world';
  }
  if (normalized === 'scenario') {
    return 'scenario';
  }
  if (normalized === 'entry' || normalized === 'adventure' || normalized === 'entry_start') {
    return 'entry';
  }
  if (normalized === 'npc') {
    return 'npc';
  }
  
  // Default fallback based on common patterns
  if (normalized.includes('core') || normalized.includes('system') || normalized.includes('engine')) {
    return 'core';
  }
  if (normalized.includes('ruleset')) {
    return 'ruleset';
  }
  if (normalized.includes('world')) {
    return 'world';
  }
  if (normalized.includes('entry') || normalized.includes('adventure')) {
    return 'entry';
  }
  if (normalized.includes('npc')) {
    return 'npc';
  }
  
  // Default to core for unknown layers
  console.warn(`[ASSEMBLER] Unknown layer "${layer}", defaulting to "core"`);
  return 'core';
}

/**
 * Get environment variable with fallback
 */
export function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Get environment variable for percentage with fallback
 */
export function getEnvPercentage(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Format piece identifier as "scope:slug@version"
 */
export function formatPieceId(scope: string, slug: string, version?: string): string {
  return `${scope}:${slug}${version ? `@${version}` : ''}`;
}

/**
 * Parse piece identifier from "scope:slug@version" format
 */
export function parsePieceId(pieceId: string): { scope: string; slug: string; version?: string } {
  const [scopeSlug, version] = pieceId.split('@');
  const [scope, ...slugParts] = scopeSlug.split(':');
  return {
    scope,
    slug: slugParts.join(':'),
    version,
  };
}

