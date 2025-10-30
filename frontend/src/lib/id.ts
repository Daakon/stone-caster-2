/**
 * ID and slug utilities for the Stone Caster application
 */

/**
 * Check if a string is a valid UUID
 */
export const isUUID = (s: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
};

/**
 * Check if a string looks like a slug (lowercase, hyphens, alphanumeric)
 */
export const isSlug = (s: string): boolean => {
  return /^[a-z0-9-]+$/.test(s);
};

/**
 * Determine if an ID is a UUID or slug
 * Returns 'uuid' for UUIDs, 'slug' for slugs, 'unknown' for other formats
 */
export const getIdType = (id: string): 'uuid' | 'slug' | 'unknown' => {
  if (isUUID(id)) return 'uuid';
  if (isSlug(id)) return 'slug';
  return 'unknown';
};

/**
 * Normalize an ID for display purposes
 * UUIDs are truncated, slugs are kept as-is
 */
export const normalizeIdForDisplay = (id: string, maxLength: number = 8): string => {
  if (isUUID(id)) {
    return `${id.substring(0, maxLength)}...`;
  }
  return id;
};
