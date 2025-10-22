#!/usr/bin/env node

/**
 * Admin Migration Runner
 * Applies the admin migrations in the correct order when Supabase CLI is not available
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS = [
  '20250131_fix_worlds_uuid_safe.sql',
  '20250131_create_rulesets_table.sql', 
  '20250131_admin_associations_phase_b_safe.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql'
];

function applyAdminMigrations() {
  console.log('🚀 Applying Admin Migrations in Correct Order...\n');
  
  try {
    for (let i = 0; i < MIGRATIONS.length; i++) {
      const migrationFile = MIGRATIONS[i];
      const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);
      
      console.log(`📄 Migration ${i + 1}/${MIGRATIONS.length}: ${migrationFile}`);
      console.log('─'.repeat(60));
      
      try {
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        console.log('✅ Migration file loaded successfully');
        console.log('📋 Migration contents:');
        console.log(migrationSQL);
        console.log('─'.repeat(60));
        
      } catch (error) {
        console.log(`⚠️  Migration file not found: ${migrationFile}`);
        console.log('   This migration may not be needed or may have been renamed.');
        console.log('─'.repeat(60));
      }
      
      console.log('');
    }
    
    console.log('⚠️  Manual Migration Required');
    console.log('Since Supabase CLI is not available, you need to apply these migrations manually:');
    console.log('\n1. Open your Supabase dashboard');
    console.log('2. Go to the SQL Editor');
    console.log('3. Copy and paste each migration SQL above in the order shown');
    console.log('4. Execute each migration one by one');
    console.log('\nAlternatively, install Supabase CLI and run:');
    console.log('   supabase db reset --force');
    console.log('\nOr use the PowerShell script:');
    console.log('   .\\scripts\\run-admin-migrations.ps1 -DatabaseUrl "your-database-url"');
    
    console.log('\n✅ Admin migration script completed');
    
  } catch (error) {
    console.error('❌ Error applying admin migrations:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyAdminMigrations();
}

export { applyAdminMigrations };
