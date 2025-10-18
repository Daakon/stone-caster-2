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
  ref: string;
  hash: string;
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

// Individual NPC
export interface AwfBundleNpc {
  id: string;
  name: string;
  description: string;
  role: string;
  location?: string;
  metadata?: Record<string, unknown>;
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


