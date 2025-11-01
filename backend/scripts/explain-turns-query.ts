#!/usr/bin/env node
/**
 * Phase 1 Polish: EXPLAIN ANALYZE sanity check for turns pagination index usage
 * 
 * This script verifies that the (game_id, turn_number ASC) index is being used
 * for the paginated turns query. Run locally (dev only, skipped in CI).
 * 
 * Usage: pnpm tsx backend/scripts/explain-turns-query.ts [gameId]
 */

import { supabaseAdmin } from '../src/services/supabase.js';
import { config } from 'dotenv';

// Load env vars
config();

const GAME_ID = process.argv[2] || '00000000-0000-0000-0000-000000000000';

async function explainQuery() {
  console.log('[EXPLAIN] Checking index usage for turns pagination query...');
  console.log(`[EXPLAIN] Game ID: ${GAME_ID}`);
  
  try {
    // Execute EXPLAIN ANALYZE via raw SQL
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        EXPLAIN ANALYZE
        SELECT * FROM turns
        WHERE game_id = $1
          AND turn_number > 0
        ORDER BY turn_number ASC
        LIMIT 21;
      `,
      params: [GAME_ID],
    });

    if (error) {
      console.error('[EXPLAIN] Error:', error);
      
      // Fallback: Try direct query to see execution plan in logs
      console.log('[EXPLAIN] Falling back to direct query (check logs for plan)...');
      const { data: turns, error: queryError } = await supabaseAdmin
        .from('turns')
        .select('*')
        .eq('game_id', GAME_ID)
        .gt('turn_number', 0)
        .order('turn_number', { ascending: true })
        .limit(21);
      
      if (queryError) {
        console.error('[EXPLAIN] Query error:', queryError);
        process.exit(1);
      }
      
      console.log(`[EXPLAIN] Query executed successfully, returned ${turns?.length || 0} rows`);
      console.log('[EXPLAIN] Note: Check database logs or use psql EXPLAIN ANALYZE to verify index usage');
      console.log('[EXPLAIN] Expected: Index Scan using idx_turns_game_turn_number_asc');
    } else {
      console.log('[EXPLAIN] Execution plan:', JSON.stringify(data, null, 2));
      
      // Parse plan to verify index usage
      const planStr = JSON.stringify(data);
      if (planStr.includes('idx_turns_game_turn_number_asc') || 
          planStr.includes('Index Scan') ||
          planStr.includes('index')) {
        console.log('✅ [EXPLAIN] Index usage detected in execution plan');
      } else {
        console.log('⚠️  [EXPLAIN] Warning: Index usage not clearly visible in plan');
        console.log('[EXPLAIN] Verify manually with: EXPLAIN ANALYZE SELECT * FROM turns WHERE game_id = $1 ORDER BY turn_number ASC LIMIT 21;');
      }
    }
    
    // Also check that the index exists
    const { data: indexes, error: idxError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'turns' 
          AND indexname LIKE '%turn_number%';
      `,
    });
    
    if (!idxError && indexes) {
      console.log('\n[EXPLAIN] Related indexes found:');
      console.log(JSON.stringify(indexes, null, 2));
    }
    
    console.log('\n[EXPLAIN] Sanity check complete.');
  } catch (err) {
    console.error('[EXPLAIN] Unexpected error:', err);
    process.exit(1);
  }
}

// Only run if not in CI
if (process.env.CI !== '1' && process.env.NODE_ENV !== 'test') {
  explainQuery().catch(console.error);
} else {
  console.log('[EXPLAIN] Skipped in CI/test environment');
}

