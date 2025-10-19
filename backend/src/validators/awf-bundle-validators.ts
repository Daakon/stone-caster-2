/**
 * AWF Bundle Validators
 * Phase 3: Bundle Assembler - Validation schemas for assembled bundles
 */

import { z } from 'zod';

// Meta validation
export const AwfBundleMetaSchema = z.object({
  engine_version: z.string().min(1, 'Engine version is required'),
  world: z.string().min(1, 'World reference is required'),
  adventure: z.string().min(1, 'Adventure reference is required'),
  turn_id: z.number().int().min(1, 'Turn ID must be a positive integer'),
  is_first_turn: z.boolean(),
  timestamp: z.string().min(1, 'Timestamp is required'),
});

// Contract validation
export const AwfBundleContractSchema = z.object({
  id: z.string().min(1, 'Contract ID is required'),
  version: z.string().min(1, 'Contract version is required'),
  hash: z.string().min(1, 'Contract hash is required'),
  doc: z.record(z.unknown()),
});

// World validation
export const AwfBundleWorldSchema = z.object({
  ref: z.string().min(1, 'World reference is required'),
  hash: z.string().min(1, 'World hash is required'),
  slice: z.array(z.string()).min(1, 'At least one world slice is required'),
  doc: z.record(z.unknown()).optional(),
});

// Adventure validation
export const AwfBundleAdventureSchema = z.object({
  ref: z.string().min(1, 'Adventure reference is required'),
  hash: z.string().min(1, 'Adventure hash is required'),
  slice: z.array(z.string()).min(1, 'At least one adventure slice is required'),
  start_hint: z.object({
    scene: z.string().min(1, 'Start scene is required'),
    description: z.string().min(1, 'Start description is required'),
    initial_state: z.record(z.unknown()).optional(),
  }).optional(),
  doc: z.record(z.unknown()).optional(),
});

// NPC validation
export const AwfBundleNpcSchema = z.object({
  id: z.string().min(1, 'NPC ID is required'),
  name: z.string().min(1, 'NPC name is required'),
  description: z.string().min(1, 'NPC description is required'),
  role: z.string().min(1, 'NPC role is required'),
  location: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AwfBundleNpcsSchema = z.object({
  active: z.array(AwfBundleNpcSchema).max(5, 'Maximum 5 active NPCs allowed'),
  count: z.number().int().min(0).max(5, 'NPC count must be between 0 and 5'),
});

// Player validation
export const AwfBundlePlayerSchema = z.object({
  id: z.string().min(1, 'Player ID is required'),
  name: z.string().min(1, 'Player name is required'),
  traits: z.record(z.unknown()),
  skills: z.record(z.unknown()),
  inventory: z.array(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

// Game state validation
export const AwfBundleGameStateSchema = z.object({
  hot: z.record(z.unknown()),
  warm: z.object({
    episodic: z.array(z.unknown()),
    pins: z.array(z.unknown()),
  }),
  cold: z.record(z.unknown()),
});

// RNG validation
export const AwfBundleRngSchema = z.object({
  seed: z.string().min(1, 'RNG seed is required'),
  policy: z.string().min(1, 'RNG policy is required'),
});

// Input validation
export const AwfBundleInputSchema = z.object({
  text: z.string().min(1, 'Input text is required'),
  timestamp: z.string().min(1, 'Input timestamp is required'),
});

// Main bundle validation
export const AwfBundleSchema = z.object({
  awf_bundle: z.object({
    meta: AwfBundleMetaSchema,
    contract: AwfBundleContractSchema,
    world: AwfBundleWorldSchema,
    adventure: AwfBundleAdventureSchema,
    npcs: AwfBundleNpcsSchema,
    player: AwfBundlePlayerSchema,
    game_state: AwfBundleGameStateSchema,
    rng: AwfBundleRngSchema,
    input: AwfBundleInputSchema,
  }),
});

// Bundle parameters validation
export const AwfBundleParamsSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  inputText: z.string().min(1, 'Input text is required'),
});

// Scene slice policy validation
export const SceneSlicePolicySchema = z.record(
  z.string().min(1, 'Scene ID cannot be empty'),
  z.array(z.string()).min(1, 'Scene slices cannot be empty')
);

// Default slice config validation
export const DefaultSliceConfigSchema = z.object({
  world: z.array(z.string()).min(1, 'Default world slices are required'),
  adventure: z.array(z.string()).min(1, 'Default adventure slices are required'),
});

// Bundle metrics validation
export const AwfBundleMetricsSchema = z.object({
  byteSize: z.number().int().min(0, 'Byte size must be non-negative'),
  estimatedTokens: z.number().int().min(0, 'Token count must be non-negative'),
  npcCount: z.number().int().min(0).max(5, 'NPC count must be between 0 and 5'),
  sliceCount: z.number().int().min(0, 'Slice count must be non-negative'),
  buildTime: z.number().min(0, 'Build time must be non-negative'),
});

// Validation error schema
export const AwfBundleValidationErrorSchema = z.object({
  field: z.string().min(1, 'Error field is required'),
  message: z.string().min(1, 'Error message is required'),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
});


