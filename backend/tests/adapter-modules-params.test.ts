/**
 * Adapter Modules Params Tests
 * Tests module params injection into TurnPacketV3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildTurnPacketV3FromV3 } from '../src/adapters/turn-packet-v3-adapter.js';
import type { EntryPointAssemblerV3Output } from '../src/prompts/entry-point-assembler-v3.js';

describe('Adapter Modules Params', () => {
  const mockV3Output: EntryPointAssemblerV3Output = {
    prompt: 'Test prompt',
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
      tokenEst: {
        input: 1000,
        budget: 8000,
        pct: 0.125,
      },
      source: 'entry-point',
      version: 'v3',
      npcTrimmedCount: 0,
      selectionContext: {
        worldId: 'test-world',
        worldSlug: 'test-world',
        entryPointId: 'test-entry',
        entryStartSlug: 'test-start',
        rulesetSlug: 'test-ruleset',
        npcCountBefore: 0,
        npcCountAfter: 0,
        budget: 8000,
        warnPct: 0.9,
      },
    },
  };

  beforeEach(() => {
    // Mock supabase
    vi.mock('../src/services/supabase.js', () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: { code: 'PGRST116' },
              })),
            })),
          })),
        })),
      },
    }));
  });

  it('should include module params when story has params', async () => {
    // Mock story_modules with params
    const mockStoryModules = [
      {
        module_id: 'module.relationships.v3',
        params: {
          gainCurve: { scale: 0.8, softCap: 12, hardCap: 20 },
          minTrustToRomance: 6,
        },
        modules: {
          id: 'module.relationships.v3',
          title: 'Relationships',
          version: 3,
          ai_hints: ['Test hint'],
          exports: {
            actions: [{ type: 'relationship.delta' }],
          },
        },
      },
    ];

    vi.doMock('../src/services/supabase.js', () => ({
      supabaseAdmin: {
        from: vi.fn((table: string) => {
          if (table === 'story_modules') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  data: mockStoryModules,
                  error: null,
                })),
              })),
            };
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: null,
                  error: { code: 'PGRST116' },
                })),
              })),
            })),
          };
        }),
      },
    }));

    // Mock module params service
    vi.mock('../src/services/module-params.service.js', () => ({
      getModuleParams: vi.fn(async () => ({
        gainCurve: { scale: 0.8, softCap: 12, hardCap: 20 },
        minTrustToRomance: 6,
      })),
      getModuleParamsDef: vi.fn(async () => ({
        schema: 'zod:RelationshipsParams',
        defaults: {
          gainCurve: { scale: 1.0, softCap: 12, hardCap: 20 },
          minTrustToRomance: 6,
        },
      })),
    }));

    const tp = await buildTurnPacketV3FromV3(
      mockV3Output,
      'Test system prompt',
      {},
      'Test input',
      'test-build'
    );

    expect(tp.modules).toBeDefined();
    expect(tp.modules.length).toBeGreaterThan(0);
    const relationshipsModule = tp.modules.find(m => m.id === 'module.relationships.v3');
    expect(relationshipsModule).toBeDefined();
    expect(relationshipsModule?.params).toEqual({
      gainCurve: { scale: 0.8, softCap: 12, hardCap: 20 },
      minTrustToRomance: 6,
    });
    
    // Check hints reflect key params
    expect(relationshipsModule?.slots['module.hints']).toContain('scale 0.8');
    expect(relationshipsModule?.slots['module.hints']).toContain('trust ≥ 6');
  });

  it('should set params to null when story has no params', async () => {
    // Mock story_modules without params
    const mockStoryModules = [
      {
        module_id: 'module.relationships.v3',
        params: null,
        modules: {
          id: 'module.relationships.v3',
          title: 'Relationships',
          version: 3,
          ai_hints: ['Test hint'],
          exports: {
            actions: [{ type: 'relationship.delta' }],
          },
        },
      },
    ];

    vi.doMock('../src/services/supabase.js', () => ({
      supabaseAdmin: {
        from: vi.fn((table: string) => {
          if (table === 'story_modules') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  data: mockStoryModules,
                  error: null,
                })),
              })),
            };
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: null,
                  error: { code: 'PGRST116' },
                })),
              })),
            })),
          };
        }),
      },
    }));

    // Mock module params service to return defaults
    vi.mock('../src/services/module-params.service.js', () => ({
      getModuleParams: vi.fn(async () => ({
        gainCurve: { scale: 1.0, softCap: 12, hardCap: 20 },
        minTrustToRomance: 6,
      })),
      getModuleParamsDef: vi.fn(async () => ({
        schema: 'zod:RelationshipsParams',
        defaults: {
          gainCurve: { scale: 1.0, softCap: 12, hardCap: 20 },
          minTrustToRomance: 6,
        },
      })),
    }));

    const tp = await buildTurnPacketV3FromV3(
      mockV3Output,
      'Test system prompt',
      {},
      'Test input',
      'test-build'
    );

    expect(tp.modules).toBeDefined();
    const relationshipsModule = tp.modules.find(m => m.id === 'module.relationships.v3');
    expect(relationshipsModule).toBeDefined();
    expect(relationshipsModule?.params).toBeNull();
    
    // Hints should fallback to generic
    expect(relationshipsModule?.slots['module.hints']).toBeDefined();
    expect(relationshipsModule?.slots['module.hints']).toContain('Relationships');
  });
});

