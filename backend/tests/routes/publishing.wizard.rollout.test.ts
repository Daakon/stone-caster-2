/**
 * Publishing Wizard Rollout Tests
 * Phase 8: Tests for rollout gating logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isWizardAllowed } from '../../src/config/publishingWizard.js';
import * as featureFlags from '../../src/config/featureFlags.js';

// Mock feature flags
vi.mock('../../src/config/featureFlags.js', () => ({
  isPublishingWizardRolloutEnabled: vi.fn(),
}));

describe('isWizardAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    process.env.WIZARD_ROLLOUT_ALLOWLIST = '';
    process.env.WIZARD_ROLLOUT_PERCENT = '0';
  });

  it('should allow all users when rollout is disabled', () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(false);
    
    expect(isWizardAllowed('user-1')).toBe(true);
    expect(isWizardAllowed('user-2')).toBe(true);
  });

  it('should allow users in allowlist', () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(true);
    process.env.WIZARD_ROLLOUT_ALLOWLIST = 'user-1,admin@example.com';
    
    // Reload module to pick up new env var
    vi.resetModules();
    const { isWizardAllowed: reloadedIsWizardAllowed } = require('../../src/config/publishingWizard.js');
    
    expect(reloadedIsWizardAllowed('user-1', 'user@example.com')).toBe(true);
    expect(reloadedIsWizardAllowed('other-user', 'admin@example.com')).toBe(true);
    expect(reloadedIsWizardAllowed('other-user', 'user@example.com')).toBe(false);
  });

  it('should allow users based on percentage', () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(true);
    process.env.WIZARD_ROLLOUT_PERCENT = '50';
    
    // Reload module
    vi.resetModules();
    const { isWizardAllowed: reloadedIsWizardAllowed } = require('../../src/config/publishingWizard.js');
    
    // Hash should be consistent for same userId
    const result1 = reloadedIsWizardAllowed('user-1');
    const result2 = reloadedIsWizardAllowed('user-1');
    expect(result1).toBe(result2); // Consistent assignment
    
    // Different users may have different results
    const result3 = reloadedIsWizardAllowed('user-2');
    // At least one should be allowed with 50% rollout
    expect(result1 || result3).toBe(true);
  });

  it('should deny by default when rollout enabled but no allowlist/percent', () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(true);
    process.env.WIZARD_ROLLOUT_ALLOWLIST = '';
    process.env.WIZARD_ROLLOUT_PERCENT = '0';
    
    // Reload module
    vi.resetModules();
    const { isWizardAllowed: reloadedIsWizardAllowed } = require('../../src/config/publishingWizard.js');
    
    expect(reloadedIsWizardAllowed('user-1')).toBe(false);
  });
});

