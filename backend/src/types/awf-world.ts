/**
 * Flexible World Schema Types
 * Open, extensible interfaces for world documents
 */

// Flexible World Document
export interface WorldDocFlex {
  /** required identity */
  id: string;
  name: string;
  version: string;

  /** optional, if author wants a classic bucket */
  timeworld?: {
    timezone?: string;
    calendar?: string;
    seasons?: string[];
    bands?: { id: string; label?: string; ticks?: number }[];
    weather_states?: string[];
    weather_transition_bias?: Record<string, number>;
    [k: string]: unknown; // allow extras inside timeworld
  };

  /** optional, common sections (authors may add/remove freely) */
  magic?: { domains?: string[]; rules?: string[]; [k: string]: unknown };
  essence_behavior?: Record<string, unknown>;
  species_rules?: Record<string, unknown>;
  identity_language?: { linguistic_subs?: Record<string,string>; [k: string]: unknown };
  lexicon?: { substitutions?: Record<string,string>; avoid?: string[]; [k: string]: unknown };
  factions_world?: unknown[];
  trade_and_geography?: Record<string, unknown>;
  lore_index?: { entries?: unknown[]; [k: string]: unknown };
  tone?: { style?: string[]; taboos?: string[]; [k: string]: unknown };
  locations?: { id: string; name: string; [k: string]: unknown }[];
  bands?: { id: string; label?: string; ticks?: number }[];
  weather_states?: string[];
  weather_transition_bias?: Record<string, number>;

  /** optional narrative chunks (may be empty) */
  slices?: { id: string; kind: string; text: string; tags?: string[]; [k: string]: unknown }[];

  /** allow any additional top-level domains */
  [k: string]: unknown;
}

// Database record type
export interface WorldRecordFlex {
  id: string;
  version: string;
  doc: WorldDocFlex;
  hash: string;
  created_at: string;
  updated_at: string;
}
