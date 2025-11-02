/**
 * Phase 5: Frontend API types aligned with backend
 * Mirrors types from shared/src/types/api.ts
 */

import type { ApiErrorCode } from '@shared/types/api';

// Create Game Response (V3)
export interface CreateGameResponse {
  ok: true;
  data: {
    game_id: string;
    first_turn: {
      turn_number: number;
      role: string;
      content: string;
      meta: TurnMeta;
      created_at: string;
    };
  };
  meta: {
    traceId: string;
  };
}

// Turns List Response (Paginated)
export interface TurnsListResponse {
  ok: true;
  data: {
    turns: Turn[];
    next?: {
      afterTurn: number;
    };
  };
  meta: {
    traceId: string;
  };
}

// Turn metadata from V2 assembler
export interface TurnMeta {
  included: string[]; // Format: "scope:slug@version"
  dropped: string[]; // Same format
  policy?: string[]; // Policy actions: "SCENARIO_POLICY_UNDECIDED", "SCENARIO_DROPPED", "NPC_DROPPED"
  model: string;
  worldId: string;
  rulesetSlug: string;
  scenarioSlug?: string | null;
  entryStartSlug: string;
  tokenEst: {
    input: number;
    budget: number;
    pct: number; // 0-1
  };
  pieces?: Array<{
    scope: string;
    slug: string;
    version?: string;
    tokens: number;
  }>;
}

// Turn data structure
export interface Turn {
  id: string;
  game_id: string;
  turn_number: number;
  role: 'narrator' | 'user' | 'system';
  content?: string;
  meta?: TurnMeta | null;
  created_at: string;
}

// Error Envelope
export interface ErrorEnvelope {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown; // Field errors for VALIDATION_FAILED
  };
  meta: {
    traceId: string;
  };
}

// Create Game Request
export interface CreateGameRequest {
  entry_point_id: string;
  world_id: string;
  entry_start_slug: string;
  scenario_slug?: string | null;
  ruleset_slug?: string;
  model?: string;
  characterId?: string;
}

