const fs = require('fs');
const path = require('path');

async function displayMigration(migrationFile) {
  console.log(`\n📄 MIGRATION: ${migrationFile}`);
  console.log('='.repeat(80));
  
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(sql);
    console.log('='.repeat(80));
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to read migration ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Migration Display Runner');
  console.log('============================');
  console.log('📋 Displaying all migrations for manual execution in Supabase SQL Editor');
  console.log('⚠️  Execute them in the exact order shown below');
  
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
  console.log('🎯 Execute each migration completely before moving to the next');
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`\n🔄 MIGRATION ${i + 1}/${migrations.length}: ${migration}`);
    
    const success = await displayMigration(migration);
    if (!success) {
      console.error(`\n❌ Failed to display migration ${migration}`);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All migrations displayed successfully!');
  console.log('✅ Copy and paste each migration into Supabase SQL Editor');
  console.log('✅ Execute them in the exact order shown above');
  console.log('✅ Wait for each migration to complete before running the next');
}

main().catch(error => {
  console.error('❌ Migration display failed:', error.message);
  process.exit(1);
});
