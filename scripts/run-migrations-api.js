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

async function runMigrations() {
  console.log('🚀 Auto-Running Admin Migrations (API Approach)...\n');
  
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
  
  // Test connection by checking if we can access the database
  console.log('🔍 Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Cannot access information_schema (this is normal for anon key)');
      console.log('📋 Proceeding with migration display...');
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (error) {
    console.log('⚠️  Database access limited (this is normal for anon key)');
    console.log('📋 Proceeding with migration display...');
  }
  
  console.log('');
  
  // Since we can't execute raw SQL with anon key, we'll create a comprehensive guide
  console.log('📋 MIGRATION EXECUTION GUIDE');
  console.log('═'.repeat(60));
  console.log('');
  console.log('Since direct SQL execution requires admin privileges, please follow these steps:');
  console.log('');
  console.log('1. Open your Supabase dashboard');
  console.log('2. Go to the SQL Editor');
  console.log('3. Run each migration in the exact order shown below');
  console.log('4. Execute each migration completely before moving to the next');
  console.log('');
  
  const MIGRATIONS = [
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
  
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migrationFile = MIGRATIONS[i];
    console.log(`📄 MIGRATION ${i + 1}/${MIGRATIONS.length}: ${migrationFile}`);
    console.log('─'.repeat(60));
    
    try {
      const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      console.log(migrationSQL);
      console.log('');
      console.log('✅ Copy the SQL above and execute it in Supabase SQL Editor');
      console.log('─'.repeat(60));
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error reading migration file ${migrationFile}:`, error);
    }
  }
  
  console.log('🎯 COMPLETION CHECKLIST:');
  console.log('═'.repeat(60));
  console.log('After running all migrations, verify these tables exist:');
  console.log('✅ world_id_mapping');
  console.log('✅ rulesets');
  console.log('✅ entries');
  console.log('✅ npcs');
  console.log('✅ npc_packs');
  console.log('✅ entry_rulesets');
  console.log('✅ entry_npcs');
  console.log('✅ entry_npc_packs');
  console.log('✅ npc_pack_members');
  console.log('✅ ruleset_revisions');
  console.log('✅ content_import_jobs');
  console.log('');
  console.log('🎉 Once all migrations are complete, the admin panel will be fully functional!');
}

runMigrations().catch(console.error);
