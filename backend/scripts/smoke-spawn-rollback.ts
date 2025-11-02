#!/usr/bin/env tsx
/**
 * Phase 3.2: Smoke test for ephemeral transaction rollback
 * 
 * Calls POST /api/games with X-Test-Rollback: 1 header and verifies:
 * - Request succeeds (200/201)
 * - First turn has turn_number=1
 * - No persistent rows remain after response (transaction rolled back)
 * 
 * Usage:
 *   TEST_TX_ENABLED=true DATABASE_URL=postgresql://... tsx backend/scripts/smoke-spawn-rollback.ts
 */

import '../src/config/load-env.js';
import { config } from '../src/config/index.js';
import { supabaseAdmin } from '../src/services/supabase.js';

const API_URL = process.env.API_URL || `http://localhost:${config.port}`;

async function smokeTestSpawnRollback() {
  console.log('🧪 Smoke test: Spawn game with test transaction rollback');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   TEST_TX_ENABLED: ${process.env.TEST_TX_ENABLED || 'false'}`);
  console.log('');

  // Test data - replace with valid test values
  const testEntryPointId = process.env.TEST_ENTRY_POINT_ID || 'test-entry-point-1';
  const testWorldId = process.env.TEST_WORLD_ID || '00000000-0000-0000-0000-000000000001';
  const testEntryStartSlug = process.env.TEST_ENTRY_START_SLUG || 'test-entry-start-1';

  if (!process.env.TEST_TX_ENABLED || process.env.TEST_TX_ENABLED !== 'true') {
    console.error('❌ TEST_TX_ENABLED must be true to run smoke test');
    process.exit(1);
  }

  try {
    // Count games/turns before request
    const { count: gamesBefore } = await supabaseAdmin
      .from('games')
      .select('id', { count: 'exact', head: true });
    
    const { count: turnsBefore } = await supabaseAdmin
      .from('turns')
      .select('id', { count: 'exact', head: true });

    console.log(`📊 Before: ${gamesBefore || 0} games, ${turnsBefore || 0} turns`);

    // Make request with X-Test-Rollback header
    const response = await fetch(`${API_URL}/api/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Rollback': '1',
      },
      body: JSON.stringify({
        entry_point_id: testEntryPointId,
        world_id: testWorldId,
        entry_start_slug: testEntryStartSlug,
      }),
    });

    const responseBody = await response.json();

    console.log(`📡 Response status: ${response.status}`);
    console.log(`📦 Response body:`, JSON.stringify(responseBody, null, 2));

    // Verify success
    if (!response.ok || !responseBody.ok) {
      console.error('❌ Request failed:', responseBody);
      process.exit(1);
    }

    // Verify first_turn structure
    if (!responseBody.data?.first_turn) {
      console.error('❌ Missing first_turn in response');
      process.exit(1);
    }

    if (responseBody.data.first_turn.turn_number !== 1) {
      console.error(`❌ Expected turn_number=1, got ${responseBody.data.first_turn.turn_number}`);
      process.exit(1);
    }

    console.log('✅ Request succeeded with turn_number=1');

    // Wait a moment for transaction rollback
    await new Promise(resolve => setTimeout(resolve, 500));

    // Count games/turns after request (should be unchanged due to rollback)
    const { count: gamesAfter } = await supabaseAdmin
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('id', responseBody.data.game_id);
    
    const { count: turnsAfter } = await supabaseAdmin
      .from('turns')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', responseBody.data.game_id);

    console.log(`📊 After: ${gamesAfter || 0} games with created ID, ${turnsAfter || 0} turns with created game_id`);

    if ((gamesAfter || 0) > 0 || (turnsAfter || 0) > 0) {
      console.error('❌ Transaction rollback failed - rows still exist after request');
      console.error(`   Found ${gamesAfter || 0} games and ${turnsAfter || 0} turns`);
      process.exit(1);
    }

    console.log('✅ Transaction rolled back successfully - no persistent rows');
    console.log('');
    console.log('🎉 Smoke test passed!');

  } catch (error) {
    console.error('❌ Smoke test failed:', error);
    process.exit(1);
  }
}

smokeTestSpawnRollback();

