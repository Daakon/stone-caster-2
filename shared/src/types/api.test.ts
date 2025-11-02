import { describe, it, expect } from 'vitest';
import { GetTurnsQuerySchema } from './api.js';

describe('GetTurnsQuerySchema', () => {
  it('should accept valid query with afterTurn and limit', () => {
    const result = GetTurnsQuerySchema.safeParse({
      afterTurn: 5,
      limit: 10,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.afterTurn).toBe(5);
      expect(result.data.limit).toBe(10);
    }
  });

  it('should accept query with only limit', () => {
    const result = GetTurnsQuerySchema.safeParse({
      limit: 20,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.afterTurn).toBeUndefined();
      expect(result.data.limit).toBe(20);
    }
  });

  it('should use default limit when not provided', () => {
    const result = GetTurnsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.afterTurn).toBeUndefined();
    }
  });

  it('should coerce string numbers to numbers', () => {
    const result = GetTurnsQuerySchema.safeParse({
      afterTurn: '5',
      limit: '10',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.afterTurn).toBe(5);
      expect(result.data.limit).toBe(10);
    }
  });

  it('should reject limit greater than 100', () => {
    const result = GetTurnsQuerySchema.safeParse({
      limit: 101,
    });

    expect(result.success).toBe(false);
  });

  it('should reject limit less than 1', () => {
    const result = GetTurnsQuerySchema.safeParse({
      limit: 0,
    });

    expect(result.success).toBe(false);
  });

  it('should reject afterTurn less than 1', () => {
    const result = GetTurnsQuerySchema.safeParse({
      afterTurn: 0,
    });

    expect(result.success).toBe(false);
  });

  it('should reject negative values', () => {
    const result = GetTurnsQuerySchema.safeParse({
      afterTurn: -1,
      limit: -5,
    });

    expect(result.success).toBe(false);
  });

  it('should reject non-integer values', () => {
    const result = GetTurnsQuerySchema.safeParse({
      afterTurn: 5.5,
      limit: 10.5,
    });

    expect(result.success).toBe(false);
  });
});

