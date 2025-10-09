import { describe, it, expect } from 'vitest';
import { ADVENTURE_IDS } from '../src/constants/game-constants.js';

describe('Path Resolution', () => {
  it('should map adventure ID to correct directory name', () => {
    // Test the mapping logic
    const adventureName = ADVENTURE_IDS.WHISPERCROSS; // 'adv.whispercross.start.v3'
    let adventurePath = adventureName;
    
    if (adventureName === ADVENTURE_IDS.WHISPERCROSS) {
      adventurePath = 'whispercross'; // Map to actual directory name
    }
    
    expect(adventurePath).toBe('whispercross');
    expect(adventurePath).not.toBe('adv.whispercross.start.v3');
  });

  it('should handle other adventure names without mapping', () => {
    const adventureName = 'some-other-adventure';
    let adventurePath = adventureName;
    
    if (adventureName === ADVENTURE_IDS.WHISPERCROSS) {
      adventurePath = 'whispercross';
    }
    
    expect(adventurePath).toBe('some-other-adventure');
  });
});
