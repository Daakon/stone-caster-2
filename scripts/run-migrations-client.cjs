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

async function runMigration1() {
  console.log('\n📄 Migration 1: Safe Worlds UUID Migration');
  
  try {
    // Check if world_id_mapping table exists
    const mappingExists = await checkTableExists('world_id_mapping');
    if (mappingExists) {
      console.log('✅ world_id_mapping table already exists');
      return true;
    }
    
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250131_fix_worlds_uuid_safe.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 1 failed:', error.message);
    return false;
  }
}

async function runMigration2() {
  console.log('\n📄 Migration 2: Create Rulesets Table');
  
  try {
    const rulesetsExists = await checkTableExists('rulesets');
    if (rulesetsExists) {
      console.log('✅ rulesets table already exists');
      return true;
    }
    
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250131_create_rulesets_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 2 failed:', error.message);
    return false;
  }
}

async function runMigration3() {
  console.log('\n📄 Migration 3: Admin Associations Phase B');
  
  try {
    const entriesExists = await checkTableExists('entries');
    if (entriesExists) {
      console.log('✅ entries table already exists');
      return true;
    }
    
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250131_admin_associations_phase_b_safe.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 3 failed:', error.message);
    return false;
  }
}

async function runMigration4() {
  console.log('\n📄 Migration 4: Admin Publishing Phase C');
  
  try {
    const revisionsExists = await checkTableExists('ruleset_revisions');
    if (revisionsExists) {
      console.log('✅ ruleset_revisions table already exists');
      return true;
    }
    
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250131_admin_publishing_phase_c.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 4 failed:', error.message);
    return false;
  }
}

async function runMigration5() {
  console.log('\n📄 Migration 5: Add Prompt Fields');
  
  try {
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250131_add_prompt_fields.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 5 failed:', error.message);
    return false;
  }
}

async function runMigration6() {
  console.log('\n📄 Migration 6: Segments Scope Cleanup');
  
  try {
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250204_segments_scope_cleanup.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 6 failed:', error.message);
    return false;
  }
}

async function runMigration7() {
  console.log('\n📄 Migration 7: Prompt Segments Ref Integrity');
  
  try {
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250205_prompt_segments_ref_integrity.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 7 failed:', error.message);
    return false;
  }
}

async function runMigration8() {
  console.log('\n📄 Migration 8: Add NPC User Ownership');
  
  try {
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250205_add_npc_user_ownership.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 8 failed:', error.message);
    return false;
  }
}

async function runMigration9() {
  console.log('\n📄 Migration 9: NPC Visibility and Authors (Fixed)');
  
  try {
    console.log('⚠️  This migration requires direct SQL execution');
    console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
    console.log('='.repeat(80));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250205_npc_visibility_and_authors_fixed.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(sql);
    console.log('='.repeat(80));
    
    console.log('⚠️  Press Enter after executing the SQL above...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration 9 failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Interactive Migration Runner');
  console.log('================================');
  console.log('⚠️  This will guide you through running each migration manually');
  console.log('⚠️  You will need to copy/paste SQL into Supabase SQL Editor');
  
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Cannot connect to Supabase. Please check your credentials.');
    process.exit(1);
  }
  
  console.log('\n📋 Running 9 migrations interactively...');
  
  const migrations = [
    runMigration1,
    runMigration2,
    runMigration3,
    runMigration4,
    runMigration5,
    runMigration6,
    runMigration7,
    runMigration8,
    runMigration9
  ];
  
  for (let i = 0; i < migrations.length; i++) {
    console.log(`\n🔄 Migration ${i + 1}/9`);
    
    const success = await migrations[i]();
    if (!success) {
      console.error(`\n❌ Migration ${i + 1} failed. Stopping execution.`);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All migrations completed successfully!');
  console.log('✅ Database is ready for the admin panel');
}

main().catch(error => {
  console.error('❌ Migration runner failed:', error.message);
  process.exit(1);
});
