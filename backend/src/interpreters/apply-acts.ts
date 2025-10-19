/**
 * AWF Act Application
 * Phase 4: Act Interpreter - Main function for applying acts to session state
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ActInterpreter } from './awf-act-interpreter.js';
import { ApplyActsParams, ApplyActsResult } from '../types/awf-acts.js';

/**
 * Apply AWF acts to session state with full transaction support
 * 
 * @param params - Parameters containing sessionId and AWF response
 * @param supabase - Supabase client instance
 * @returns Promise resolving to new state and application summary
 */
export async function applyActs(
  params: ApplyActsParams,
  supabase: SupabaseClient
): Promise<ApplyActsResult> {
  const interpreter = new ActInterpreter(supabase);
  return await interpreter.applyActs(params);
}


