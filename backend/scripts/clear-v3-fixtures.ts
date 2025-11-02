#!/usr/bin/env tsx
/**
 * Clear v3 Test Fixtures
 * 
 * Removes only rows tagged with v3-e2e (or custom tag)
 * Safe to run in production if using --tag to scope
 * 
 * Usage:
 *   pnpm clear:v3                    # Clear default tag
 *   pnpm clear:v3 --tag custom-tag   # Clear custom tag
 */

import { supabaseAdmin } from '../src/services/supabase.js';

const DEFAULT_TAG = 'v3-e2e';

async function clear(tag: string = DEFAULT_TAG) {
  console.log(`🧹 Clearing v3 fixtures with tag: ${tag}`);

  try {
    // Clear NPC prompts (in prompting.prompts)
    const { error: promptsError } = await supabaseAdmin
      .from('prompting.prompts')
      .delete()
      .contains('metadata->tags', [tag]);
    
    if (promptsError) {
      console.warn('⚠️  Error clearing prompts:', promptsError);
    } else {
      console.log('✅ Cleared NPC prompts');
    }

    // Clear entry_point_rulesets (delete all for our entry point)
    const entryPointId = '00000000-0000-0000-0000-000000000002';
    const { error: rulesetsError } = await supabaseAdmin
      .from('entry_point_rulesets')
      .delete()
      .eq('entry_point_id', entryPointId);
    
    if (rulesetsError) {
      console.warn('⚠️  Error clearing entry_point_rulesets:', rulesetsError);
    } else {
      console.log('✅ Cleared entry_point_rulesets');
    }

    // Clear entry_points
    const { error: entryPointsError } = await supabaseAdmin
      .from('entry_points')
      .delete()
      .contains('tags', [tag]);
    
    if (entryPointsError) {
      console.warn('⚠️  Error clearing entry_points:', entryPointsError);
    } else {
      console.log('✅ Cleared entry_points');
    }

    // Clear rulesets
    const { error: rulesetsError2 } = await supabaseAdmin
      .from('rulesets')
      .delete()
      .contains('tags', [tag]);
    
    if (rulesetsError2) {
      console.warn('⚠️  Error clearing rulesets:', rulesetsError2);
    } else {
      console.log('✅ Cleared rulesets');
    }

    // Clear worlds (last, as others may reference it)
    const { error: worldsError } = await supabaseAdmin
      .from('worlds')
      .delete()
      .contains('tags', [tag]);
    
    if (worldsError) {
      console.warn('⚠️  Error clearing worlds:', worldsError);
    } else {
      console.log('✅ Cleared worlds');
    }

    // Bust cache
    const cacheBusted = bustCache(`ruleset:${entryPointId}`);
    console.log(`✅ Cache busted: ${cacheBusted} entries`);
    
    console.log('\n✨ Clear complete!');
  } catch (error) {
    console.error('❌ Clear failed:', error);
    throw error;
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf('--tag');
  const tag = tagIndex >= 0 && args[tagIndex + 1] ? args[tagIndex + 1] : DEFAULT_TAG;
  
  clear(tag)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { clear };

