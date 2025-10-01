import { z } from 'zod';

// Character DTO (redacted from internal state)
export const CharacterDTOSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Game DTO (redacted from internal state)
export const GameDTOSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  adventureId: z.string().uuid(),
  name: z.string(),
  currentScene: z.string(),
  storyHistory: z.array(z.object({
    role: z.enum(['player', 'narrator', 'npc']),
    content: z.string(),
    timestamp: z.string().datetime(),
    emotion: z.string().optional(),
  })),
  availableOptions: z.array(z.object({
    id: z.string().uuid(),
    text: z.string(),
    type: z.enum(['dialogue', 'action', 'skill_check', 'combat', 'exploration']),
  })),
  npcs: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    relationship: z.number(),
    lastInteraction: z.string().datetime().optional(),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

// Adventure DTO (redacted from internal state)
export const AdventureDTOSchema = z.object({
  id: z.string().uuid(),
  worldId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  startingPrompt: z.string(),
  isPublic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

// Type exports
export type CharacterDTO = z.infer<typeof CharacterDTOSchema>;
export type GameDTO = z.infer<typeof GameDTOSchema>;
export type WorldDTO = z.infer<typeof WorldDTOSchema>;
export type AdventureDTO = z.infer<typeof AdventureDTOSchema>;
export type UserDTO = z.infer<typeof UserDTOSchema>;
export type StonesWalletDTO = z.infer<typeof StonesWalletDTOSchema>;
export type StonesPackDTO = z.infer<typeof StonesPackDTOSchema>;
export type SubscriptionDTO = z.infer<typeof SubscriptionDTOSchema>;
export type SearchResultDTO = z.infer<typeof SearchResultDTOSchema>;
