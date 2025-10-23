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

async function runMigration(migrationFile) {
  console.log(`\n📄 Running migration: ${migrationFile}`);
  
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`✅ Read migration file (${sql.length} characters)`);
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`  ${i + 1}. Executing statement...`);
        
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          return false;
        }
        
        console.log(`  ✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log(`✅ Migration ${migrationFile} completed successfully`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to run migration ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Direct Migration Runner');
  console.log('==========================');
  
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
