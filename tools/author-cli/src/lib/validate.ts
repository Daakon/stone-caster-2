/**
 * Validation Utilities
 * Normalizes and validates data for deterministic exports
 */

/**
 * Normalize data for deterministic output
 */
export function normalizeData<T extends Record<string, any>>(items: T[]): T[] {
  return items
    .map(item => normalizeObject(item))
    .sort((a, b) => {
      // Sort by id or name
      const keyA = a.id || a.name || '';
      const keyB = b.id || b.name || '';
      return keyA.localeCompare(keyB);
    });
}

/**
 * Normalize object with sorted keys
 */
export function normalizeObject<T extends Record<string, any>>(obj: T): T {
  const normalized: any = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    const value = obj[key];
    if (value === null || value === undefined) {
      continue; // Skip null/undefined
    }
    if (Array.isArray(value)) {
      normalized[key] = value.map(v => 
        typeof v === 'object' && v !== null ? normalizeObject(v) : v
      );
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      normalized[key] = normalizeObject(value);
    } else {
      normalized[key] = value;
    }
  }
  
  return normalized as T;
}

