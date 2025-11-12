/**
 * Publishing Wizard Rollout Tests
 * Phase 8: Tests for rollout gating logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as featureFlags from '../../src/config/featureFlags.js';

vi.mock('../../src/config/featureFlags.js', () => ({
  isPublishingWizardRolloutEnabled: vi.fn(),
}));

async function loadWizard() {
  vi.resetModules();
  const module = await import('../../src/config/publishingWizard.js');
  return module.isWizardAllowed;
}

describe('isWizardAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WIZARD_ROLLOUT_ALLOWLIST = '';
    process.env.WIZARD_ROLLOUT_PERCENT = '0';
  });

  it('should allow all users when rollout is disabled', async () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(false);
    const isWizardAllowed = await loadWizard();
    expect(isWizardAllowed('user-1')).toBe(true);
    expect(isWizardAllowed('user-2')).toBe(true);
  });

  it('should allow users in allowlist', async () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(true);
    process.env.WIZARD_ROLLOUT_ALLOWLIST = 'user-1,admin@example.com';

    const isWizardAllowed = await loadWizard();
    expect(isWizardAllowed('user-1', 'user@example.com')).toBe(true);
    expect(isWizardAllowed('other-user', 'admin@example.com')).toBe(true);
    expect(isWizardAllowed('other-user', 'user@example.com')).toBe(false);
  });

  it('should allow users based on percentage', async () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(true);
    process.env.WIZARD_ROLLOUT_PERCENT = '50';

    const isWizardAllowed = await loadWizard();
    const result1 = isWizardAllowed('user-1');
    const result2 = isWizardAllowed('user-1');
    expect(result1).toBe(result2);

    const result3 = isWizardAllowed('user-2');
    expect(result1 || result3).toBe(true);
  });

  it('should deny by default when rollout enabled but no allowlist/percent', async () => {
    vi.mocked(featureFlags.isPublishingWizardRolloutEnabled).mockReturnValue(true);
    const isWizardAllowed = await loadWizard();
    expect(isWizardAllowed('user-1')).toBe(false);
  });
});

