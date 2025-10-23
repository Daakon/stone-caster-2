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

async function runMigration(migrationFile) {
  console.log(`\n📄 Running migration: ${migrationFile}`);
  
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`✅ Read migration file (${sql.length} characters)`);
    
    // For now, just display the SQL content for manual execution
    console.log('\n📝 SQL Content:');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log(`\n✅ Migration ${migrationFile} displayed successfully`);
    console.log('⚠️  Please copy and paste the SQL above into your Supabase SQL Editor');
    console.log('⚠️  Press Enter to continue to the next migration...');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to read migration ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Simple Migration Runner');
  console.log('==========================');
  
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
  
  console.log(`📋 Running ${migrations.length} migrations...`);
  console.log('⚠️  This will display each migration for manual execution in Supabase SQL Editor');
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`\n🔄 Migration ${i + 1}/${migrations.length}: ${migration}`);
    
    const success = await runMigration(migration);
    if (!success) {
      console.error(`\n❌ Migration ${migration} failed. Stopping execution.`);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All migrations displayed successfully!');
  console.log('✅ Please execute them in Supabase SQL Editor in the order shown');
}

main().catch(error => {
  console.error('❌ Migration runner failed:', error.message);
  process.exit(1);
});
