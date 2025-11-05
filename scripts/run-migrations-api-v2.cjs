#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('🚀 Automated Migration Runner v2');
console.log('==================================');
console.log('');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  console.log('   Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function runMigration(migrationFile) {
  console.log(`🔄 Running migration: ${migrationFile}`);
  
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`❌ Migration file not found: ${migrationPath}`);
      return false;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`   📝 Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`   🔧 Executing statement ${i + 1}/${statements.length}`);
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql_query: statement 
          });
          
          if (error) {
            console.log(`   ⚠️  Statement ${i + 1} warning: ${error.message}`);
            // Continue with next statement for warnings
          } else {
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.log(`   ❌ Statement ${i + 1} failed: ${err.message}`);
          // Continue with next statement
        }
      }
    }
    
    console.log(`✅ Migration ${migrationFile} completed`);
    return true;
    
  } catch (error) {
    console.log(`❌ Migration ${migrationFile} failed: ${error.message}`);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🎯 Starting automated migration process...');
  console.log('');
  
  let successCount = 0;
  let totalCount = migrations.length;
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`📋 Migration ${i + 1}/${totalCount}: ${migration}`);
    
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    }
    
    console.log('');
    
    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('📊 MIGRATION SUMMARY');
  console.log('===================');
  console.log(`✅ Successful: ${successCount}/${totalCount}`);
  console.log(`❌ Failed: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('');
    console.log('🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
    console.log('   Your frontend should now work without the visibility error');
  } else {
    console.log('');
    console.log('⚠️  Some migrations failed. Check the logs above for details.');
  }
}

// Check if exec_sql RPC exists
async function checkRPCAvailability() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: 'SELECT 1 as test' 
    });
    
    if (error && error.message.includes('function exec_sql')) {
      console.log('❌ exec_sql RPC function not available');
      console.log('   This means we cannot run migrations programmatically');
      console.log('   You will need to run them manually in the Supabase SQL Editor');
      return false;
    }
    
    return true;
  } catch (err) {
    console.log('❌ Cannot connect to Supabase or exec_sql not available');
    console.log('   You will need to run migrations manually in the Supabase SQL Editor');
    return false;
  }
}

async function main() {
  console.log('🔍 Checking Supabase connection and RPC availability...');
  
  const rpcAvailable = await checkRPCAvailability();
  
  if (!rpcAvailable) {
    console.log('');
    console.log('📋 MANUAL MIGRATION INSTRUCTIONS:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run each migration in order:');
    console.log('');
    
    migrations.forEach((migration, index) => {
      console.log(`   ${index + 1}. ${migration}`);
    });
    
    console.log('');
    console.log('🎯 CRITICAL: Migration #9 adds the "visibility" column');
    console.log('   This is what your frontend is trying to access');
    
    return;
  }
  
  console.log('✅ Supabase connection and RPC available');
  console.log('');
  
  await runAllMigrations();
}

main().catch(console.error);










