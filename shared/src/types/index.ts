import { z } from 'zod';

// Character Schema
export const CharacterSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  race: z.string(),
  class: z.string(),
  level: z.number().int().min(1).max(20),
  experience: z.number().int().min(0),
  attributes: z.object({
    strength: z.number().int().min(1).max(20),
    dexterity: z.number().int().min(1).max(20),
    constitution: z.number().int().min(1).max(20),
    intelligence: z.number().int().min(1).max(20),
    wisdom: z.number().int().min(1).max(20),
    charisma: z.number().int().min(1).max(20),
  }),
  skills: z.array(z.string()),
  inventory: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    quantity: z.number().int().min(1),
  })),
  currentHealth: z.number().int().min(0),
  maxHealth: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Character = z.infer<typeof CharacterSchema>;

// Game Save Schema
export const GameSaveSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  characterId: z.string().uuid(),
  worldTemplateId: z.string().uuid(),
  name: z.string().min(1).max(100),
  storyState: z.object({
    currentScene: z.string(),
    history: z.array(z.object({
      role: z.enum(['player', 'narrator', 'npc']),
      content: z.string(),
      timestamp: z.string().datetime(),
      emotion: z.string().optional(),
    })),
    npcs: z.array(z.object({
      id: z.string(),
      name: z.string(),
      personality: z.string(),
      relationship: z.number().min(-100).max(100),
      lastInteraction: z.string().datetime().optional(),
    })),
    worldState: z.record(z.string(), z.any()),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastPlayedAt: z.string().datetime(),
});

export type GameSave = z.infer<typeof GameSaveSchema>;

// World Template Schema
export const WorldTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string(),
  genre: z.enum(['fantasy', 'scifi', 'horror', 'mystery', 'historical', 'modern', 'custom']),
  setting: z.string(),
  themes: z.array(z.string()),
  availableRaces: z.array(z.string()),
  availableClasses: z.array(z.string()),
  startingPrompt: z.string(),
  rules: z.object({
    allowMagic: z.boolean(),
    allowTechnology: z.boolean(),
    difficultyLevel: z.enum(['easy', 'medium', 'hard', 'deadly']),
    combatSystem: z.enum(['d20', 'narrative', 'custom']),
  }),
  isPublic: z.boolean(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorldTemplate = z.infer<typeof WorldTemplateSchema>;

// NPC Schema
export const NPCSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  personality: z.object({
    traits: z.array(z.string()),
    goals: z.array(z.string()),
    fears: z.array(z.string()),
    mood: z.enum(['friendly', 'neutral', 'hostile', 'suspicious', 'helpful']),
  }),
  relationship: z.number().min(-100).max(100),
  knowledge: z.array(z.string()),
  abilities: z.array(z.string()),
});

export type NPC = z.infer<typeof NPCSchema>;

// Dice Roll Schema
export const DiceRollSchema = z.object({
  type: z.enum(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']),
  count: z.number().int().min(1).max(20),
  modifier: z.number().int(),
  advantage: z.boolean().optional(),
  disadvantage: z.boolean().optional(),
});

export type DiceRoll = z.infer<typeof DiceRollSchema>;

// Dice Roll Result Schema
export const DiceRollResultSchema = z.object({
  rolls: z.array(z.number()),
  total: z.number(),
  modifier: z.number(),
  finalResult: z.number(),
  criticalSuccess: z.boolean(),
  criticalFailure: z.boolean(),
});

export type DiceRollResult = z.infer<typeof DiceRollResultSchema>;

// Story Action Schema
export const StoryActionSchema = z.object({
  type: z.enum(['dialogue', 'action', 'skill_check', 'combat', 'exploration']),
  content: z.string(),
  skillCheck: z.object({
    skill: z.string(),
    difficulty: z.number().int().min(1).max(30),
  }).optional(),
  targetNpcId: z.string().uuid().optional(),
});

export type StoryAction = z.infer<typeof StoryActionSchema>;

// AI Response Schema
export const AIResponseSchema = z.object({
  narrative: z.string(),
  emotion: z.enum(['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'excited']),
  npcResponses: z.array(z.object({
    npcId: z.string(),
    response: z.string(),
    emotion: z.string(),
  })).optional(),
  worldStateChanges: z.record(z.string(), z.any()).optional(),
  suggestedActions: z.array(z.string()).optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;
