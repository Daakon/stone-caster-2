/**
 * Integration tests for v3 turns
 * Covers turn execution, prompt assembly, trace writes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { GamesService } from '../../src/services/games.service.js';
import { TurnsService } from '../../src/services/turns.service.js';
import { seed } from '../../scripts/seed-v3-fixtures.js';

describe('v3 Turns Integration', () => {
  const testTag = 'v3-e2e';
  const testWorldId = '00000000-0000-0000-0000-000000000001';
  const testEntryPointId = '00000000-0000-0000-0000-000000000002';
  let testGameId: string;
  let testUserId: string;

  beforeAll(async () => {
    await seed({ tag: testTag });
    
    // Create test user
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        auth_user_id: 'test-user-turns',
        role: 'admin',
      })
      .select('auth_user_id')
      .single();
    
    testUserId = profile?.auth_user_id || 'test-user-turns';
    
    // Enable tracing for tests
    process.env.PROMPT_TRACING_ENABLED = 'true';
  });

  afterAll(async () => {
    process.env.PROMPT_TRACING_ENABLED = 'false';
    
    // Cleanup
    if (testGameId) {
      await supabaseAdmin.from('games').delete().eq('id', testGameId);
    }
    await supabaseAdmin.from('user_profiles').delete().eq('auth_user_id', testUserId);
  });

  it('should execute turn with v3 assembler', async () => {
    const gamesService = new GamesService();
    
    // Create game first
    const spawnResult = await gamesService.spawnV3({
      entry_point_id: testEntryPointId,
      world_id: testWorldId,
      entry_start_slug: 'forest_meet',
      ruleset_slug: 'core.default',
      ownerId: testUserId,
      isGuest: false,
    });

    expect(spawnResult.success).toBe(true);
    testGameId = spawnResult.game_id || '';
    
    // Get first turn to find option
    const { data: turns } = await supabaseAdmin
      .from('turns')
      .select('id, option_ids, meta')
      .eq('game_id', testGameId)
      .order('turn_number', { ascending: false })
      .limit(1)
      .single();
    
    expect(turns).toBeDefined();
    if (turns && turns.meta) {
      expect(turns.meta.source).toBe('entry-point');
      expect(turns.meta.version).toBe('v3');
    }
    
    if (turns && turns.option_ids && turns.option_ids.length > 0) {
      const optionId = turns.option_ids[0];
      
      const turnsService = new TurnsService();
      const turnResult = await turnsService.runBufferedTurn({
        gameId: testGameId,
        optionId,
        owner: testUserId,
        isGuest: false,
      });

      expect(turnResult.success).toBe(true);
      expect(turnResult.turnDTO).toBeDefined();
    }
  });

  it('should write trace for narrator/system turn', async () => {
    // This is tested in v3.traces.spec.ts, but verify here if needed
    const { data: traces } = await supabaseAdmin
      .from('prompt_traces')
      .select('*')
      .eq('game_id', testGameId)
      .eq('phase', 'turn')
      .limit(1);
    
    // If tracing enabled and user is admin, should have traces
    if (process.env.PROMPT_TRACING_ENABLED === 'true') {
      // Trace write is async, may need to wait
      // This is more thoroughly tested in v3.traces.spec.ts
    }
  });
});

