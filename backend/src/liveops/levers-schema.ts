// Phase 28: LiveOps Remote Configuration System
// Typed lever schemas with bounds validation and normalization

import { z } from 'zod';

// Base types for validation
const PercentageSchema = z.number().min(0).max(1).transform(val => Math.round(val * 100) / 100);
const PositiveNumberSchema = z.number().positive();
const NonNegativeNumberSchema = z.number().min(0);
const IntegerSchema = z.number().int();
const BooleanSchema = z.boolean();
const StringSchema = z.string().min(1);

// Token & Model Levers
export const TokenModelLeversSchema = z.object({
  // Input/output token caps
  AWF_MAX_INPUT_TOKENS: z.number().int().min(1000).max(12000).default(4000),
  AWF_MAX_OUTPUT_TOKENS: z.number().int().min(500).max(8000).default(2000),
  
  // Tool call quota
  AWF_TOOL_CALL_QUOTA: z.number().int().min(1).max(20).default(5),
  
  // Mod micro-slice caps
  AWF_MOD_MICRO_SLICE_CAP: z.number().int().min(100).max(2000).default(500),
  
  // Model tier allowlist
  AWF_MODEL_TIER_ALLOWLIST: z.array(z.enum(['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'claude-2'])).default(['gpt-4', 'gpt-3.5-turbo']),
  
  // Token budget multipliers
  AWF_INPUT_TOKEN_MULTIPLIER: PercentageSchema.default(1.0),
  AWF_OUTPUT_TOKEN_MULTIPLIER: PercentageSchema.default(1.0),
});

// Pacing & Difficulty Levers
export const PacingDifficultyLeversSchema = z.object({
  // Quest pacing tempo multipliers
  QUEST_PACING_TEMPO_MULTIPLIER: PercentageSchema.default(1.0),
  QUEST_OBJECTIVE_HINT_FREQUENCY: PercentageSchema.default(0.1),
  
  // Soft-lock prevention
  SOFT_LOCK_HINT_FREQUENCY: PercentageSchema.default(0.05),
  SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS: z.number().int().min(5).max(50).default(15),
  
  // Skill-check policy weights
  SKILL_CHECK_DIFFICULTY_BIAS: z.number().min(-0.5).max(0.5).default(0.0),
  SKILL_CHECK_SUCCESS_RATE_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Resource regeneration/decay multipliers
  RESOURCE_REGEN_MULTIPLIER: PercentageSchema.default(1.0),
  RESOURCE_DECAY_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Turn pacing
  TURN_PACING_MULTIPLIER: PercentageSchema.default(1.0),
  TURN_TIMEOUT_MULTIPLIER: PercentageSchema.default(1.0),
});

// Mechanics & Economy Levers
export const MechanicsEconomyLeversSchema = z.object({
  // Drop rate multipliers per rarity
  DROP_RATE_COMMON_MULTIPLIER: PercentageSchema.default(1.0),
  DROP_RATE_UNCOMMON_MULTIPLIER: PercentageSchema.default(1.0),
  DROP_RATE_RARE_MULTIPLIER: PercentageSchema.default(1.0),
  DROP_RATE_EPIC_MULTIPLIER: PercentageSchema.default(1.0),
  DROP_RATE_LEGENDARY_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Vendor margin range
  VENDOR_MARGIN_MIN: PercentageSchema.default(0.1),
  VENDOR_MARGIN_MAX: PercentageSchema.default(0.3),
  VENDOR_STOCK_REFRESH_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Crafting quality bias
  CRAFTING_QUALITY_BIAS: z.number().min(-0.5).max(0.5).default(0.0),
  CRAFTING_SUCCESS_RATE_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Currency sink/source caps
  CURRENCY_SINK_DAILY_CAP: z.number().int().min(0).max(10000).default(1000),
  CURRENCY_SOURCE_DAILY_CAP: z.number().int().min(0).max(10000).default(1000),
  
  // Economic activity rates
  ECONOMIC_ACTIVITY_MULTIPLIER: PercentageSchema.default(1.0),
  TRADE_FREQUENCY_MULTIPLIER: PercentageSchema.default(1.0),
});

// World Simulation Levers
export const WorldSimLeversSchema = z.object({
  // Event rate multiplier
  WORLD_EVENT_RATE_MULTIPLIER: PercentageSchema.default(1.0),
  WORLD_EVENT_SEVERITY_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Weather front volatility
  WEATHER_VOLATILITY_MULTIPLIER: PercentageSchema.default(1.0),
  WEATHER_FRONT_FREQUENCY_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Region drift step caps
  REGION_DRIFT_STEP_CAP: z.number().int().min(1).max(10).default(3),
  REGION_DRIFT_FREQUENCY_MULTIPLIER: PercentageSchema.default(1.0),
  
  // World state persistence
  WORLD_STATE_PERSISTENCE_MULTIPLIER: PercentageSchema.default(1.0),
  WORLD_STATE_DECAY_MULTIPLIER: PercentageSchema.default(1.0),
});

// Dialogue & Romance Levers
export const DialogueRomanceLeversSchema = z.object({
  // Dialogue candidate cap
  DIALOGUE_CANDIDATE_CAP: z.number().int().min(1).max(20).default(5),
  DIALOGUE_CANDIDATE_SCORE_THRESHOLD: z.number().min(0).max(1).default(0.3),
  
  // Cooldown multipliers
  DIALOGUE_COOLDOWN_MULTIPLIER: PercentageSchema.default(1.0),
  ROMANCE_COOLDOWN_TURNS: z.number().int().min(1).max(50).default(10),
  
  // Romance progression
  ROMANCE_PROGRESSION_MULTIPLIER: PercentageSchema.default(1.0),
  ROMANCE_CONSENT_STRICTNESS: z.enum(['strict', 'moderate', 'lenient']).default('moderate'),
  
  // Dialogue engagement
  DIALOGUE_ENGAGEMENT_MULTIPLIER: PercentageSchema.default(1.0),
  DIALOGUE_DEPTH_MULTIPLIER: PercentageSchema.default(1.0),
});

// Party Management Levers
export const PartyLeversSchema = z.object({
  // Max active members
  PARTY_MAX_ACTIVE_MEMBERS: z.number().int().min(1).max(8).default(4),
  PARTY_DELEGATE_CHECK_RATE: PercentageSchema.default(0.1),
  
  // Intent mix bias
  PARTY_INTENT_MIX_BIAS: z.object({
    COOPERATIVE: PercentageSchema.default(0.4),
    COMPETITIVE: PercentageSchema.default(0.3),
    NEUTRAL: PercentageSchema.default(0.3),
  }),
  
  // Party dynamics
  PARTY_COHESION_MULTIPLIER: PercentageSchema.default(1.0),
  PARTY_CONFLICT_MULTIPLIER: PercentageSchema.default(1.0),
  
  // Member management
  PARTY_MEMBER_SATISFACTION_MULTIPLIER: PercentageSchema.default(1.0),
  PARTY_MEMBER_LOYALTY_MULTIPLIER: PercentageSchema.default(1.0),
});

// Module Gates
export const ModuleGatesSchema = z.object({
  DIALOGUE_GATE: z.enum(['off', 'readonly', 'full']).default('full'),
  WORLDSIM_GATE: z.enum(['off', 'readonly', 'full']).default('full'),
  PARTY_GATE: z.enum(['off', 'readonly', 'full']).default('full'),
  MODS_GATE: z.enum(['off', 'readonly', 'full']).default('full'),
  TOOLS_GATE: z.enum(['off', 'readonly', 'full']).default('full'),
  ECONOMY_KERNEL_GATE: z.enum(['off', 'readonly', 'full']).default('full'),
});

// Complete LiveOps Config Schema
export const LiveOpsConfigSchema = z.object({
  // Token & Model
  ...TokenModelLeversSchema.shape,
  
  // Pacing & Difficulty
  ...PacingDifficultyLeversSchema.shape,
  
  // Mechanics & Economy
  ...MechanicsEconomyLeversSchema.shape,
  
  // World Simulation
  ...WorldSimLeversSchema.shape,
  
  // Dialogue & Romance
  ...DialogueRomanceLeversSchema.shape,
  
  // Party Management
  ...PartyLeversSchema.shape,
  
  // Module Gates
  ...ModuleGatesSchema.shape,
  
  // Metadata
  _metadata: z.object({
    version: z.string().default('1.0.0'),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    created_by: z.string().optional(),
    scope: z.enum(['global', 'world', 'adventure', 'experiment', 'session']).optional(),
    scope_ref: z.string().optional(),
  }).optional(),
}).partial(); // Make all fields optional for default config

// Type exports
export type TokenModelLevers = z.infer<typeof TokenModelLeversSchema>;
export type PacingDifficultyLevers = z.infer<typeof PacingDifficultyLeversSchema>;
export type MechanicsEconomyLevers = z.infer<typeof MechanicsEconomyLeversSchema>;
export type WorldSimLevers = z.infer<typeof WorldSimLeversSchema>;
export type DialogueRomanceLevers = z.infer<typeof DialogueRomanceLeversSchema>;
export type PartyLevers = z.infer<typeof PartyLeversSchema>;
export type ModuleGates = z.infer<typeof ModuleGatesSchema>;
export type LiveOpsConfig = z.infer<typeof LiveOpsConfigSchema>;

// Validation functions
export function validateLiveOpsConfig(config: unknown): { success: boolean; data?: LiveOpsConfig; error?: string } {
  try {
    // For partial configs, merge with defaults first
    const defaultConfig = createDefaultLiveOpsConfig();
    const mergedConfig = { ...defaultConfig, ...config };
    const validated = LiveOpsConfigSchema.parse(mergedConfig);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
      };
    }
    return { success: false, error: `Unknown validation error: ${error}` };
  }
}

// Bounds checking functions
export function checkConfigBounds(config: LiveOpsConfig): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Check token bounds
  if (config.AWF_MAX_INPUT_TOKENS < 1000 || config.AWF_MAX_INPUT_TOKENS > 12000) {
    violations.push('AWF_MAX_INPUT_TOKENS must be between 1000 and 12000');
  }
  
  if (config.AWF_MAX_OUTPUT_TOKENS < 500 || config.AWF_MAX_OUTPUT_TOKENS > 8000) {
    violations.push('AWF_MAX_OUTPUT_TOKENS must be between 500 and 8000');
  }
  
  // Check percentage bounds
  const percentageFields = [
    'AWF_INPUT_TOKEN_MULTIPLIER',
    'AWF_OUTPUT_TOKEN_MULTIPLIER',
    'QUEST_PACING_TEMPO_MULTIPLIER',
    'SOFT_LOCK_HINT_FREQUENCY',
    'RESOURCE_REGEN_MULTIPLIER',
    'RESOURCE_DECAY_MULTIPLIER',
    'DROP_RATE_COMMON_MULTIPLIER',
    'DROP_RATE_UNCOMMON_MULTIPLIER',
    'DROP_RATE_RARE_MULTIPLIER',
    'DROP_RATE_EPIC_MULTIPLIER',
    'DROP_RATE_LEGENDARY_MULTIPLIER',
    'VENDOR_MARGIN_MIN',
    'VENDOR_MARGIN_MAX',
    'CRAFTING_SUCCESS_RATE_MULTIPLIER',
    'ECONOMIC_ACTIVITY_MULTIPLIER',
    'TRADE_FREQUENCY_MULTIPLIER',
    'WORLD_EVENT_RATE_MULTIPLIER',
    'WORLD_EVENT_SEVERITY_MULTIPLIER',
    'WEATHER_VOLATILITY_MULTIPLIER',
    'WEATHER_FRONT_FREQUENCY_MULTIPLIER',
    'REGION_DRIFT_FREQUENCY_MULTIPLIER',
    'WORLD_STATE_PERSISTENCE_MULTIPLIER',
    'WORLD_STATE_DECAY_MULTIPLIER',
    'DIALOGUE_COOLDOWN_MULTIPLIER',
    'ROMANCE_PROGRESSION_MULTIPLIER',
    'DIALOGUE_ENGAGEMENT_MULTIPLIER',
    'DIALOGUE_DEPTH_MULTIPLIER',
    'PARTY_DELEGATE_CHECK_RATE',
    'PARTY_COHESION_MULTIPLIER',
    'PARTY_CONFLICT_MULTIPLIER',
    'PARTY_MEMBER_SATISFACTION_MULTIPLIER',
    'PARTY_MEMBER_LOYALTY_MULTIPLIER'
  ];
  
  for (const field of percentageFields) {
    const value = (config as any)[field];
    if (value !== undefined && (value < 0 || value > 1)) {
      violations.push(`${field} must be between 0 and 1 (percentage)`);
    }
  }
  
  // Check integer bounds
  if (config.AWF_TOOL_CALL_QUOTA < 1 || config.AWF_TOOL_CALL_QUOTA > 20) {
    violations.push('AWF_TOOL_CALL_QUOTA must be between 1 and 20');
  }
  
  if (config.SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS < 5 || config.SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS > 50) {
    violations.push('SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS must be between 5 and 50');
  }
  
  if (config.PARTY_MAX_ACTIVE_MEMBERS < 1 || config.PARTY_MAX_ACTIVE_MEMBERS > 8) {
    violations.push('PARTY_MAX_ACTIVE_MEMBERS must be between 1 and 8');
  }
  
  if (config.ROMANCE_COOLDOWN_TURNS < 1 || config.ROMANCE_COOLDOWN_TURNS > 50) {
    violations.push('ROMANCE_COOLDOWN_TURNS must be between 1 and 50');
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

// Default config factory
export function createDefaultLiveOpsConfig(): LiveOpsConfig {
  return {
    // Token & Model defaults
    AWF_MAX_INPUT_TOKENS: 4000,
    AWF_MAX_OUTPUT_TOKENS: 2000,
    AWF_INPUT_TOKEN_MULTIPLIER: 1.0,
    AWF_OUTPUT_TOKEN_MULTIPLIER: 1.0,
    AWF_TOOL_CALL_QUOTA: 5,
    AWF_MOD_MICRO_SLICE_CAP: 500,
    AWF_MODEL_TIER_ALLOWLIST: ['gpt-4', 'gpt-3.5-turbo'],
    
    // Pacing & Difficulty defaults
    QUEST_PACING_TEMPO_MULTIPLIER: 1.0,
    QUEST_OBJECTIVE_HINT_FREQUENCY: 0.1,
    SOFT_LOCK_HINT_FREQUENCY: 0.05,
    SOFT_LOCK_MAX_TURNS_WITHOUT_PROGRESS: 15,
    SKILL_CHECK_DIFFICULTY_BIAS: 0.0,
    SKILL_CHECK_SUCCESS_RATE_MULTIPLIER: 1.0,
    RESOURCE_REGEN_MULTIPLIER: 1.0,
    RESOURCE_DECAY_MULTIPLIER: 1.0,
    TURN_PACING_MULTIPLIER: 1.0,
    TURN_TIMEOUT_MULTIPLIER: 1.0,
    
    // Mechanics & Economy defaults
    DROP_RATE_COMMON_MULTIPLIER: 1.0,
    DROP_RATE_UNCOMMON_MULTIPLIER: 1.0,
    DROP_RATE_RARE_MULTIPLIER: 1.0,
    DROP_RATE_EPIC_MULTIPLIER: 1.0,
    DROP_RATE_LEGENDARY_MULTIPLIER: 1.0,
    VENDOR_MARGIN_MIN: 0.1,
    VENDOR_MARGIN_MAX: 0.3,
    VENDOR_STOCK_REFRESH_MULTIPLIER: 1.0,
    CRAFTING_QUALITY_BIAS: 0.0,
    CRAFTING_SUCCESS_RATE_MULTIPLIER: 1.0,
    CURRENCY_SINK_DAILY_CAP: 1000,
    CURRENCY_SOURCE_DAILY_CAP: 1000,
    ECONOMIC_ACTIVITY_MULTIPLIER: 1.0,
    TRADE_FREQUENCY_MULTIPLIER: 1.0,
    
    // World Simulation defaults
    WORLD_EVENT_RATE_MULTIPLIER: 1.0,
    WORLD_EVENT_SEVERITY_MULTIPLIER: 1.0,
    WEATHER_VOLATILITY_MULTIPLIER: 1.0,
    WEATHER_FRONT_FREQUENCY_MULTIPLIER: 1.0,
    REGION_DRIFT_STEP_CAP: 3,
    REGION_DRIFT_FREQUENCY_MULTIPLIER: 1.0,
    WORLD_STATE_PERSISTENCE_MULTIPLIER: 1.0,
    WORLD_STATE_DECAY_MULTIPLIER: 1.0,
    
    // Dialogue & Romance defaults
    DIALOGUE_CANDIDATE_CAP: 5,
    DIALOGUE_CANDIDATE_SCORE_THRESHOLD: 0.3,
    DIALOGUE_COOLDOWN_MULTIPLIER: 1.0,
    ROMANCE_COOLDOWN_TURNS: 10,
    ROMANCE_PROGRESSION_MULTIPLIER: 1.0,
    ROMANCE_CONSENT_STRICTNESS: 'moderate',
    DIALOGUE_ENGAGEMENT_MULTIPLIER: 1.0,
    DIALOGUE_DEPTH_MULTIPLIER: 1.0,
    
    // Party Management defaults
    PARTY_MAX_ACTIVE_MEMBERS: 4,
    PARTY_DELEGATE_CHECK_RATE: 0.1,
    PARTY_INTENT_MIX_BIAS: {
      COOPERATIVE: 0.4,
      COMPETITIVE: 0.3,
      NEUTRAL: 0.3
    },
    PARTY_COHESION_MULTIPLIER: 1.0,
    PARTY_CONFLICT_MULTIPLIER: 1.0,
    PARTY_MEMBER_SATISFACTION_MULTIPLIER: 1.0,
    PARTY_MEMBER_LOYALTY_MULTIPLIER: 1.0,
    
    // Module Gates defaults
    DIALOGUE_GATE: 'full',
    WORLDSIM_GATE: 'full',
    PARTY_GATE: 'full',
    MODS_GATE: 'full',
    TOOLS_GATE: 'full',
    ECONOMY_KERNEL_GATE: 'full'
  };
}

// Config diff utility
export function diffLiveOpsConfigs(oldConfig: LiveOpsConfig, newConfig: LiveOpsConfig): Record<string, { old: any; new: any }> {
  const diffs: Record<string, { old: any; new: any }> = {};
  
  const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
  
  for (const key of allKeys) {
    const oldValue = (oldConfig as any)[key];
    const newValue = (newConfig as any)[key];
    
    if (oldValue !== newValue) {
      diffs[key] = { old: oldValue, new: newValue };
    }
  }
  
  return diffs;
}

// Config merge utility (for scope precedence)
export function mergeLiveOpsConfigs(...configs: Partial<LiveOpsConfig>[]): LiveOpsConfig {
  const merged = configs.reduce((acc, config) => ({ ...acc, ...config }), {});
  return LiveOpsConfigSchema.parse(merged);
}
