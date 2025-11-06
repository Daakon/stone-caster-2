#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Complete Migration Generator');
console.log('===============================');
console.log('');

// Migration files in order
const migrations = [
  '20250131_fix_worlds_uuid_safe_final.sql',
  '20250131_create_rulesets_table_fixed_v2.sql',
  '20250131_admin_associations_phase_b_safe_fixed_v7.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql',
  '20250205_add_npc_user_ownership.sql',
  '20250205_npc_visibility_and_authors_fixed.sql'
];

console.log('📋 COMPLETE MIGRATION SQL');
console.log('=========================');
console.log('');
console.log('⚠️  IMPORTANT: Copy and paste this ENTIRE SQL block into your Supabase SQL Editor');
console.log('   This combines all 9 migrations into one atomic transaction');
console.log('');

console.log('-- ============================================================================');
console.log('-- COMPLETE ADMIN MIGRATION (ALL 9 MIGRATIONS COMBINED)');
console.log('-- ============================================================================');
console.log('');

console.log('BEGIN;');
console.log('');

let allSQL = '';

// Read and combine all migrations
migrations.forEach((migrationFile, index) => {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
  
  if (fs.existsSync(migrationPath)) {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`-- ============================================================================`);
    console.log(`-- MIGRATION ${index + 1}/9: ${migrationFile}`);
    console.log(`-- ============================================================================`);
    console.log('');
    
    // Clean up the SQL (remove BEGIN/COMMIT from individual migrations)
    const cleanedSQL = migrationSQL
      .replace(/^BEGIN;?\s*/gm, '')
      .replace(/^COMMIT;?\s*/gm, '')
      .trim();
    
    console.log(cleanedSQL);
    console.log('');
    
    allSQL += cleanedSQL + '\n\n';
  } else {
    console.log(`-- ❌ Migration file not found: ${migrationFile}`);
    console.log('');
  }
});

console.log('-- ============================================================================');
console.log('-- END OF ALL MIGRATIONS');
console.log('-- ============================================================================');
console.log('');
console.log('COMMIT;');
console.log('');

console.log('📝 INSTRUCTIONS:');
console.log('1. Copy the ENTIRE SQL block above (from BEGIN; to COMMIT;)');
console.log('2. Paste it into your Supabase SQL Editor');
console.log('3. Click "Run"');
console.log('4. Wait for completion');
console.log('');
console.log('✅ AFTER THIS SINGLE MIGRATION:');
console.log('   Your frontend will work without the visibility error');
console.log('');
console.log('🔍 TO VERIFY:');
console.log('   Check if npcs table has: id, name, visibility, user_id, author_name, author_type');
console.log('');

// Also create a file with the complete SQL
const completeSQL = `-- ============================================================================
-- COMPLETE ADMIN MIGRATION (ALL 9 MIGRATIONS COMBINED)
-- ============================================================================

BEGIN;

${allSQL}

-- ============================================================================
-- END OF ALL MIGRATIONS
-- ============================================================================

COMMIT;`;

fs.writeFileSync('complete-migration.sql', completeSQL);
console.log('💾 Complete migration SQL saved to: complete-migration.sql');
console.log('   You can also copy from this file if needed');












