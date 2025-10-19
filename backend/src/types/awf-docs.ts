/**
 * TypeScript types for AWF (Adventure World Format) bundle documents
 * Phase 1: Data Model - Core document types
 */

import { WorldDocFlex } from './awf-world.js';

// Core Contract Document
export interface CoreContractDoc {
  contract: {
    version: string;
    name: string;
    description: string;
  };
  acts: {
    allowed: string[];
  };
  memory?: {
    exemplars?: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}

// World Document
export interface WorldDoc {
  id: string;
  name: string;
  version: string;
  hash: string;
  timeworld?: {
    timezone: string;
    calendar: string;
    seasons?: string[];
  };
  time?: {
    bands: Array<{
      name: string;
      maxTicks: number;
      next?: string;
    }>;
    defaultBand: string;
  };
  slices?: Array<{
    id: string;
    name: string;
    description: string;
    type: 'location' | 'character' | 'item' | 'event';
    metadata?: Record<string, unknown>;
  }>;
}

// Adventure Document - Flexible interface
export interface AdventureDoc {
  id: string;
  world_ref: string;
  version?: string;
  hash?: string;
  locations?: Array<{
    id: string;
    name: string;
    description?: string;
    connections?: string[];
    metadata?: Record<string, unknown>;
    [k: string]: unknown; // Allow additional fields
  }>;
  objectives?: Array<{
    id: string;
    title?: string;
    description?: string;
    type?: string; // Allow any type string
    status?: string; // Allow any status string
    metadata?: Record<string, unknown>;
    [k: string]: unknown; // Allow additional fields
  }>;
  npcs?: Array<{
    id: string;
    name: string;
    description?: string;
    role?: string;
    location?: string;
    metadata?: Record<string, unknown>;
    [k: string]: unknown; // Allow additional fields
  }>;
  slices?: Array<{
    id: string;
    name?: string;
    description?: string;
    type?: string; // Allow any type string
    metadata?: Record<string, unknown>;
    [k: string]: unknown; // Allow additional fields
  }>;
  [k: string]: unknown; // Allow additional top-level fields
}

// Adventure Start Document - Flexible interface
export interface AdventureStartDoc {
  start: {
    scene: string;
    description?: string;
    initial_state?: Record<string, unknown>;
    [k: string]: unknown; // Allow additional fields
  };
  rules?: {
    no_time_advance?: boolean;
    [key: string]: unknown;
  };
  [k: string]: unknown; // Allow additional top-level fields
}

// Injection Map Document
export interface InjectionMapDoc {
  build: {
    [key: string]: string; // JSON Pointer strings for build process
  };
  acts: {
    [key: string]: string; // JSON Pointer strings for act application
  };
}

// Database Record Types
export interface CoreContractRecord {
  id: string;
  version: string;
  doc: CoreContractDoc;
  hash: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorldRecord {
  id: string;
  version: string;
  doc: WorldDocFlex;
  hash: string;
  created_at: string;
  updated_at: string;
}

export interface AdventureRecord {
  id: string;
  world_ref: string;
  version: string;
  doc: AdventureDoc;
  hash: string;
  created_at: string;
  updated_at: string;
}

export interface AdventureStartRecord {
  adventure_ref: string;
  doc: AdventureStartDoc;
  use_once: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  session_id: string;
  player_id: string;
  world_ref: string;
  adventure_ref: string;
  turn_id: number;
  is_first_turn: boolean;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface GameStateRecord {
  session_id: string;
  hot: Record<string, unknown>;
  warm: {
    episodic: unknown[];
    pins: unknown[];
  };
  cold: Record<string, unknown>;
  updated_at: string;
}

export interface InjectionMapRecord {
  id: string;
  doc: InjectionMapDoc;
  created_at: string;
  updated_at: string;
}
