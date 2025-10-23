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
  console.log('🚀 Auto-Running Admin Migrations (Simple Approach)...\n');
  
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
      
      console.log('✅ Migration file loaded');
      console.log('📋 Migration contents:');
      console.log(migrationSQL);
      console.log('─'.repeat(60));
      
      // Since we can't execute raw SQL directly, we'll show the migration
      // and provide instructions for manual execution
      console.log('⚠️  Manual execution required');
      console.log('Since direct SQL execution is not available, please:');
      console.log('1. Copy the SQL above');
      console.log('2. Go to your Supabase dashboard');
      console.log('3. Open the SQL Editor');
      console.log('4. Paste and execute the SQL');
      console.log('5. Press Enter to continue to the next migration...');
      
      // Wait for user input
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      console.log(`✅ Migration ${migrationFile} completed`);
      console.log('─'.repeat(60));
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error reading migration file ${migrationFile}:`, error);
      console.error('Migration failed. Stopping execution.');
      process.exit(1);
    }
  }
  
  console.log('🎉 All admin migrations completed successfully!');
  console.log('\n🎯 Admin panel should now be fully functional!');
}

runMigrations().catch(console.error);
