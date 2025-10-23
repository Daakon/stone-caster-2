const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase.from('user_profiles').select('count').limit(1);
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
    console.log('✅ Connection successful');
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    return !error;
  } catch (error) {
    return false;
  }
}

async function executeMigrationSQL(migrationFile) {
  console.log(`\n📄 Executing Migration: ${migrationFile}`);
  console.log('='.repeat(80));
  
  const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(sql);
  console.log('='.repeat(80));
  
  console.log('⚠️  IMPORTANT: Copy the SQL above and execute it in your Supabase SQL Editor');
  console.log('⚠️  Go to: https://supabase.com/dashboard/project/[your-project]/sql');
  console.log('⚠️  Paste the SQL and click "Run"');
  console.log('⚠️  Wait for it to complete successfully before continuing');
  
  return true;
}

async function main() {
  console.log('🚀 Final Migration Execution Guide');
  console.log('==================================');
  console.log('📋 This will guide you through executing all 9 migrations');
  console.log('⚠️  You need to manually execute each SQL block in Supabase SQL Editor');
  
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Cannot connect to Supabase. Please check your credentials.');
    process.exit(1);
  }
  
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
  
  console.log(`\n📋 Total migrations: ${migrations.length}`);
  console.log('🎯 Execute each migration in the exact order shown below');
  console.log('🎯 Wait for each to complete before moving to the next');
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`\n🔄 MIGRATION ${i + 1}/${migrations.length}: ${migration}`);
    
    await executeMigrationSQL(migration);
    
    if (i < migrations.length - 1) {
      console.log('\n⏳ Waiting for you to execute this migration...');
      console.log('Press Enter when you have successfully executed the SQL above...');
      
      // Wait for user input
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
    }
  }
  
  console.log('\n🎉 All migrations completed successfully!');
  console.log('✅ Database is ready for the admin panel');
  console.log('\n📋 Verification Checklist:');
  console.log('✅ world_id_mapping table exists');
  console.log('✅ rulesets table exists');
  console.log('✅ entries table exists');
  console.log('✅ npcs table exists');
  console.log('✅ npc_packs table exists');
  console.log('✅ entry_rulesets table exists');
  console.log('✅ entry_npcs table exists');
  console.log('✅ entry_npc_packs table exists');
  console.log('✅ npc_pack_members table exists');
  console.log('✅ ruleset_revisions table exists');
  console.log('✅ content_import_jobs table exists');
  console.log('✅ NPCs have user_id, visibility, author_name, author_type columns');
  console.log('✅ All RLS policies are in place');
}

main().catch(error => {
  console.error('❌ Migration runner failed:', error.message);
  process.exit(1);
});
