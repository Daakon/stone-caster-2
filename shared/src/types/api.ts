import { z } from 'zod';

// Phase 5: Standardized ErrorCode enum - single source of truth for all error codes
// Use this enum in route handlers to avoid string drift
export enum ApiErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  IDEMPOTENCY_REQUIRED = 'IDEMPOTENCY_REQUIRED',
  INSUFFICIENT_STONES = 'INSUFFICIENT_STONES',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  INVALID_PACK = 'INVALID_PACK',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  COOKIE_CAP = 'COOKIE_CAP',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  FLAG_NOT_FOUND = 'FLAG_NOT_FOUND',
  PROMPT_NOT_FOUND = 'PROMPT_NOT_FOUND',
  PROMPT_VERSION_CONFLICT = 'PROMPT_VERSION_CONFLICT',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  REQUIRES_AUTH = 'REQUIRES_AUTH',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  PROMPT_TEMPLATE_MISSING = 'PROMPT_TEMPLATE_MISSING',
  LEGACY_ROUTE_RETIRED = 'LEGACY_ROUTE_RETIRED',
  // Game spawn error codes (Phase 3.1)
  ENTRY_START_NOT_FOUND = 'ENTRY_START_NOT_FOUND',
  SCENARIO_NOT_FOUND = 'SCENARIO_NOT_FOUND',
  RULESET_NOT_FOUND = 'RULESET_NOT_FOUND',
  WORLD_NOT_FOUND = 'WORLD_NOT_FOUND',
  WORLD_MISMATCH = 'WORLD_MISMATCH',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  DB_CONFLICT = 'DB_CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  // Prompt builder errors
  AWF_SESSION_MISSING = 'AWF_SESSION_MISSING',
  ASSEMBLY_FAILED = 'ASSEMBLY_FAILED',
}

// Re-export as ErrorCode for convenience
export { ApiErrorCode as ErrorCode };

// Response envelope schemas
export const ApiResponseMetaSchema = z.object({
  traceId: z.string().uuid(),
  version: z.string().optional(),
});

export const ApiSuccessResponseSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
  meta: ApiResponseMetaSchema,
});

export const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.nativeEnum(ApiErrorCode),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z.object({
    traceId: z.string().uuid(),
  }),
});

export const ApiResponseSchema = z.union([
  ApiSuccessResponseSchema,
  ApiErrorResponseSchema,
]);

// Request validation schemas
export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Game turns query schema for pagination
export const GetTurnsQuerySchema = z.object({
  afterTurn: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Character request schemas
export const CreateCharacterLegacyRequestSchema = z.object({
  name: z.string().min(1).max(50),
  race: z.string().min(1),
  class: z.string().min(1),
  level: z.number().int().min(1).max(20).default(1),
  experience: z.number().int().min(0).default(0),
  attributes: z.object({
    strength: z.number().int().min(1).max(20),
    dexterity: z.number().int().min(1).max(20),
    constitution: z.number().int().min(1).max(20),
    intelligence: z.number().int().min(1).max(20),
    wisdom: z.number().int().min(1).max(20),
    charisma: z.number().int().min(1).max(20),
  }),
  skills: z.array(z.string()).default([]),
  inventory: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    quantity: z.number().int().min(1),
  })).default([]),
  currentHealth: z.number().int().min(0).optional(),
  maxHealth: z.number().int().min(1).optional(),
  worldSlug: z.string().min(1).max(100), // Required world validation
});

export const UpdateCharacterRequestSchema = CreateCharacterLegacyRequestSchema.partial();

// Premade character query schema
export const PremadeCharacterQuerySchema = z.object({
  world: z.string().min(1).max(100),
});

// Standardized error codes for game creation
export const GameSpawnErrorCode = {
  ENTRY_START_NOT_FOUND: 'ENTRY_START_NOT_FOUND',
  SCENARIO_NOT_FOUND: 'SCENARIO_NOT_FOUND',
  RULESET_NOT_FOUND: 'RULESET_NOT_FOUND',
  WORLD_NOT_FOUND: 'WORLD_NOT_FOUND',
  WORLD_MISMATCH: 'WORLD_MISMATCH',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  DB_CONFLICT: 'DB_CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const;

export type GameSpawnErrorCode = typeof GameSpawnErrorCode[keyof typeof GameSpawnErrorCode];

// Game request schemas with improved validation
export const CreateGameRequestSchema = z.object({
  entry_point_id: z.string().trim().min(1, 'entry_point_id is required'),
  world_id: z.string().uuid('world_id must be a valid UUID'),
  entry_start_slug: z.string().trim().min(1, 'entry_start_slug is required'),
  scenario_slug: z.string().trim().min(1).nullable().optional(),
  ruleset_slug: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  characterId: z.string().uuid('characterId must be a valid UUID').optional(),
  idempotency_key: z.string().trim().min(1).optional(), // Optional idempotency key in body
  // Legacy support - allow adventureSlug for backward compatibility
  adventureSlug: z.string().trim().min(1).max(100).optional(),
});

// Legacy schema - kept for backward compatibility during migration
export const GameTurnRequestSchema = z.object({
  optionId: z.string().uuid(),
  userInput: z.string().optional(),
  userInputType: z.enum(['choice', 'text', 'action']).optional(),
});

// New TurnPostBody schema - frontend sends choice text directly
export const TurnPostBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('choice'),
    text: z.string().trim().min(1, 'Choice text is required').max(400, 'Choice text must be 400 characters or less'),
  }),
  z.object({
    kind: z.literal('text'),
    text: z.string().trim().min(1, 'Text input is required').max(400, 'Text input must be 400 characters or less'),
  }),
]);

