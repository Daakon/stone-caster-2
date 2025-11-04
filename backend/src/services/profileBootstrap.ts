/**
 * Profile Bootstrap Service
 * Ensures a profiles row exists for authenticated users
 * Idempotent: safe to call multiple times
 */

import { supabaseAdmin } from './supabase.js';

/**
 * Ensure a profile row exists for the given user ID
 * Creates a profile with role='pending' if it doesn't exist
 * @param userId Auth user ID (from auth.users)
 * @returns true if profile was created, false if it already existed
 */
export async function ensureProfile(userId: string): Promise<boolean> {
  try {
    // Check if profile exists
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "not found" - expected for new users
      // Other errors are unexpected
      console.error('[ProfileBootstrap] Error checking profile:', selectError);
      throw new Error(`Failed to check profile: ${selectError.message}`);
    }

    if (existing) {
      // Profile already exists
      return false;
    }

    // Profile doesn't exist - create it
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        role: 'pending',
        joined_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[ProfileBootstrap] Error creating profile:', insertError);
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }

    return true;
  } catch (error) {
    console.error('[ProfileBootstrap] Unexpected error:', error);
    throw error;
  }
}

