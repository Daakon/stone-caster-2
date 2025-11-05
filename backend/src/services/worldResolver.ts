/**
 * World Resolver Service
 * Resolves world identifiers (UUID or slug) to world IDs
 */

import { supabase } from './supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve a world identifier to a world ID
 * @param input - World UUID or slug
 * @param client - Optional Supabase client (uses default if not provided)
 * @returns World ID (UUID) or null if not found
 */
export async function resolveWorldId(
  input: string,
  client?: SupabaseClient
): Promise<string | null> {
  if (!input || input.trim().length === 0) {
    return null;
  }

  const trimmed = input.trim();
  const db = client || supabase;

  // Check if input looks like a UUID (basic pattern check)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isLikelyUuid = uuidPattern.test(trimmed);

  if (isLikelyUuid) {
    // Verify the UUID exists in the worlds table
    const { data, error } = await db
      .from('worlds')
      .select('id')
      .eq('id', trimmed)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  }

  // Treat as slug and look up by slug
  const { data, error } = await db
    .from('worlds')
    .select('id')
    .eq('slug', trimmed)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

