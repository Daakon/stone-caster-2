import { describe, it, expect } from 'vitest';
import { diceService } from '../services/dice';

describe('DiceService', () => {
  it('should roll a d20', () => {
    const result = diceService.roll({
      type: 'd20',
      count: 1,
      modifier: 0,
    });

    expect(result.rolls).toHaveLength(1);
    expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
    expect(result.rolls[0]).toBeLessThanOrEqual(20);
    expect(result.finalResult).toBe(result.rolls[0]);
  });

  it('should apply modifiers correctly', () => {
    const result = diceService.roll({
      type: 'd20',
      count: 1,
      modifier: 5,
    });

    expect(result.finalResult).toBe(result.total + 5);
  });

  it('should calculate attribute modifiers', () => {
    expect(diceService.calculateModifier(10)).toBe(0);
    expect(diceService.calculateModifier(12)).toBe(1);
    expect(diceService.calculateModifier(8)).toBe(-1);
    expect(diceService.calculateModifier(20)).toBe(5);
  });

  it('should detect critical success', () => {
    // Mock the random to return 20
    const originalRandom = Math.random;
    Math.random = () => 0.99;

    const result = diceService.roll({
      type: 'd20',
      count: 1,
      modifier: 0,
    });

    expect(result.criticalSuccess).toBe(true);

    Math.random = originalRandom;
  });
});
