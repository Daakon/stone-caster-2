import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, generateOptionId } from '../idempotency';

describe('idempotency utilities', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate a unique key each time', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
    });

    it('should generate a valid format', () => {
      const key = generateIdempotencyKey();
      
      // Should be a string with reasonable length
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(10);
    });
  });

  describe('generateOptionId', () => {
    it('should generate a valid UUID format', () => {
      const optionId = generateOptionId('test action');
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(optionId).toMatch(uuidRegex);
    });

    it('should generate the same ID for the same action', () => {
      const action = 'test action';
      const id1 = generateOptionId(action);
      const id2 = generateOptionId(action);
      
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different actions', () => {
      const id1 = generateOptionId('action 1');
      const id2 = generateOptionId('action 2');
      
      expect(id1).not.toBe(id2);
    });

    it('should handle empty action', () => {
      const optionId = generateOptionId('');
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(optionId).toMatch(uuidRegex);
    });

    it('should handle special characters in action', () => {
      const action = 'action with special chars: !@#$%^&*()';
      const optionId = generateOptionId(action);
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(optionId).toMatch(uuidRegex);
    });
  });
});