export type TurnPostBody = z.infer<typeof TurnPostBodySchema>;

// Phase 8: Simple send-turn schema for playable loop
export const SendTurnRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
  model: z.string().trim().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

// Stones request schemas
export const ConvertStonesRequestSchema = z.object({
  type: z.enum(['shard', 'crystal', 'relic']),
  amount: z.number().int().min(1),
});

export const PurchaseStonesRequestSchema = z.object({
  packId: z.string().uuid(),
});

// Subscription request schemas
export const CreateSubscriptionRequestSchema = z.object({
  priceId: z.string(),
  paymentMethodId: z.string(),
});

export const CancelSubscriptionRequestSchema = z.object({
  subscriptionId: z.string().uuid(),
});

export type GetTurnsQuery = z.infer<typeof GetTurnsQuerySchema>;

// Telemetry request schemas (moved to types/index.ts for Layer 0.9)

// Turn validation schemas
export const TurnResponseSchema = z.object({
  narrative: z.string().min(1),
  emotion: z.enum(['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'excited']),
  choices: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().min(1),
    description: z.string().optional(),
  })),
  npcResponses: z.array(z.object({
    npcId: z.string(),
    response: z.string(),
    emotion: z.string(),
  })).optional(),
  worldStateChanges: z.record(z.string(), z.unknown()).optional(),
  relationshipDeltas: z.record(z.string(), z.number()).optional(),
  factionDeltas: z.record(z.string(), z.number()).optional(),
  // Debug information
  debug: z.object({
    promptState: z.record(z.string(), z.unknown()).optional(),
    promptText: z.string().optional(),
    aiResponseRaw: z.string().optional(),
    processingTime: z.number().optional(),
    tokenCount: z.number().optional(),
  }).optional(),
});

export const TurnResultSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid(),
  option_id: z.string().uuid(),
  ai_response: TurnResponseSchema,
  created_at: z.string().datetime(),
});

// Enhanced turn recording schemas
export const SessionTurnSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  sequence: z.number().int().min(1),
  user_prompt: z.string().nullable(),
  narrative_summary: z.string(),
  is_initialization: z.boolean(),
  created_at: z.string().datetime(),
  turn_number: z.number().int().min(1),
});

export const TurnAnalyticsSchema = z.object({
  id: z.string().uuid(),
  turn_id: z.string().uuid(),
  raw_ai_response: z.record(z.string(), z.unknown()),
  raw_user_prompt: z.string().nullable(),
  raw_system_prompt: z.string().nullable(),
  model_identifier: z.string().nullable(),
  token_count: z.number().int().nullable(),
  processing_time_ms: z.number().int().nullable(),
  prompt_metadata: z.record(z.string(), z.unknown()).nullable(),
  response_metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime(),
});

export const SessionTurnsResponseSchema = z.object({
  turns: z.array(SessionTurnSchema),
  initialize_narrative: z.string().nullable(),
});

// Admin request schemas
export const UpdateConfigRequestSchema = z.object({
  value: z.unknown(),
});

export const UpdateFlagRequestSchema = z.object({
  enabled: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const CreatePromptRequestSchema = z.object({
  slug: z.string().min(1).max(100),
  scope: z.enum(['world', 'scenario', 'adventure', 'quest']),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional().default(false),
});

export const UpdatePromptRequestSchema = z.object({
  content: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

export const PromptFiltersSchema = z.object({
  scope: z.enum(['world', 'scenario', 'adventure', 'quest']).optional(),
  slug: z.string().optional(),
  active: z.boolean().optional(),
});

// Profile request schemas
export const RevokeSessionsRequestSchema = z.object({
  csrfToken: z.string().min(1),
});

// Type exports
export type ApiResponseMeta = z.infer<typeof ApiResponseMetaSchema>;
export type ApiSuccessResponse<T = unknown> = {
  ok: true;
  data: T;
  meta: ApiResponseMeta;
};
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export type IdParam = z.infer<typeof IdParamSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type CreateCharacterLegacyRequest = z.infer<typeof CreateCharacterLegacyRequestSchema>;
export type UpdateCharacterRequest = z.infer<typeof UpdateCharacterRequestSchema>;
export type PremadeCharacterQuery = z.infer<typeof PremadeCharacterQuerySchema>;
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;
export type GameTurnRequest = z.infer<typeof GameTurnRequestSchema>;
export type ConvertStonesRequest = z.infer<typeof ConvertStonesRequestSchema>;
export type PurchaseStonesRequest = z.infer<typeof PurchaseStonesRequestSchema>;
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>;
export type CancelSubscriptionRequest = z.infer<typeof CancelSubscriptionRequestSchema>;
export type RevokeSessionsRequest = z.infer<typeof RevokeSessionsRequestSchema>;
// TelemetryEvent type moved to types/index.ts for Layer 0.9
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
export type SessionTurn = z.infer<typeof SessionTurnSchema>;
export type TurnAnalytics = z.infer<typeof TurnAnalyticsSchema>;
export type SessionTurnsResponse = z.infer<typeof SessionTurnsResponseSchema>;
