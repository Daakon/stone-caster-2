const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  '20250131_fix_worlds_uuid_safe.sql',
  '20250131_create_rulesets_table.sql', 
  '20250131_admin_associations_phase_b_safe.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql'
];

console.log('🚀 Checking Admin Migrations...\n');

for (let i = 0; i < MIGRATIONS.length; i++) {
  const migrationFile = MIGRATIONS[i];
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
  
  console.log(`📄 Migration ${i + 1}/${MIGRATIONS.length}: ${migrationFile}`);
  
  try {
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      console.log('✅ Migration file exists');
      console.log(`📏 File size: ${migrationSQL.length} characters`);
      
      // Check for common SQL issues
      if (migrationSQL.includes('BEGIN;') && !migrationSQL.includes('COMMIT;')) {
        console.log('⚠️  WARNING: Migration has BEGIN; but no COMMIT;');
      }
      if (migrationSQL.includes('CREATE TABLE') && migrationSQL.includes('IF NOT EXISTS')) {
        console.log('✅ Uses IF NOT EXISTS (safe)');
      }
      if (migrationSQL.includes('DROP TABLE') && !migrationSQL.includes('IF EXISTS')) {
        console.log('⚠️  WARNING: DROP TABLE without IF EXISTS');
      }
      
    } else {
      console.log('❌ Migration file not found');
    }
  } catch (error) {
    console.log(`❌ Error reading migration: ${error.message}`);
  }
  
  console.log('─'.repeat(60));
  console.log('');
}

console.log('✅ Migration check completed');
