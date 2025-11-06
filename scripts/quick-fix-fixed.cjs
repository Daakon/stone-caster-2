#!/usr/bin/env node

console.log('🚨 URGENT: Database Migration Required (FIXED VERSION)');
console.log('===================================================');
console.log('');
console.log('❌ ERROR: column npcs.visibility does not exist');
console.log('');
console.log('🔧 SOLUTION: Run these 9 database migrations in order');
console.log('');
console.log('📋 STEP 1: Go to your Supabase Dashboard');
console.log('   https://supabase.com/dashboard/project/[your-project]/sql');
console.log('');
console.log('📋 STEP 2: Execute these migrations in order:');
console.log('');

const migrations = [
  '1. 20250131_fix_worlds_uuid_safe_fixed.sql ⭐ FIXED VERSION',
  '2. 20250131_create_rulesets_table.sql', 
  '3. 20250131_admin_associations_phase_b_safe.sql',
  '4. 20250131_admin_publishing_phase_c.sql',
  '5. 20250131_add_prompt_fields.sql',
  '6. 20250204_segments_scope_cleanup.sql',
  '7. 20250205_prompt_segments_ref_integrity.sql',
  '8. 20250205_add_npc_user_ownership.sql',
  '9. 20250205_npc_visibility_and_authors_fixed.sql ⭐ MOST IMPORTANT'
];

migrations.forEach(migration => {
  console.log(`   ${migration}`);
});

console.log('');
console.log('🎯 CRITICAL: Migration #9 adds the "visibility" column');
console.log('   This is what your frontend is trying to access');
console.log('');
console.log('🔧 FIXED: Migration #1 no longer references non-existent "hash" column');
console.log('');
console.log('📝 INSTRUCTIONS:');
console.log('1. Copy each migration SQL from supabase/migrations/');
console.log('2. Paste into Supabase SQL Editor');
console.log('3. Click "Run"');
console.log('4. Wait for completion');
console.log('5. Move to next migration');
console.log('');
console.log('✅ AFTER ALL 9 MIGRATIONS:');
console.log('   Your frontend will work without the visibility error');
console.log('');
console.log('🔍 TO VERIFY:');
console.log('   Check if npcs table has: id, name, visibility, user_id, author_name, author_type');
console.log('');
console.log('📁 Migration files are in: supabase/migrations/');
console.log('   Use the FIXED version for migration #1');












