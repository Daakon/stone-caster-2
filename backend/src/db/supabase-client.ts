/**
 * Typed Supabase Client for Chimera
 * Provides a typed Supabase client factory for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import type { Request } from 'express';

/**
 * Database schema types for Chimera tables
 */
export interface Database {
  public: {
    Tables: {
      chimera_worlds: {
        Row: {
          id: string;
          key: string;
          definition: Record<string, unknown>;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          definition: Record<string, unknown>;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          definition?: Record<string, unknown>;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chimera_ruleset_templates: {
        Row: {
          id: string;
          key: string;
          ui_category: string;
          exclusion_group: string | null;
          dependencies: string[];
          definition: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          ui_category: string;
          exclusion_group?: string | null;
          dependencies?: string[];
          definition: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          ui_category?: string;
          exclusion_group?: string | null;
          dependencies?: string[];
          definition?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      chimera_entities: {
        Row: {
          id: string;
          kind: 'npc' | 'item' | 'location' | 'faction';
          key: string;
          raw_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: 'npc' | 'item' | 'location' | 'faction';
          key: string;
          raw_data: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: 'npc' | 'item' | 'location' | 'faction';
          key?: string;
          raw_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      chimera_lore: {
        Row: {
          id: string;
          fragment: Record<string, unknown>;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fragment: Record<string, unknown>;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fragment?: Record<string, unknown>;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      compiled_stories: {
        Row: {
          id: string;
          story_key: string;
          compiled: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          story_key: string;
          compiled: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          story_key?: string;
          compiled?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      chimera_game_states: {
        Row: {
          id: string;
          story_id: string;
          state: Record<string, unknown>;
          player_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          story_id: string;
          state: Record<string, unknown>;
          player_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          story_id?: string;
          state?: Record<string, unknown>;
          player_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chimera_instances_v3: {
        Row: {
          id: string;
          user_id: string;
          compiled_story_id: string;
          status: 'active' | 'ended';
          current_state: Record<string, unknown>;
          event_log: Record<string, unknown>[];
          turn_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          compiled_story_id: string;
          status?: 'active' | 'ended';
          current_state?: Record<string, unknown>;
          event_log?: Record<string, unknown>[];
          turn_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          compiled_story_id?: string;
          status?: 'active' | 'ended';
          current_state?: Record<string, unknown>;
          event_log?: Record<string, unknown>[];
          turn_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

    };
  };
}

/**
 * Get a typed Supabase client for Chimera database operations
 * If a bearer token is present in the request, it will be used for authentication
 * @param req - Express request (optional, for token extraction)
 * @returns Typed Supabase client configured with anon key and optional auth token
 */
export function getChimeraSupabaseClient(req?: Request): SupabaseClient<Database> {
  const client = createClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // If request has a bearer token, set it for auth context
  if (req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      client.auth.setSession({
        access_token: token,
        refresh_token: '',
      } as any).catch(() => {
        // Ignore errors - token might be invalid, but let RLS handle it
      });
    }
  }

  return client;
}

/**
 * Get a typed Supabase client using service key (bypasses RLS)
 * Use with caution - only for admin operations
 */
export function getChimeraSupabaseAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

