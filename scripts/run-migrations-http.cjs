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

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles?select=count&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ Connection successful');
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

async function executeSQL(sql) {
  console.log('📝 Executing SQL via HTTP...');
  
  try {
    // Try the SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({ sql_query: sql })
    });
    
    if (!response.ok) {
      console.log(`⚠️  SQL endpoint returned ${response.status}: ${response.statusText}`);
      
      // Try alternative SQL execution endpoint
      const altResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ sql: sql })
      });
      
      if (!altResponse.ok) {
        throw new Error(`Both SQL endpoints failed: ${response.status} and ${altResponse.status}`);
      }
      
      const result = await altResponse.json();
      console.log('✅ SQL executed successfully via alternative endpoint');
      return { success: true, data: result };
    }
    
    const result = await response.json();
    console.log('✅ SQL executed successfully');
    return { success: true, data: result };
    
  } catch (error) {
    console.error('❌ SQL execution failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runMigration(migrationFile) {
  console.log(`\n📄 Running migration: ${migrationFile}`);
  
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`✅ Read migration file (${sql.length} characters)`);
    
    // For now, let's try to execute the entire SQL block as one statement
    console.log('📝 Executing migration as single SQL block...');
    
    const result = await executeSQL(sql);
    if (!result.success) {
      console.error(`❌ Migration failed:`, result.error);
      return false;
    }
    
    console.log(`✅ Migration ${migrationFile} completed successfully`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to run migration ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 HTTP Migration Execution Runner');
  console.log('===================================');
  
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
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`\n🔄 Migration ${i + 1}/${migrations.length}: ${migration}`);
    
    const success = await runMigration(migration);
    if (!success) {
      console.error(`\n❌ Migration ${migration} failed. Stopping execution.`);
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
