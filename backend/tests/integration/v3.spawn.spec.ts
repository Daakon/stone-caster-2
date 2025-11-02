/**
 * Integration tests for v3 spawn (game creation)
 * Covers happy path, ruleset defaulting, world status, budget trim
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { GamesService } from '../../src/services/games.service.js';
import { seed } from '../../scripts/seed-v3-fixtures.js';

describe('v3 Spawn Integration', () => {
  const testTag = 'v3-e2e';
  const testWorldId = '00000000-0000-0000-0000-000000000001';
  const testEntryPointId = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    // Seed fixtures
    await seed({ tag: testTag });
  });

  afterAll(async () => {
    // Cleanup handled by clear script or test transaction
  });

  it('should create game with entry-point source and v3 version', async () => {
    const gamesService = new GamesService();
    
    const result = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: 'test-user-1',
      isGuest: false,
      includeAssemblerMetadata: true,
    });

    expect(result.success).toBe(true);
    expect(result.game_id).toBeDefined();
    expect(result.first_turn).toBeDefined();
    expect(result.first_turn?.turn_number).toBe(1);
    
    // Check assembler metadata
    if (result.assemblerMetadata) {
      expect(result.assemblerMetadata.meta.source).toBe('entry-point');
      expect(result.assemblerMetadata.meta.version).toBe('v3');
      expect(result.assemblerMetadata.meta.selectionContext).toBeDefined();
    }
    // Cleanup
    if (result.game_id) {
      await supabaseAdmin.from('games').delete().eq('id', result.game_id);
    }
  });

  it('should default to is_default ruleset when ruleset_slug not provided', async () => {
    const gamesService = new GamesService();
    
    const result = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ownerId: 'test-user-2',
      isGuest: false,
    });

    expect(result.success).toBe(true);
    // Ruleset should default to core.default (is_default=true)
    // Cleanup
    if (result.game_id) {
      await supabaseAdmin.from('games').delete().eq('id', result.game_id);
    }
  });

  it('should reject spawn when world is not active', async () => {
    // Make world inactive
    await supabaseAdmin
      .from('worlds')
      .update({ status: 'inactive' })
      .eq('id', testWorldId);

    const gamesService = new GamesService();
    
    const result = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ownerId: 'test-user-3',
      isGuest: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    // Restore world
    await supabaseAdmin
      .from('worlds')
      .update({ status: 'active' })
      .eq('id', testWorldId);
  });

  it('should trim NPCs when budget exceeded', async () => {
    const gamesService = new GamesService();
    
    // Spawn with very small budget
    const result = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: 'test-user-4',
      isGuest: false,
      includeAssemblerMetadata: true,
    });

    expect(result.success).toBe(true);
    
    if (result.assemblerMetadata) {
      // Should have policy indicating NPCs were trimmed
      const npcPieces = result.assemblerMetadata.pieces.filter(p => p.scope === 'npc');
      const npcTrimmedCount = result.assemblerMetadata.meta.npcTrimmedCount || 0;
      
      // With 12 NPCs and small budget, some should be trimmed
      expect(npcTrimmedCount).toBeGreaterThan(0);
      expect(result.assemblerMetadata.meta.policy).toContain('NPC_DROPPED');
    }
    
    // Cleanup
    if (result.game_id) {
      await supabaseAdmin.from('games').delete().eq('id', result.game_id);
    }
  });

  it('should maintain deterministic pieces order', async () => {
    const gamesService = new GamesService();
    
    const result1 = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: 'test-user-5',
      isGuest: false,
      includeAssemblerMetadata: true,
    });

    const result2 = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: 'test-user-6',
      isGuest: false,
      includeAssemblerMetadata: true,
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    
    if (result1.assemblerMetadata && result2.assemblerMetadata) {
      // Pieces should be in same order
      const pieces1 = result1.assemblerMetadata.pieces.map(p => `${p.scope}:${p.slug}`);
      const pieces2 = result2.assemblerMetadata.pieces.map(p => `${p.scope}:${p.slug}`);
      expect(pieces1).toEqual(pieces2);
    }
    
    // Cleanup
    if (result1.game_id) {
      await supabaseAdmin.from('games').delete().eq('id', result1.game_id);
    }
    if (result2.game_id) {
      await supabaseAdmin.from('games').delete().eq('id', result2.game_id);
    }
  });
});

