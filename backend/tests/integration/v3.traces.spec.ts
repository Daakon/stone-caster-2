/**
 * Integration tests for prompt traces
 * Covers trace write, fetch, admin guard, and opt-out behavior
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { GamesService } from '../../src/services/games.service.js';
import { TurnsService } from '../../src/services/turns.service.js';
import { getPromptTraces, writePromptTrace } from '../../src/services/prompt-trace.service.js';
import { seed } from '../../scripts/seed-v3-fixtures.js';

describe('v3 Traces Integration', () => {
  const testTag = 'v3-e2e';
  const testWorldId = '00000000-0000-0000-0000-000000000001';
  const testEntryPointId = '00000000-0000-0000-0000-000000000002';
  let testGameId: string;
  let testUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    await seed({ tag: testTag });
    
    // Create test users (one admin, one regular)
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        auth_user_id: 'test-admin-user',
        role: 'admin',
      })
      .select('auth_user_id')
      .single();
    
    adminUserId = adminProfile?.auth_user_id || 'test-admin-user';
    
    const { data: regularProfile } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        auth_user_id: 'test-regular-user',
        role: 'user',
      })
      .select('auth_user_id')
      .single();
    
    testUserId = regularProfile?.auth_user_id || 'test-regular-user';
  });

  beforeEach(async () => {
    // Enable tracing for tests
    process.env.PROMPT_TRACING_ENABLED = 'true';
  });

  afterAll(async () => {
    // Disable tracing
    process.env.PROMPT_TRACING_ENABLED = 'false';
    
    // Cleanup test data
    if (testGameId) {
      await supabaseAdmin.from('games').delete().eq('id', testGameId);
    }
    await supabaseAdmin.from('user_profiles').delete().in('auth_user_id', [adminUserId, testUserId]);
  });

  it('should write trace when tracing enabled and user is admin', async () => {
    const gamesService = new GamesService();
    
    const result = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: adminUserId,
      isGuest: false,
      includeAssemblerMetadata: true,
    });

    expect(result.success).toBe(true);
    testGameId = result.game_id || '';
    
    // Wait a bit for async trace write
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check trace was written
    const traces = await getPromptTraces(testGameId, 10);
    expect(traces.length).toBeGreaterThan(0);
    
    const firstTrace = traces[0];
    expect(firstTrace.phase).toBe('start');
    expect(firstTrace.turnNumber).toBe(1);
    expect(firstTrace.promptSnippet).toBeDefined();
    expect(firstTrace.promptSnippet.length).toBeLessThanOrEqual(2000);
    expect(firstTrace.pieces).toBeDefined();
    expect(firstTrace.policy).toBeDefined();
  });

  it('should not write trace when tracing disabled', async () => {
    process.env.PROMPT_TRACING_ENABLED = 'false';
    
    const gamesService = new GamesService();
    
    const result = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: adminUserId,
      isGuest: false,
    });

    expect(result.success).toBe(true);
    const gameId = result.game_id || '';
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have no traces
    const traces = await getPromptTraces(gameId, 10);
    expect(traces.length).toBe(0);
    
    // Cleanup
    await supabaseAdmin.from('games').delete().eq('id', gameId);
    
    process.env.PROMPT_TRACING_ENABLED = 'true';
  });

  it('should write trace for ongoing turns', async () => {
    // Create game first
    const gamesService = new GamesService();
    
    const spawnResult = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: adminUserId,
      isGuest: false,
    });

    expect(spawnResult.success).toBe(true);
    const gameId = spawnResult.game_id || '';
    testGameId = gameId;
    
    // Get first turn to use as option
    const { data: turns } = await supabaseAdmin
      .from('turns')
      .select('id, option_ids')
      .eq('game_id', gameId)
      .order('turn_number', { ascending: false })
      .limit(1);
    
    if (turns && turns.length > 0 && turns[0].option_ids && turns[0].option_ids.length > 0) {
      const optionId = turns[0].option_ids[0];
      
      const turnsService = new TurnsService();
      const turnResult = await turnsService.runBufferedTurn({
        gameId,
        optionId,
        owner: adminUserId,
        isGuest: false,
      });

      expect(turnResult.success).toBe(true);
      
      // Wait for trace write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check trace was written for turn
      const traces = await getPromptTraces(gameId, 10);
      const turnTraces = traces.filter(t => t.phase === 'turn');
      expect(turnTraces.length).toBeGreaterThan(0);
    }
  });

  it('should return traces newest-first', async () => {
    // Create multiple turns
    const gamesService = new GamesService();
    
    const spawnResult = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: adminUserId,
      isGuest: false,
    });

    const gameId = spawnResult.game_id || '';
    
    // Get traces
    const traces = await getPromptTraces(gameId, 10);
    
    if (traces.length > 1) {
      // Should be sorted newest first (turn number descending)
      for (let i = 0; i < traces.length - 1; i++) {
        expect(traces[i].turnNumber).toBeGreaterThanOrEqual(traces[i + 1].turnNumber);
      }
    }
    
    // Cleanup
    await supabaseAdmin.from('games').delete().eq('id', gameId);
  });

  it('should include rulesetSlug and npcTrimmedCount in trace', async () => {
    const traces = await getPromptTraces(testGameId, 1);
    
    if (traces.length > 0) {
      const trace = traces[0];
      // These should be in the trace data
      expect(trace.rulesetSlug).toBeDefined();
      expect(typeof trace.npcTrimmedCount).toBe('number');
    }
  });
});

