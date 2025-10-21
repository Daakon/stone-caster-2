#!/usr/bin/env node

/**
 * Simple migration runner for the reports analytics migration
 * This script applies the migration manually when Supabase CLI is not available
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function applyMigration() {
  console.log('🚀 Applying reports analytics migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250130_reports_analytics.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('📋 Migration contents:');
    console.log('─'.repeat(50));
    console.log(migrationSQL);
    console.log('─'.repeat(50));
    
    console.log('\n⚠️  Manual Migration Required');
    console.log('Since Supabase CLI is not available, you need to apply this migration manually:');
    console.log('\n1. Open your Supabase dashboard');
    console.log('2. Go to the SQL Editor');
    console.log('3. Copy and paste the migration SQL above');
    console.log('4. Execute the migration');
    console.log('\nAlternatively, install Supabase CLI and run:');
    console.log('   supabase db reset --force');
    console.log('\nOr apply the migration directly to your database.');
    
    console.log('\n✅ Migration script completed');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyMigration();
}

export { applyMigration };
