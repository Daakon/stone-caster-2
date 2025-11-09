/**
 * Template Lint Tests
 * CI gate: Ensure template lint passes with no "missing slot" errors for Latest Published
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { lintTemplates } from '../src/utils/template-lint.js';

describe('Template Lint CI Gate', () => {
  it('should pass with no missing slot errors for Latest Published', async () => {
    const warnings = await lintTemplates(undefined); // Latest Published
    
    const missingSlotErrors = warnings.filter(
      w => w.severity === 'error' && w.type === 'missing_slot'
    );
    
    expect(missingSlotErrors.length).toBe(0);
  });

  it('should identify missing slots as errors', async () => {
    // This test ensures the lint function correctly identifies missing slots
    const warnings = await lintTemplates(undefined);
    
    // All missing slot issues should be errors, not warnings
    const missingSlots = warnings.filter(w => w.type === 'missing_slot');
    missingSlots.forEach(w => {
      expect(w.severity).toBe('error');
    });
  });
});

