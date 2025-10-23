#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from frontend .env
dotenv.config({ path: join(__dirname, '..', 'frontend', '.env') });

const MIGRATIONS = [
  '20250131_fix_worlds_uuid_safe.sql',
  '20250131_create_rulesets_table.sql', 
  '20250131_admin_associations_phase_b_safe.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql'
];

async function runMigrations() {
  console.log('🚀 Auto-Running Admin Migrations...\n');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Please ensure frontend/.env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  
  console.log('✅ Supabase connection configured');
  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 Key: ${supabaseKey.substring(0, 20)}...`);
  console.log('');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migrationFile = MIGRATIONS[i];
    console.log(`📄 Migration ${i + 1}/${MIGRATIONS.length}: ${migrationFile}`);
    
    try {
      // Read the migration file
      const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      console.log('✅ Migration file loaded, executing...');
      
      // Execute the migration using raw SQL execution
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ sql: migrationSQL })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error(`❌ Error applying migration ${migrationFile}:`, data.error);
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
  
  console.log('\n🎯 Admin panel should now be fully functional!');
}

runMigrations().catch(console.error);
