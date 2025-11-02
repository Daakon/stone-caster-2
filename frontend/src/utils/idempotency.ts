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
 * Returns a proper UUID format for API compatibility
 */
export function generateOptionId(action: string): string {
  // Always generate deterministic UUID based on action
  // This ensures the same action always gets the same option ID
  const hash = action.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
  }, 0);
  
  // Convert hash to hex and pad to 8 characters
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  
  // Generate deterministic hex digits based on hash for UUID v4 format
  const hex = '0123456789abcdef';
  const getDeterministicHex = (index: number) => {
    const seed = (hash + index) & 0xffffffff;
    return hex[Math.abs(seed) % 16];
  };
  
  // Use hash for first 8 characters, generate rest deterministically
  let uuid = hashHex;
  for (let i = 8; i < 32; i++) {
    uuid += getDeterministicHex(i);
  }
  
  // Insert hyphens and set version/variant bits for UUID v4
  const variantIndex = Math.abs(hash) % 4;
  const formatted = [
    uuid.substring(0, 8),
    uuid.substring(8, 12),
    '4' + uuid.substring(13, 16), // Version 4
    ['8', '9', 'a', 'b'][variantIndex] + uuid.substring(17, 20), // Variant
    uuid.substring(20, 32)
  ].join('-');
  
  return formatted;
}

/**
 * Phase 8: Generate v4 UUID idempotency key (re-export from lib/idempotency)
 */
export function generateIdempotencyKeyV4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `idem-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}