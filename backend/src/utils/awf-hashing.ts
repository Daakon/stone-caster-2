/**
 * Hashing utilities for AWF (Adventure World Format) bundle documents
 * Phase 1: Data Model - Content hashing for integrity verification
 */

import { createHash } from 'crypto';

/**
 * Creates a stable JSON string representation of an object
 * - No whitespace
 * - Sorted keys for consistent ordering
 * - Handles nested objects and arrays
 */
export function stableJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const sortedArray = obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        return JSON.parse(stableJsonStringify(item));
      }
      return item;
    });
    return JSON.stringify(sortedArray);
  }

  if (typeof obj === 'object') {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === 'object' && value !== null) {
        sortedObj[key] = JSON.parse(stableJsonStringify(value));
      } else {
        sortedObj[key] = value;
      }
    }
    
    return JSON.stringify(sortedObj);
  }

  return JSON.stringify(obj);
}

/**
 * Computes SHA-256 hash of a document
 * Uses stable JSON stringify to ensure consistent hashing
 */
export function computeDocumentHash(doc: unknown): string {
  const stableJson = stableJsonStringify(doc);
  return createHash('sha256').update(stableJson, 'utf8').digest('hex');
}

/**
 * Validates that a document hash matches its content
 */
export function validateDocumentHash(doc: unknown, expectedHash: string): boolean {
  const computedHash = computeDocumentHash(doc);
  return computedHash === expectedHash;
}

/**
 * Creates a hash for a specific document type with validation
 */
export function createDocumentHash<T>(doc: T): string {
  return computeDocumentHash(doc);
}


