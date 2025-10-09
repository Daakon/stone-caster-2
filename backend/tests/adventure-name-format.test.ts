import { describe, it, expect } from 'vitest';

describe('Adventure Name Format Validation', () => {
  it('should accept adventure names with dots', () => {
    const validFormatWithDots = 'Begin the adventure "adventure_adv.whispercross.start.v3" from its starting scene "forest_meet".';
    const expectedPattern = /Begin the adventure "adventure_[^"]+" from its starting scene "\w+"/;
    
    expect(expectedPattern.test(validFormatWithDots)).toBe(true);
  });

  it('should accept adventure names with underscores', () => {
    const validFormatWithUnderscores = 'Begin the adventure "adventure_whispercross_hook" from its starting scene "forest_meet".';
    const expectedPattern = /Begin the adventure "adventure_[^"]+" from its starting scene "\w+"/;
    
    expect(expectedPattern.test(validFormatWithUnderscores)).toBe(true);
  });

  it('should accept adventure names with hyphens', () => {
    const validFormatWithHyphens = 'Begin the adventure "adventure_my-adventure" from its starting scene "forest_meet".';
    const expectedPattern = /Begin the adventure "adventure_[^"]+" from its starting scene "\w+"/;
    
    expect(expectedPattern.test(validFormatWithHyphens)).toBe(true);
  });

  it('should reject adventure names without adventure_ prefix', () => {
    const invalidFormat = 'Begin the adventure "whispercross_hook" from its starting scene "forest_meet".';
    const expectedPattern = /Begin the adventure "adventure_[^"]+" from its starting scene "\w+"/;
    
    expect(expectedPattern.test(invalidFormat)).toBe(false);
  });

  it('should reject empty adventure names', () => {
    const invalidFormat = 'Begin the adventure "adventure_" from its starting scene "forest_meet".';
    const expectedPattern = /Begin the adventure "adventure_[^"]+" from its starting scene "\w+"/;
    
    expect(expectedPattern.test(invalidFormat)).toBe(false);
  });
});
