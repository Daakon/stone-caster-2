import { z } from 'zod';

// Error codes enum
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
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

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

// Character request schemas
export const CreateCharacterRequestSchema = z.object({
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
});

export const UpdateCharacterRequestSchema = CreateCharacterRequestSchema.partial();

// Game request schemas
export const CreateGameRequestSchema = z.object({
  adventureId: z.string().uuid(),
  characterId: z.string().uuid().optional(),
});

export const GameTurnRequestSchema = z.object({
  optionId: z.string().uuid(),
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

// Telemetry request schemas
export const TelemetryEventSchema = z.object({
  event: z.string().min(1).max(50),
  properties: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

// Turn validation schemas
export const TurnResponseSchema = z.object({
  narrative: z.string().min(1),
  emotion: z.enum(['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'excited']),
  npcResponses: z.array(z.object({
    npcId: z.string(),
    response: z.string(),
    emotion: z.string(),
  })).optional(),
  worldStateChanges: z.record(z.string(), z.unknown()).optional(),
  suggestedActions: z.array(z.string()).optional(),
});

export const TurnResultSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid(),
  option_id: z.string().uuid(),
  ai_response: TurnResponseSchema,
  created_at: z.string().datetime(),
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
export type CreateCharacterRequest = z.infer<typeof CreateCharacterRequestSchema>;
export type UpdateCharacterRequest = z.infer<typeof UpdateCharacterRequestSchema>;
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;
export type GameTurnRequest = z.infer<typeof GameTurnRequestSchema>;
export type ConvertStonesRequest = z.infer<typeof ConvertStonesRequestSchema>;
export type PurchaseStonesRequest = z.infer<typeof PurchaseStonesRequestSchema>;
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>;
export type CancelSubscriptionRequest = z.infer<typeof CancelSubscriptionRequestSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
