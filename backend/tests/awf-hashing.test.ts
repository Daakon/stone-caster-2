/**
 * Unit tests for AWF (Adventure World Format) bundle hashing utilities
 * Phase 1: Data Model - Hashing testing
 */

import { describe, it, expect } from 'vitest';
import { stableJsonStringify, computeDocumentHash, validateDocumentHash } from '../src/utils/awf-hashing.js';

describe('AWF Hashing Utilities', () => {
  describe('stableJsonStringify', () => {
    it('should produce consistent output for simple values', () => {
      expect(stableJsonStringify('test')).toBe('"test"');
      expect(stableJsonStringify(123)).toBe('123');
      expect(stableJsonStringify(true)).toBe('true');
      expect(stableJsonStringify(null)).toBe('null');
      expect(stableJsonStringify(undefined)).toBe(undefined);
    });

    it('should produce consistent output for arrays', () => {
      const arr = [3, 1, 2];
      const result = stableJsonStringify(arr);
      expect(result).toBe('[3,1,2]');
    });

    it('should produce consistent output for objects with sorted keys', () => {
      const obj = { c: 3, a: 1, b: 2 };
      const result = stableJsonStringify(obj);
      expect(result).toBe('{"a":1,"b":2,"c":3}');
    });

    it('should handle nested objects with sorted keys', () => {
      const obj = {
        c: { z: 3, x: 1, y: 2 },
        a: { c: 3, a: 1, b: 2 },
        b: 2,
      };
      const result = stableJsonStringify(obj);
      expect(result).toBe('{"a":{"a":1,"b":2,"c":3},"b":2,"c":{"x":1,"y":2,"z":3}}');
    });

    it('should handle arrays of objects', () => {
      const arr = [
        { c: 3, a: 1, b: 2 },
        { z: 3, x: 1, y: 2 },
      ];
      const result = stableJsonStringify(arr);
      expect(result).toBe('[{"a":1,"b":2,"c":3},{"x":1,"y":2,"z":3}]');
    });

    it('should produce the same output regardless of key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const obj3 = { b: 2, c: 3, a: 1 };

      const result1 = stableJsonStringify(obj1);
      const result2 = stableJsonStringify(obj2);
      const result3 = stableJsonStringify(obj3);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('computeDocumentHash', () => {
    it('should produce consistent hashes for the same document', () => {
      const doc = { a: 1, b: 2, c: 3 };
      const hash1 = computeDocumentHash(doc);
      const hash2 = computeDocumentHash(doc);
      expect(hash1).toBe(hash2);
    });

    it('should produce the same hash regardless of key order', () => {
      const doc1 = { a: 1, b: 2, c: 3 };
      const doc2 = { c: 3, a: 1, b: 2 };
      const hash1 = computeDocumentHash(doc1);
      const hash2 = computeDocumentHash(doc2);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different documents', () => {
      const doc1 = { a: 1, b: 2, c: 3 };
      const doc2 = { a: 1, b: 2, c: 4 };
      const hash1 = computeDocumentHash(doc1);
      const hash2 = computeDocumentHash(doc2);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce SHA-256 hashes', () => {
      const doc = { test: 'value' };
      const hash = computeDocumentHash(doc);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 produces 64 hex characters
    });

    it('should handle complex nested documents', () => {
      const doc = {
        contract: {
          version: 'v4',
          name: 'Test Contract',
          description: 'A test contract',
        },
        acts: {
          allowed: ['move', 'interact'],
        },
        memory: {
          exemplars: [
            {
              id: 'exemplar-1',
              content: 'Test content',
              metadata: { type: 'test' },
            },
          ],
        },
      };

      const hash1 = computeDocumentHash(doc);
      const hash2 = computeDocumentHash(doc);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('validateDocumentHash', () => {
    it('should return true for valid document hashes', () => {
      const doc = { a: 1, b: 2, c: 3 };
      const hash = computeDocumentHash(doc);
      expect(validateDocumentHash(doc, hash)).toBe(true);
    });

    it('should return false for invalid document hashes', () => {
      const doc = { a: 1, b: 2, c: 3 };
      const invalidHash = 'invalid-hash';
      expect(validateDocumentHash(doc, invalidHash)).toBe(false);
    });

    it('should return false when document content changes', () => {
      const originalDoc = { a: 1, b: 2, c: 3 };
      const modifiedDoc = { a: 1, b: 2, c: 4 };
      const hash = computeDocumentHash(originalDoc);
      expect(validateDocumentHash(modifiedDoc, hash)).toBe(false);
    });

    it('should work with complex documents', () => {
      const doc = {
        contract: {
          version: 'v4',
          name: 'Test Contract',
          description: 'A test contract',
        },
        acts: {
          allowed: ['move', 'interact'],
        },
      };

      const hash = computeDocumentHash(doc);
      expect(validateDocumentHash(doc, hash)).toBe(true);
    });
  });
});
