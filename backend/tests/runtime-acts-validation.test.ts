/**
 * Runtime Acts Validation Tests
 * Tests action validation against registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { actionRegistry } from '../src/actions/registry.js';
import { validateAction } from '../src/services/action-validation.service.js';
import { RelationshipDeltaSchema } from '../src/actions/schemas/relationships.js';

// Mock supabase
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('Runtime Acts Validation', () => {
  beforeEach(() => {
    // Clear any existing registrations by checking if registry has a clear method
    // For now, we'll just test with fresh registrations
  });

  it('should warn and allow unknown action when ALLOW_UNKNOWN_ACTIONS=true', async () => {
    const originalEnv = process.env.ALLOW_UNKNOWN_ACTIONS;
    process.env.ALLOW_UNKNOWN_ACTIONS = 'true';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await validateAction(
      { t: 'UNKNOWN_ACTION', payload: {} },
      'test-story-id'
    );

    expect(result.valid).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown action type: UNKNOWN_ACTION')
    );

    consoleWarnSpy.mockRestore();
    if (originalEnv !== undefined) {
      process.env.ALLOW_UNKNOWN_ACTIONS = originalEnv;
    } else {
      delete process.env.ALLOW_UNKNOWN_ACTIONS;
    }
  });

  it('should reject unknown action when ALLOW_UNKNOWN_ACTIONS=false', async () => {
    const originalEnv = process.env.ALLOW_UNKNOWN_ACTIONS;
    process.env.ALLOW_UNKNOWN_ACTIONS = 'false';

    const result = await validateAction(
      { t: 'UNKNOWN_ACTION', payload: {} },
      'test-story-id'
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unknown_action');
    expect(result.type).toBe('UNKNOWN_ACTION');

    if (originalEnv !== undefined) {
      process.env.ALLOW_UNKNOWN_ACTIONS = originalEnv;
    } else {
      delete process.env.ALLOW_UNKNOWN_ACTIONS;
    }
  });

  it('should reject known action with invalid payload', async () => {
    // Register a test action
    actionRegistry.register(
      'test.action',
      RelationshipDeltaSchema,
      'test-slice',
      async () => ({})
    );

    const result = await validateAction(
      {
        t: 'test.action',
        payload: {
          npcId: '', // Invalid: min length 1
          stat: 'warmth',
          delta: 5,
        },
      },
      'test-story-id'
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('schema_invalid');
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should reject known action when module not attached', async () => {
    // Register a module action
    actionRegistry.register(
      'relationship.delta',
      RelationshipDeltaSchema,
      'relationships', // Module-owned slice
      async () => ({})
    );

    // Mock supabase to return no attached modules
    const { supabaseAdmin } = await import('../src/services/supabase.js');
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: { code: 'PGRST116' },
          })),
        })),
      })),
    } as any);

    const result = await validateAction(
      {
        t: 'relationship.delta',
        payload: {
          npcId: 'npc-1',
          stat: 'warmth',
          delta: 5,
        },
      },
      'test-story-id'
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('module_not_attached');
    expect(result.owner).toBe('relationships');
  });

  it('should allow valid action with attached module', async () => {
    // Register a module action
    actionRegistry.register(
      'relationship.delta',
      RelationshipDeltaSchema,
      'relationships',
      async () => ({})
    );

    // Mock supabase to return attached module
    const { supabaseAdmin } = await import('../src/services/supabase.js');
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [
            {
              modules: { state_slice: 'relationships' },
            },
          ],
          error: null,
        })),
      })),
    } as any);

    const result = await validateAction(
      {
        t: 'relationship.delta',
        payload: {
          npcId: 'npc-1',
          stat: 'warmth',
          delta: 5,
        },
      },
      'test-story-id'
    );

    expect(result.valid).toBe(true);
  });
});

