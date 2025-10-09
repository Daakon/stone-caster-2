import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../src/services/ai.js';

describe('AIService Input Validation', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  it('should accept adventure names with dots in first turn input', () => {
    const validInput = 'Begin the adventure "adventure_adv.whispercross.start.v3" from its starting scene "forest_meet".';
    const validation = (aiService as any).validateInputSection(validInput, true);
    
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it('should accept adventure names with hyphens in first turn input', () => {
    const validInput = 'Begin the adventure "adventure_my-adventure" from its starting scene "forest_meet".';
    const validation = (aiService as any).validateInputSection(validInput, true);
    
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it('should accept adventure names with underscores in first turn input', () => {
    const validInput = 'Begin the adventure "adventure_whispercross_hook" from its starting scene "forest_meet".';
    const validation = (aiService as any).validateInputSection(validInput, true);
    
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it('should reject adventure names without adventure_ prefix', () => {
    const invalidInput = 'Begin the adventure "whispercross_hook" from its starting scene "forest_meet".';
    const validation = (aiService as any).validateInputSection(invalidInput, true);
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid first turn input format');
  });

  it('should reject empty adventure names', () => {
    const invalidInput = 'Begin the adventure "adventure_" from its starting scene "forest_meet".';
    const validation = (aiService as any).validateInputSection(invalidInput, true);
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid first turn input format');
  });

  it('should allow any input for non-first turns', () => {
    const anyInput = 'Any input for non-first turn';
    const validation = (aiService as any).validateInputSection(anyInput, false);
    
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });
});
