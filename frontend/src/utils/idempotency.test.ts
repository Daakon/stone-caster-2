import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, generateOptionId } from './idempotency';

describe('Idempotency Utils', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate a unique key', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
      expect(key1).not.toBe(key2);
    });

    it('should generate a string', () => {
      const key = generateIdempotencyKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('generateOptionId', () => {
    it('should generate deterministic option IDs', () => {
      const action = 'I attack the goblin';
      const id1 = generateOptionId(action);
      const id2 = generateOptionId(action);
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^option-[a-f0-9]{8}$/);
    });

    it('should generate different IDs for different actions', () => {
      const id1 = generateOptionId('I attack the goblin');
      const id2 = generateOptionId('I cast a spell');
      
      expect(id1).not.toBe(id2);
    });

    it('should handle empty strings', () => {
      const id = generateOptionId('');
      expect(id).toMatch(/^option-[a-f0-9]{8}$/);
    });
  });
});
