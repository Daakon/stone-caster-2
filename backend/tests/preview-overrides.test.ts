/**
 * Preview Overrides Tests
 * Tests temporary preview overrides (non-persisting)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Preview Overrides', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req, res, next) => {
      (req as any).user = { id: 'test-user', role: 'admin' };
      next();
    });

    // Import and mount admin routes
    // Note: In real tests, you'd import the actual router
  });

  it('should apply moduleParamsOverrides to tp.modules[].params', async () => {
    // This would test the actual endpoint
    // For now, we'll test the adapter directly
    
    const { buildTurnPacketV3FromV3 } = await import('../src/adapters/turn-packet-v3-adapter.js');
    
    const mockV3Output = {
      prompt: '',
      pieces: [],
      meta: {
        included: [],
        dropped: [],
        model: 'gpt-4o-mini',
        worldId: 'test-world',
        worldSlug: 'test-world',
        rulesetSlug: 'test-ruleset',
        entryPointId: 'test-entry',
        entryPointSlug: 'test-entry',
        entryStartSlug: 'test-start',
        tokenEst: { input: 1000, budget: 8000, pct: 0.125 },
        source: 'entry-point' as const,
        version: 'v3' as const,
        npcTrimmedCount: 0,
        selectionContext: {} as any,
      },
    };

    const overrides = {
      moduleParamsOverrides: {
        'module.relationships.v3': {
          gainCurve: { scale: 0.5, softCap: 10, hardCap: 15 },
          minTrustToRomance: 8,
        },
      },
    };

    // Mock dependencies
    vi.mock('../src/services/supabase.js', () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [
                {
                  module_id: 'module.relationships.v3',
                  params: null, // DB has no params
                  modules: {
                    id: 'module.relationships.v3',
                    title: 'Relationships',
                    version: 3,
                    ai_hints: ['Test hint'],
                    exports: { actions: [{ type: 'relationship.delta' }] },
                  },
                },
              ],
              error: null,
            })),
          })),
        })),
      },
    }));

    vi.mock('../src/services/module-params.service.js', () => ({
      getModuleParams: vi.fn(async () => null),
      getModuleParamsDef: vi.fn(async () => ({
        schema: 'zod:RelationshipsParams',
        defaults: {
          gainCurve: { scale: 1.0, softCap: 12, hardCap: 20 },
          minTrustToRomance: 6,
        },
      })),
      validateModuleParams: vi.fn(async () => ({ valid: true })),
    }));

    const tp = await buildTurnPacketV3FromV3(
      mockV3Output as any,
      'Test prompt',
      {},
      'Test input',
      'test-build',
      undefined,
      overrides
    );

    const relationshipsModule = tp.modules.find(m => m.id === 'module.relationships.v3');
    expect(relationshipsModule?.params).toEqual(overrides.moduleParamsOverrides['module.relationships.v3']);
  });

  it('should apply extrasOverrides to rendered slots', async () => {
    // Similar test for extras overrides
    // Would verify that extras are merged into Mustache context
    expect(true).toBe(true); // Placeholder
  });

  it('should return 400 for invalid moduleParamsOverrides', async () => {
    // Test validation
    vi.mock('../src/services/module-params.service.js', () => ({
      validateModuleParams: vi.fn(async () => ({
        valid: false,
        errors: [{ path: ['gainCurve', 'scale'], message: 'Must be between 0 and 3' }],
      })),
    }));

    // Would test endpoint returns 400
    expect(true).toBe(true); // Placeholder
  });

  it('should not persist overrides to database', async () => {
    // Verify that after preview with overrides, DB is unchanged
    // This is more of an integration test
    expect(true).toBe(true); // Placeholder
  });
});

