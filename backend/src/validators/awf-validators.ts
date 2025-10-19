/**
 * Zod validators for AWF (Adventure World Format) bundle documents
 * Phase 1: Data Model - Document validation schemas
 */

import { z } from 'zod';
import { WorldDocFlexSchema } from './awf-world.schema.js';

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

// World Document Validator - now uses flexible schema
export const WorldDocSchema = WorldDocFlexSchema;

// Adventure Document Validator - Flexible schema
export const AdventureDocSchema = z.object({
  id: z.string().min(1),
  world_ref: z.string().min(1),
  version: z.string().optional(),
  hash: z.string().optional(),
  locations: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    connections: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).passthrough()).optional(),
  objectives: z.array(z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(), // Allow any type string
    status: z.string().optional(), // Allow any status string
    metadata: z.record(z.unknown()).optional(),
  }).passthrough()).optional(),
  npcs: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    role: z.string().optional(),
    location: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).passthrough()).optional(),
  slices: z.array(z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(), // Allow any type string
    metadata: z.record(z.unknown()).optional(),
  }).passthrough()).optional(),
}).passthrough(); // Allow additional top-level fields

// Adventure Start Document Validator - Flexible schema
export const AdventureStartDocSchema = z.object({
  start: z.object({
    scene: z.string().min(1),
    description: z.string().optional(),
    initial_state: z.record(z.unknown()).optional(),
  }).passthrough(),
  rules: z.object({
    no_time_advance: z.boolean().optional(),
  }).passthrough().optional(), // Make rules optional and allow additional rules
}).passthrough(); // Allow additional top-level fields

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


