/**
 * Supabase Type Utilities
 * Temporary type helpers until database types are properly generated
 */

/**
 * Type assertion helper for Supabase query results
 * Use this when Supabase types return 'never' due to missing type definitions
 */
export function assertSupabaseData<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    throw new Error(`Supabase error: ${JSON.stringify(result.error)}`);
  }
  if (!result.data) {
    throw new Error('No data returned from Supabase');
  }
  return result.data;
}

/**
 * Safe type assertion for Supabase arrays
 */
export function assertSupabaseArray<T>(result: { data: T[] | null; error: unknown }): T[] {
  if (result.error) {
    throw new Error(`Supabase error: ${JSON.stringify(result.error)}`);
  }
  return result.data || [];
}

/**
 * Type helper for Supabase insert operations
 * Use when TypeScript complains about 'never' type
 */
export type SupabaseInsert<T> = T extends { insert: (values: infer U) => unknown } ? U : never;
