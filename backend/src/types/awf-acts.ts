/**
 * AWF Act Types
 * Phase 4: Act Interpreter - Type definitions for act application
 */

// AWF Response Structure
export interface AwfResponse {
  scn: string;
  txt: string;
  choices?: any[];
  acts?: AwfAct[];
  val?: string | null;
}

// Individual Act Types
export interface AwfAct {
  type: string;
  data: Record<string, unknown>;
}

// Act Application Summary
export interface ActApplicationSummary {
  relChanges: Array<{ npc: string; delta: number; newVal: number }>;
  objectives: Array<{ id: string; prev?: string; next: string }>;
  flags: string[];
  resources: Array<{ key: string; delta: number; newVal: number }>;
  scene?: string;
  time?: { 
    prev: { band: string; ticks: number }; 
    next: { band: string; ticks: number }; 
    added: number 
  };
  memory: { added: number; pinned: number; trimmed: number };
  violations: string[];
}

// Act Mode Configuration
export interface ActModeConfig {
  pointer: string;
  mode: string;
}

// Time Band Configuration
export interface TimeBand {
  name: string;
  maxTicks: number;
  next?: string; // Next band name
}

// World Time Configuration
export interface WorldTimeConfig {
  bands: TimeBand[];
  defaultBand: string;
}

// Game State Types
export interface GameState {
  hot: Record<string, unknown>;
  warm: {
    episodic: EpisodicMemory[];
    pins: string[];
  };
  cold: Record<string, unknown>;
  [key: string]: unknown; // Allow for dynamic properties
}

// Episodic Memory Entry
export interface EpisodicMemory {
  k: string; // Key
  note: string;
  salience: number;
  tags?: string[];
  t: number; // Turn ID
}

// Objective Status
export type ObjectiveStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';

// Objective Entry
export interface ObjectiveEntry {
  id: string;
  status: ObjectiveStatus;
  progress?: number;
}

// Relation Entry
export interface RelationEntry {
  [npc: string]: number;
}

// Resource Entry
export interface ResourceEntry {
  [key: string]: number;
}

// Flag Entry
export interface FlagEntry {
  [key: string]: string;
}

// Time Entry
export interface TimeEntry {
  band: string;
  ticks: number;
}

// Act Application Parameters
export interface ApplyActsParams {
  sessionId: string;
  awf: AwfResponse;
}

// Act Application Result
export interface ApplyActsResult {
  newState: GameState;
  summary: ActApplicationSummary;
}

// Act Mode Types
export type ActMode = 
  | 'merge_delta_by_npc'
  | 'upsert_by_id'
  | 'set_by_key'
  | 'merge_delta_by_key'
  | 'set_value'
  | 'add_number'
  | 'append_unique_by_key'
  | 'add_unique'
  | 'tag_by_key'
  | 'remove_by_key';

// Act Type Constants
export const ACT_TYPES = {
  REL_CHANGE: 'REL_CHANGE',
  OBJECTIVE_UPDATE: 'OBJECTIVE_UPDATE',
  FLAG_SET: 'FLAG_SET',
  RESOURCE_CHANGE: 'RESOURCE_CHANGE',
  SCENE_SET: 'SCENE_SET',
  TIME_ADVANCE: 'TIME_ADVANCE',
  MEMORY_ADD: 'MEMORY_ADD',
  PIN_ADD: 'PIN_ADD',
  MEMORY_TAG: 'MEMORY_TAG',
  MEMORY_REMOVE: 'MEMORY_REMOVE',
} as const;

export type ActType = typeof ACT_TYPES[keyof typeof ACT_TYPES];
