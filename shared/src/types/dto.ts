import { z } from 'zod';

// Character DTO (redacted from internal state) - supports both generic and legacy formats
export const CharacterDTOSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  worldSlug: z.string(), // Include world slug in DTO
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Generic world-specific data
  worldData: z.record(z.unknown()).default({}),
  // Legacy fields for backward compatibility
  race: z.string(),
  class: z.string(),
  level: z.number().int(),
  experience: z.number().int(),
  attributes: z.object({
    strength: z.number().int(),
    dexterity: z.number().int(),
    constitution: z.number().int(),
    intelligence: z.number().int(),
    wisdom: z.number().int(),
    charisma: z.number().int(),
  }),
  skills: z.array(z.string()),
  inventory: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    quantity: z.number().int(),
  })),
  currentHealth: z.number().int(),
  maxHealth: z.number().int(),
});

// Game DTO (redacted from internal state) - Layer M2
export const GameDTOSchema = z.object({
  id: z.string().uuid(),
  adventureId: z.string().uuid(),
  adventureTitle: z.string(),
  adventureDescription: z.string().optional(),
  characterId: z.string().uuid().optional(),
  characterName: z.string().optional(),
  worldSlug: z.string(),
  worldName: z.string(),
  turnCount: z.number().int().min(0),
  status: z.enum(['active', 'completed', 'paused', 'abandoned']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastPlayedAt: z.string().datetime(),
});

// Game List DTO (minimal metadata for listing)
export const GameListDTOSchema = z.object({
  id: z.string().uuid(),
  adventureTitle: z.string(),
  characterName: z.string().optional(),
  worldName: z.string(),
  turnCount: z.number().int().min(0),
  status: z.enum(['active', 'completed', 'paused', 'abandoned']),
  lastPlayedAt: z.string().datetime(),
});

// World DTO (redacted from internal state)
export const WorldDTOSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  genre: z.enum(['fantasy', 'scifi', 'horror', 'mystery', 'historical', 'modern', 'custom']),
  setting: z.string(),
  themes: z.array(z.string()),
  availableRaces: z.array(z.string()),
  availableClasses: z.array(z.string()),
  rules: z.object({
    allowMagic: z.boolean(),
    allowTechnology: z.boolean(),
    difficultyLevel: z.enum(['easy', 'medium', 'hard', 'deadly']),
    combatSystem: z.enum(['d20', 'narrative', 'custom']),
  }),
  isPublic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Adventure DTO (redacted from internal state) - Layer M2
export const AdventureDTOSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().optional(),
  worldSlug: z.string(),
  worldName: z.string(),
  tags: z.array(z.string()),
  scenarios: z.array(z.string()),
});

// User/Me DTO
export const UserDTOSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  isGuest: z.boolean(),
  castingStones: z.object({
    shard: z.number().int().min(0),
    crystal: z.number().int().min(0),
    relic: z.number().int().min(0),
  }),
  subscription: z.object({
    status: z.enum(['active', 'canceled', 'past_due', 'unpaid', 'trialing']).optional(),
    currentPeriodEnd: z.string().datetime().optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Stones wallet DTO
export const StonesWalletDTOSchema = z.object({
  shard: z.number().int().min(0),
  crystal: z.number().int().min(0),
  relic: z.number().int().min(0),
  dailyRegen: z.number().int().min(0),
  lastRegenAt: z.string().datetime().optional(),
});

// Stones pack DTO
export const StonesPackDTOSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  price: z.number().int().min(0),
  currency: z.string(),
  stones: z.object({
    shard: z.number().int().min(0),
    crystal: z.number().int().min(0),
    relic: z.number().int().min(0),
  }),
  bonus: z.object({
    shard: z.number().int().min(0).optional(),
    crystal: z.number().int().min(0).optional(),
    relic: z.number().int().min(0).optional(),
  }).optional(),
  isActive: z.boolean(),
});

// Subscription DTO
export const SubscriptionDTOSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'canceled', 'past_due', 'unpaid', 'trialing']),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Search result DTO
export const SearchResultDTOSchema = z.object({
  type: z.enum(['character', 'game', 'world', 'adventure']),
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  relevance: z.number().min(0).max(1),
});

// Profile DTO (redacted from internal state)
export const ProfileDTOSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  avatarUrl: z.string().url().optional(),
  email: z.string().email().optional(), // Only if policy allows
  preferences: z.object({
    showTips: z.boolean().default(true),
    theme: z.enum(['light', 'dark', 'auto']).default('auto'),
    notifications: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(false),
    }).default({}),
  }).default({}),
  createdAt: z.string().datetime(),
  lastSeen: z.string().datetime(),
  // Explicitly exclude internal fields:
  // - providerId (internal)
  // - accessTokens (internal)
  // - internalFlags (internal)
  // - audit fields not needed by UI
});

// Turn DTO (redacted from internal state) - Layer M3
export const TurnDTOSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  turnCount: z.number().int().min(0),
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
  relationshipDeltas: z.record(z.string(), z.number()).optional(),
  factionDeltas: z.record(z.string(), z.number()).optional(),
  castingStonesBalance: z.number().int().min(0),
  createdAt: z.string().datetime(),
  // Explicitly exclude internal fields:
  // - state_snapshot (internal)
  // - prompt_text (internal)
  // - ai_response (internal)
  // - option_id (internal)
});

// Content World DTO (Layer M0) - curated list of worlds with only UI-needed fields
export const ContentWorldDTOSchema = z.object({
  title: z.string(),
  slug: z.string(),
  tags: z.array(z.string()),
  scenarios: z.array(z.string()),
  displayRules: z.object({
    allowMagic: z.boolean(),
    allowTechnology: z.boolean(),
    difficultyLevel: z.enum(['easy', 'medium', 'hard', 'deadly']),
    combatSystem: z.enum(['d20', 'narrative', 'custom']),
  }),
});

// Type exports
export type CharacterDTO = z.infer<typeof CharacterDTOSchema>;
export type GameDTO = z.infer<typeof GameDTOSchema>;
export type GameListDTO = z.infer<typeof GameListDTOSchema>;
export type WorldDTO = z.infer<typeof WorldDTOSchema>;
export type AdventureDTO = z.infer<typeof AdventureDTOSchema>;
export type UserDTO = z.infer<typeof UserDTOSchema>;
export type ProfileDTO = z.infer<typeof ProfileDTOSchema>;
export type StonesWalletDTO = z.infer<typeof StonesWalletDTOSchema>;
export type StonesPackDTO = z.infer<typeof StonesPackDTOSchema>;
export type SubscriptionDTO = z.infer<typeof SubscriptionDTOSchema>;
export type SearchResultDTO = z.infer<typeof SearchResultDTOSchema>;
export type TurnDTO = z.infer<typeof TurnDTOSchema>;
export type ContentWorldDTO = z.infer<typeof ContentWorldDTOSchema>;
