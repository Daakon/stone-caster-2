#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MIGRATIONS = [
  '20250131_fix_worlds_uuid_safe.sql',
  '20250131_create_rulesets_table.sql', 
  '20250131_admin_associations_phase_b_safe.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql'
];

async function applyAdminMigrations() {
  console.log('🚀 Applying Admin Migrations in Correct Order...\n');
  
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migrationFile = MIGRATIONS[i];
    console.log(`📄 Migration ${i + 1}/${MIGRATIONS.length}: ${migrationFile}`);
    
    try {
      // Read the migration file
      const migrationPath = join(process.cwd(), '..', 'supabase', 'migrations', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      console.log('✅ Migration file loaded, applying to database...');
      
      // Execute the migration using Supabase RPC
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: migrationSQL
      });
      
      if (error) {
        console.error(`❌ Error applying migration ${migrationFile}:`, error);
        console.error('Migration failed. Stopping execution.');
        process.exit(1);
      }
      
      console.log(`✅ Migration ${migrationFile} applied successfully`);
      console.log('─'.repeat(60));
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error reading migration file ${migrationFile}:`, error);
      console.error('Migration failed. Stopping execution.');
      process.exit(1);
    }
  }
  
  console.log('🎉 All admin migrations completed successfully!');
  
  // Verify the schema
  console.log('\n🔍 Verifying schema...');
  try {
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['worlds', 'rulesets', 'entries', 'npcs', 'npc_packs', 'world_id_mapping']);
    
    if (tablesError) {
      console.log('⚠️  Could not verify tables (this is normal if RLS is enabled)');
    } else {
      console.log('✅ Key tables created:', tables?.map(t => t.table_name).join(', '));
    }
  } catch (error) {
    console.log('⚠️  Could not verify tables (this is normal if RLS is enabled)');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyAdminMigrations().catch(console.error);
}

export { applyAdminMigrations };
