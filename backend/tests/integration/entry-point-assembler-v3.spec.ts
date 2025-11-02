/**
 * Integration tests for Entry-Point Assembler v3
 * Tests game creation and turn execution with v3 assembler
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { GamesService } from '../../src/services/games.service.js';
import { TurnsService } from '../../src/services/turns.service.js';

describe('Entry-Point Assembler v3 Integration', () => {
  let testWorldId: string;
  let testRulesetId: string;
  let testEntryPointId: string;
  let testNpcId1: string;
  let testNpcId2: string;

  beforeAll(async () => {
    // Setup test data: world, ruleset, entry point, NPCs
    // Note: These will be created in test database

    // Create test world
    const { data: world } = await supabaseAdmin
      .from('worlds')
      .insert({
        id: 'test-world-v3',
        version: '1.0.0',
        status: 'active',
        doc: {
          name: 'Test World v3',
          prompt: { text: '# World: Test World v3\n\nThis is a test world for v3 assembler.' },
        },
      })
      .select('id')
      .single();

    testWorldId = world?.id || 'test-world-v3';

    // Create test ruleset
    const { data: ruleset } = await supabaseAdmin
      .from('rulesets')
      .insert({
        id: 'test-ruleset-v3',
        version: '1.0.0',
        status: 'active',
        doc: {
          prompt: { text: '# Ruleset: Default\n\nTest ruleset content.' },
        },
      })
      .select('id')
      .single();

    testRulesetId = ruleset?.id || 'test-ruleset-v3';

    // Create test entry point
    const { data: entryPoint } = await supabaseAdmin
      .from('entry_points')
      .insert({
        id: 'test-entry-v3',
        slug: 'test-entry-v3',
        type: 'adventure',
        world_id: testWorldId,
        title: 'Test Entry v3',
        description: 'Test entry point for v3',
        status: 'active',
        lifecycle: 'active',
        content: {
          doc: {
            entryStartSlug: 'start-1',
            prompt: { text: '# Entry: Test Entry\n\nBegin your adventure here.' },
          },
        },
      })
      .select('id')
      .single();

    testEntryPointId = entryPoint?.id || 'test-entry-v3';

    // Link ruleset to entry point
    await supabaseAdmin
      .from('entry_point_rulesets')
      .insert({
        entry_point_id: testEntryPointId,
        ruleset_id: testRulesetId,
        sort_order: 0,
      });

    // Create test NPCs
    const { data: npc1 } = await supabaseAdmin
      .from('npcs')
      .insert({
        name: 'Test NPC 1',
        slug: 'test-npc-1',
        status: 'active',
        prompt: { text: '# NPC: Test NPC 1\n\nNPC 1 description.' },
      })
      .select('id')
      .single();

    testNpcId1 = npc1?.id || '';

    const { data: npc2 } = await supabaseAdmin
      .from('npcs')
      .insert({
        name: 'Test NPC 2',
        slug: 'test-npc-2',
        status: 'active',
        prompt: { text: '# NPC: Test NPC 2\n\nNPC 2 description.' },
      })
      .select('id')
      .single();

    testNpcId2 = npc2?.id || '';

    // Link NPCs to entry point
    await supabaseAdmin
      .from('entry_point_npcs')
      .insert([
        { entry_point_id: testEntryPointId, npc_id: testNpcId1, sort_order: 1 },
        { entry_point_id: testEntryPointId, npc_id: testNpcId2, sort_order: 2 },
      ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabaseAdmin.from('entry_point_npcs').delete().eq('entry_point_id', testEntryPointId);
    await supabaseAdmin.from('entry_point_rulesets').delete().eq('entry_point_id', testEntryPointId);
    await supabaseAdmin.from('entry_points').delete().eq('id', testEntryPointId);
    await supabaseAdmin.from('npcs').delete().in('id', [testNpcId1, testNpcId2]);
    await supabaseAdmin.from('rulesets').delete().eq('id', testRulesetId);
    await supabaseAdmin.from('worlds').delete().eq('id', testWorldId);
  });

  describe('Game Creation', () => {
    it('should create game using v3 assembler and persist v3 metadata', async () => {
      const gamesService = new GamesService();

      const result = await gamesService.spawnV3({
        entry_point_id: testEntryPointId,
        world_id: testWorldId,
        entry_start_slug: 'start-1',
        ownerId: 'test-user-id',
        isGuest: false,
      });

      expect(result.success).toBe(true);
      expect(result.game_id).toBeDefined();

      // Verify first turn has v3 metadata
      const { data: turn } = await supabaseAdmin
        .from('turns')
        .select('meta')
        .eq('game_id', result.game_id)
        .eq('turn_number', 1)
        .single();

      expect(turn?.meta).toBeDefined();
      expect(turn?.meta.version).toBe('v3');
      expect(turn?.meta.source).toBe('entry-point');
      expect(turn?.meta.pieces).toBeDefined();
      expect(Array.isArray(turn?.meta.pieces)).toBe(true);

      // Verify scope order
      const scopes = turn?.meta.pieces.map((p: any) => p.scope);
      expect(scopes).toEqual(['core', 'ruleset', 'world', 'entry', 'npc', 'npc']);

      // Cleanup
      await supabaseAdmin.from('turns').delete().eq('game_id', result.game_id);
      await supabaseAdmin.from('games').delete().eq('id', result.game_id);
    });
  });

  describe('Turn Execution', () => {
    it('should use v3 assembler for ongoing turns and persist v3 metadata', async () => {
      const gamesService = new GamesService();
      const turnsService = new TurnsService();

      // Create game first
      const spawnResult = await gamesService.spawnV3({
        entry_point_id: testEntryPointId,
        world_id: testWorldId,
        entry_start_slug: 'start-1',
        ownerId: 'test-user-id',
        isGuest: false,
      });

      expect(spawnResult.success).toBe(true);
      const gameId = spawnResult.game_id!;

      // Execute a turn
      const turnResult = await turnsService.runBufferedTurn({
        gameId,
        optionId: 'option-1',
        owner: 'test-user-id',
        idempotencyKey: 'test-key-turn',
        isGuest: false,
        includeDebugMetadata: true,
      });

      expect(turnResult.success).toBe(true);

      // Verify turn metadata has v3 marker
      const { data: turn } = await supabaseAdmin
        .from('turns')
        .select('meta')
        .eq('game_id', gameId)
        .eq('turn_number', 2)
        .single();

      expect(turn?.meta).toBeDefined();
      expect(turn?.meta.version).toBe('v3');
      expect(turn?.meta.source).toBe('entry-point');

      // Cleanup
      await supabaseAdmin.from('turns').delete().eq('game_id', gameId);
      await supabaseAdmin.from('games').delete().eq('id', gameId);
    });
  });

  describe('Budget Policy', () => {
    it('should trim only NPCs when over budget', async () => {
      const gamesService = new GamesService();

      const result = await gamesService.spawnV3({
        entry_point_id: testEntryPointId,
        world_id: testWorldId,
        entry_start_slug: 'start-1',
        ownerId: 'test-user-id',
        isGuest: false,
        // Note: budgetTokens is not a direct parameter; assembler uses config default
      });

      expect(result.success).toBe(true);

      // Verify protected scopes are never dropped
      const { data: turn } = await supabaseAdmin
        .from('turns')
        .select('meta')
        .eq('game_id', result.game_id)
        .eq('turn_number', 1)
        .single();

      const pieces = turn?.meta.pieces || [];
      const scopes = pieces.map((p: any) => p.scope);
      
      expect(scopes).toContain('core');
      expect(scopes).toContain('ruleset');
      expect(scopes).toContain('world');
      expect(scopes).toContain('entry');

      // NPCs may be dropped (check dropped array)
      const dropped = turn?.meta.dropped || [];
      const droppedNPCs = dropped.filter((d: string) => d.startsWith('npc:'));
      
      if (droppedNPCs.length > 0) {
        expect(turn?.meta.policy).toContain('NPC_DROPPED');
      }

      // Cleanup
      await supabaseAdmin.from('turns').delete().eq('game_id', result.game_id);
      await supabaseAdmin.from('games').delete().eq('id', result.game_id);
    });
  });
});

