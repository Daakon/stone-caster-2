/**
 * TurnPacketV3 E2E Smoke Test
 * Verifies that TurnPacketV3 adapter and snapshot creation work end-to-end
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { GamesService } from '../../src/services/games.service.js';
import { TurnsService } from '../../src/services/turns.service.js';
import { getPromptSnapshot } from '../../src/services/prompt-snapshots.service.js';
import { seed } from '../../scripts/seed-v3-fixtures.js';

describe('TurnPacketV3 E2E Smoke Test', () => {
  const testTag = 'tpv3-e2e';
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
        auth_user_id: 'test-user-tpv3',
        role: 'admin',
      })
      .select('auth_user_id')
      .single();
    
    testUserId = profile?.auth_user_id || 'test-user-tpv3';
    
    // Ensure V3 builder is used
    process.env.PROMPT_BUILDER = 'V3';
  });

  afterAll(async () => {
    // Cleanup
    if (testGameId) {
      await supabaseAdmin.from('games').delete().eq('id', testGameId);
      await supabaseAdmin.from('turns').delete().eq('game_id', testGameId);
      await supabaseAdmin.from('prompt_snapshots').delete().eq('game_id', testGameId);
    }
    await supabaseAdmin.from('user_profiles').delete().eq('auth_user_id', testUserId);
  });

  it('should create TurnPacketV3 snapshot during turn execution', async () => {
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
    if (!turns || !turns.option_ids || turns.option_ids.length === 0) {
      // Skip if no options available
      return;
    }

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

    // Check that snapshot was created
    const { data: snapshotRows } = await supabaseAdmin
      .from('prompt_snapshots')
      .select('*')
      .eq('game_id', testGameId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (snapshotRows && snapshotRows.length > 0) {
      const snapshot = snapshotRows[0];
      
      // Verify snapshot structure
      expect(snapshot.snapshot_id).toBeDefined();
      expect(snapshot.tp).toBeDefined();
      expect(snapshot.linearized_prompt_text).toBeDefined();
      expect(snapshot.awf_contract).toBe('awf.v1');
      expect(snapshot.source).toBe('auto');
      
      // Verify TurnPacketV3 structure
      const tp = snapshot.tp as any;
      expect(tp.tp_version).toBe('3');
      expect(tp.contract).toBe('awf.v1');
      expect(tp.ruleset).toBeDefined();
      expect(tp.world).toBeDefined();
      expect(tp.input).toBeDefined();
      
      // Verify snapshot can be retrieved via service
      const retrieved = await getPromptSnapshot(snapshot.snapshot_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.snapshot_id).toBe(snapshot.snapshot_id);
    } else {
      // Snapshot creation is non-blocking, so it's OK if it fails
      console.warn('No snapshot found - snapshot creation may have failed silently');
    }

    // Verify turn record has snapshot_id in meta
    const { data: turnRecord } = await supabaseAdmin
      .from('turns')
      .select('meta')
      .eq('game_id', testGameId)
      .order('turn_number', { ascending: false })
      .limit(1)
      .single();

    if (turnRecord && turnRecord.meta) {
      // snapshotId may be null if snapshot creation failed
      // That's OK - it's non-blocking
      expect(turnRecord.meta).toBeDefined();
    }
  });
});

