#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Database Migration Executor');
console.log('============================');
console.log('');
console.log('⚠️  IMPORTANT: You need to execute these migrations in your Supabase SQL Editor');
console.log('📋 Go to: https://supabase.com/dashboard/project/[your-project]/sql');
console.log('');

const migrations = [
  '20250131_fix_worlds_uuid_safe.sql',
  '20250131_create_rulesets_table.sql', 
  '20250131_admin_associations_phase_b_safe.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql',
  '20250205_add_npc_user_ownership.sql',
  '20250205_npc_visibility_and_authors_fixed.sql'
];

console.log('📋 MIGRATION ORDER:');
migrations.forEach((migration, index) => {
  console.log(`${index + 1}. ${migration}`);
});
console.log('');

console.log('🎯 CRITICAL: The 9th migration (npc_visibility_and_authors_fixed.sql) is the most important');
console.log('   This adds the "visibility" column that your frontend is trying to access.');
console.log('');

console.log('📝 STEP-BY-STEP INSTRUCTIONS:');
console.log('1. Open your Supabase Dashboard');
console.log('2. Go to SQL Editor');
console.log('3. Copy and paste each migration SQL (one at a time)');
console.log('4. Execute each migration completely before moving to the next');
console.log('5. Wait for each migration to complete successfully');
console.log('');

console.log('🔍 TO VERIFY MIGRATIONS WORKED:');
console.log('After running all 9 migrations, check if these tables/columns exist:');
console.log('- Table: npcs');
console.log('- Columns in npcs: id, name, visibility, user_id, author_name, author_type');
console.log('- Table: rulesets');
console.log('- Table: entries');
console.log('- Table: worlds_admin (view)');
console.log('');

console.log('🚨 IF YOU GET ERRORS:');
console.log('- Make sure you run migrations in the exact order shown above');
console.log('- Wait for each migration to complete before running the next');
console.log('- Check the Supabase logs for any error messages');
console.log('');

console.log('✅ AFTER ALL MIGRATIONS:');
console.log('Your frontend should work without the "column npcs.visibility does not exist" error');
console.log('');

// Display the first migration as an example
const firstMigrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrations[0]);
if (fs.existsSync(firstMigrationPath)) {
  console.log('📄 EXAMPLE - First Migration SQL:');
  console.log('=====================================');
  const firstMigration = fs.readFileSync(firstMigrationPath, 'utf8');
  console.log(firstMigration);
  console.log('=====================================');
  console.log('');
  console.log('💡 Copy the SQL above and paste it into your Supabase SQL Editor');
  console.log('   Then click "Run" to execute it.');
  console.log('');
  console.log('🔄 After the first migration completes, run this script again to see the next one.');
}

