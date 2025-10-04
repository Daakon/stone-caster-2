/**
 * Generates a unique idempotency key for turn submissions
 * Uses crypto.randomUUID() if available, falls back to timestamp + random
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Generates a deterministic option ID from user action text
 * This ensures the same action always gets the same option ID
 */
export function generateOptionId(action: string): string {
  // Simple hash function for deterministic option IDs
  let hash = 0;
  for (let i = 0; i < action.length; i++) {
    const char = action.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string and pad to 8 characters
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `option-${hex}`;
}
