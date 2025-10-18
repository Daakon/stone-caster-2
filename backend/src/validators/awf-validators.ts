/**
 * Zod validators for AWF (Adventure World Format) bundle documents
 * Phase 1: Data Model - Document validation schemas
 */

import { z } from 'zod';

// Core Contract Document Validator
export const CoreContractDocSchema = z.object({
  contract: z.object({
    version: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
  }),
  acts: z.object({
    allowed: z.array(z.string()).min(1),
  }),
  memory: z.object({
    exemplars: z.array(z.object({
      id: z.string().min(1),
      content: z.string().min(1),
      metadata: z.record(z.unknown()).optional(),
    })).optional(),
  }).optional(),
});

// World Document Validator
export const WorldDocSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  hash: z.string().min(1),
  timeworld: z.object({
    timezone: z.string().min(1),
    calendar: z.string().min(1),
    seasons: z.array(z.string()).optional(),
  }).optional(),
  slices: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    type: z.enum(['location', 'character', 'item', 'event']),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});

// Adventure Document Validator
export const AdventureDocSchema = z.object({
  id: z.string().min(1),
  world_ref: z.string().min(1),
  version: z.string().min(1),
  hash: z.string().min(1),
  locations: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    connections: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
  objectives: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    type: z.enum(['main', 'side', 'optional']),
    status: z.enum(['active', 'completed', 'failed']),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
  npcs: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    role: z.string().min(1),
    location: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
  slices: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    type: z.enum(['scene', 'encounter', 'puzzle', 'dialogue']),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});

// Adventure Start Document Validator
export const AdventureStartDocSchema = z.object({
  start: z.object({
    scene: z.string().min(1),
    description: z.string().min(1),
    initial_state: z.record(z.unknown()).optional(),
  }),
  rules: z.object({
    no_time_advance: z.boolean(),
  }).and(z.record(z.unknown())), // Allow additional rules
});

// Injection Map Document Validator
export const InjectionMapDocSchema = z.object({
  build: z.record(z.string()), // JSON Pointer strings
  acts: z.record(z.string()), // JSON Pointer strings
});

// Database Record Validators
export const CoreContractRecordSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  doc: CoreContractDocSchema,
  hash: z.string().min(1),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const WorldRecordSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  doc: WorldDocSchema,
  hash: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const AdventureRecordSchema = z.object({
  id: z.string().min(1),
  world_ref: z.string().min(1),
  version: z.string().min(1),
  doc: AdventureDocSchema,
  hash: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const AdventureStartRecordSchema = z.object({
  adventure_ref: z.string().min(1),
  doc: AdventureStartDocSchema,
  use_once: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SessionRecordSchema = z.object({
  session_id: z.string().uuid(),
  player_id: z.string().min(1),
  world_ref: z.string().min(1),
  adventure_ref: z.string().min(1),
  turn_id: z.number().int().min(1),
  is_first_turn: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const GameStateRecordSchema = z.object({
  session_id: z.string().uuid(),
  hot: z.record(z.unknown()),
  warm: z.object({
    episodic: z.array(z.unknown()),
    pins: z.array(z.unknown()),
  }),
  cold: z.record(z.unknown()),
  updated_at: z.string().datetime(),
});

export const InjectionMapRecordSchema = z.object({
  id: z.string().min(1),
  doc: InjectionMapDocSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Type exports
export type CoreContractDoc = z.infer<typeof CoreContractDocSchema>;
export type WorldDoc = z.infer<typeof WorldDocSchema>;
export type AdventureDoc = z.infer<typeof AdventureDocSchema>;
export type AdventureStartDoc = z.infer<typeof AdventureStartDocSchema>;
export type InjectionMapDoc = z.infer<typeof InjectionMapDocSchema>;

export type CoreContractRecord = z.infer<typeof CoreContractRecordSchema>;
export type WorldRecord = z.infer<typeof WorldRecordSchema>;
export type AdventureRecord = z.infer<typeof AdventureRecordSchema>;
export type AdventureStartRecord = z.infer<typeof AdventureStartRecordSchema>;
export type SessionRecord = z.infer<typeof SessionRecordSchema>;
export type GameStateRecord = z.infer<typeof GameStateRecordSchema>;
export type InjectionMapRecord = z.infer<typeof InjectionMapRecordSchema>;


