/**
 * AWF Bundle Types
 * Phase 3: Bundle Assembler - Type definitions for assembled bundles
 */

// AWF Bundle Structure
export interface AwfBundle {
  awf_bundle: {
    meta: AwfBundleMeta;
    contract: AwfBundleContract;
    world: AwfBundleWorld;
    adventure: AwfBundleAdventure;
    npcs: AwfBundleNpcs;
    player: AwfBundlePlayer;
    game_state: AwfBundleGameState;
    rng: AwfBundleRng;
    input: AwfBundleInput;
  };
}

// Meta information
export interface AwfBundleMeta {
  engine_version: string;
  world: string;
  adventure: string;
  turn_id: number;
  is_first_turn: boolean;
  locale?: string;
  timestamp: string;
}

// Core contract
export interface AwfBundleContract {
  id: string;
  version: string;
  hash: string;
  doc: Record<string, unknown>;
}

// World information
export interface AwfBundleWorld {
  id: string;
  name: string;
  version: string;
  timeworld?: Record<string, unknown>; // Optional timeworld section
  bands?: Array<{ id: string; label?: string; ticks?: number }>; // Top-level bands
  weather_states?: string[]; // Top-level weather states
  weather_transition_bias?: Record<string, number>; // Top-level weather transition bias
  lexicon?: Record<string, unknown>; // Lexicon section
  identity_language?: Record<string, unknown>; // Identity language section
  magic?: Record<string, unknown>; // Magic section
  essence_behavior?: Record<string, unknown>; // Essence behavior section
  species_rules?: Record<string, unknown>; // Species rules section
  factions_world?: unknown[]; // Factions world section
  lore_index?: Record<string, unknown>; // Lore index section
  tone?: Record<string, unknown>; // Tone section
  locations?: Array<{ id: string; name: string; [k: string]: unknown }>; // Locations section
  custom?: Record<string, unknown>; // Custom sections
  slice: string[];
  doc?: Record<string, unknown>; // Optional inline content
}

// Adventure information
export interface AwfBundleAdventure {
  ref: string;
  hash: string;
  slice: string[];
  start_hint?: AwfBundleAdventureStart; // Only on first turn
  doc?: Record<string, unknown>; // Optional inline content
}

// Adventure start information
export interface AwfBundleAdventureStart {
  scene: string;
  description: string;
  initial_state?: Record<string, unknown>;
}

// NPCs information
export interface AwfBundleNpcs {
  active: AwfBundleNpc[];
  count: number;
}

// Individual NPC (compact format)
export interface AwfBundleNpc {
  id: string | null;
  ver: string | null;
  name: string;
  archetype: string | null;
  summary: string;
  style: {
    voice: string | null;
    register: string | null;
  };
  tags: string[];
}

// Player information
export interface AwfBundlePlayer {
  id: string;
  name: string;
  traits: Record<string, unknown>;
  skills: Record<string, unknown>;
  inventory: unknown[];
  metadata?: Record<string, unknown>;
}

// Game state information
export interface AwfBundleGameState {
  hot: Record<string, unknown>;
  warm: {
    episodic: unknown[];
    pins: unknown[];
  };
  cold: Record<string, unknown>;
}

// RNG information
export interface AwfBundleRng {
  seed: string;
  policy: string;
}

// Input information
export interface AwfBundleInput {
  text: string;
  timestamp: string;
}

// Bundle assembly parameters
export interface AwfBundleParams {
  sessionId: string;
  inputText: string;
}

// Scene slice policy
export interface SceneSlicePolicy {
  [sceneId: string]: string[];
}

// Default slice configuration
export interface DefaultSliceConfig {
  world: string[];
  adventure: string[];
}

// Bundle assembly result
export interface AwfBundleResult {
  bundle: AwfBundle;
  metrics: AwfBundleMetrics;
}

// Bundle metrics
export interface AwfBundleMetrics {
  byteSize: number;
  estimatedTokens: number;
  npcCount: number;
  sliceCount: number;
  buildTime: number;
}

// Bundle validation error
export interface AwfBundleValidationError {
  field: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}


