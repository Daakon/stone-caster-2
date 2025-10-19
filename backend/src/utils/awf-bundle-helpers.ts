/**
 * AWF Bundle Helper Functions
 * Phase 3: Bundle Assembler - Utility functions for bundle assembly
 */

import { stableJsonStringify } from './awf-hashing.js';

/**
 * Set a value at a JSON Pointer path in an object
 * @param obj - The object to modify
 * @param pointer - JSON Pointer path (e.g., "/awf_bundle/contract/id")
 * @param value - The value to set
 */
export function setAtPointer(obj: Record<string, unknown>, pointer: string, value: unknown): void {
  if (!pointer.startsWith('/')) {
    throw new Error('JSON Pointer must start with "/"');
  }

  const path = pointer.slice(1).split('/');
  let current = obj;

  // Navigate to the parent of the target
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  // Set the final value
  const finalKey = path[path.length - 1];
  current[finalKey] = value;
}

/**
 * Get a value at a JSON Pointer path from an object
 * @param obj - The object to read from
 * @param pointer - JSON Pointer path (e.g., "/awf_bundle/contract/id")
 * @returns The value at the path, or undefined if not found
 */
export function getAtPointer(obj: Record<string, unknown>, pointer: string): unknown {
  if (!pointer.startsWith('/')) {
    throw new Error('JSON Pointer must start with "/"');
  }

  const path = pointer.slice(1).split('/');
  let current: unknown = obj;

  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Estimate token count for a JSON object using simple heuristic
 * @param obj - The object to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(obj: unknown): number {
  if (obj === null || obj === undefined) {
    return 0;
  }

  const jsonString = stableJsonStringify(obj);
  if (jsonString.length === 0) {
    return 0;
  }

  // Simple heuristic: ~4 characters per token
  return Math.max(1, Math.ceil(jsonString.length / 4));
}

/**
 * Generate a deterministic RNG seed based on session and turn
 * @param sessionId - Session ID
 * @param turnId - Turn ID
 * @returns Deterministic seed string
 */
export function generateRngSeed(sessionId: string, turnId: number): string {
  // Use a simple hash of session + turn for deterministic seeding
  const input = `${sessionId}-${turnId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Select slices based on current scene or defaults
 * @param currentScene - Current scene ID
 * @param sceneSlicePolicy - Scene to slices mapping
 * @param defaultSlices - Default slices to use
 * @returns Selected slices
 */
export function selectSlices(
  currentScene: string | undefined,
  sceneSlicePolicy: Record<string, string[]>,
  defaultSlices: string[]
): string[] {
  if (currentScene && sceneSlicePolicy[currentScene]) {
    return sceneSlicePolicy[currentScene];
  }
  return defaultSlices;
}

/**
 * Filter NPCs to only include active ones (max 5)
 * @param npcs - Array of NPCs
 * @param maxCount - Maximum number of NPCs to include
 * @returns Filtered array of active NPCs
 */
export function filterActiveNpcs(npcs: Array<{
  id: string;
  name: string;
  description: string;
  role: string;
  location?: string;
  metadata?: Record<string, unknown>;
}>, maxCount: number = 5): Array<{
  id: string;
  name: string;
  description: string;
  role: string;
  location?: string;
  metadata?: Record<string, unknown>;
}> {
  return npcs.slice(0, maxCount);
}

/**
 * Create a stable string representation of an object for logging
 * @param obj - Object to stringify
 * @returns Stable JSON string
 */
export function stableStringify(obj: unknown): string {
  return stableJsonStringify(obj);
}

/**
 * Calculate bundle metrics
 * @param bundle - The assembled bundle
 * @param buildTime - Time taken to build the bundle
 * @returns Bundle metrics
 */
export function calculateBundleMetrics(
  bundle: Record<string, unknown>,
  buildTime: number
): {
  byteSize: number;
  estimatedTokens: number;
  npcCount: number;
  sliceCount: number;
  buildTime: number;
} {
  const jsonString = stableJsonStringify(bundle);
  const byteSize = Buffer.byteLength(jsonString, 'utf8');
  const estimatedTokens = estimateTokens(bundle);

  // Extract counts from bundle structure
  const awfBundle = bundle.awf_bundle as Record<string, unknown>;
  const npcs = awfBundle.npcs as { active: unknown[]; count: number };
  const world = awfBundle.world as { slice: string[] };
  const adventure = awfBundle.adventure as { slice: string[] };

  const npcCount = npcs?.count || 0;
  const sliceCount = (world?.slice?.length || 0) + (adventure?.slice?.length || 0);

  return {
    byteSize,
    estimatedTokens,
    npcCount,
    sliceCount,
    buildTime,
  };
}

/**
 * Validate that a bundle has all required fields
 * @param bundle - Bundle to validate
 * @returns Array of validation errors
 */
export function validateBundleStructure(bundle: Record<string, unknown>): Array<{
  field: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}> {
  const errors: Array<{
    field: string;
    message: string;
    expected?: unknown;
    actual?: unknown;
  }> = [];

  // Check for awf_bundle root
  if (!bundle.awf_bundle) {
    errors.push({
      field: 'awf_bundle',
      message: 'Missing awf_bundle root object',
      expected: 'object',
      actual: undefined,
    });
    return errors;
  }

  const awfBundle = bundle.awf_bundle as Record<string, unknown>;

  // Check required top-level fields
  const requiredFields = ['meta', 'contract', 'world', 'adventure', 'npcs', 'player', 'game_state', 'rng', 'input'];
  for (const field of requiredFields) {
    if (!(field in awfBundle)) {
      errors.push({
        field: `awf_bundle.${field}`,
        message: `Missing required field: ${field}`,
        expected: 'object',
        actual: undefined,
      });
    }
  }

  // Check meta fields
  if (awfBundle.meta) {
    const meta = awfBundle.meta as Record<string, unknown>;
    if (typeof meta.turn_id !== 'number') {
      errors.push({
        field: 'awf_bundle.meta.turn_id',
        message: 'turn_id must be a number',
        expected: 'number',
        actual: typeof meta.turn_id,
      });
    }
    if (typeof meta.is_first_turn !== 'boolean') {
      errors.push({
        field: 'awf_bundle.meta.is_first_turn',
        message: 'is_first_turn must be a boolean',
        expected: 'boolean',
        actual: typeof meta.is_first_turn,
      });
    }
  }

  // Check input text
  if (awfBundle.input) {
    const input = awfBundle.input as Record<string, unknown>;
    if (typeof input.text !== 'string' || input.text.length === 0) {
      errors.push({
        field: 'awf_bundle.input.text',
        message: 'input.text must be a non-empty string',
        expected: 'non-empty string',
        actual: typeof input.text,
      });
    }
  }

  return errors;
}

// Re-export stableJsonStringify for convenience
export { stableJsonStringify };
