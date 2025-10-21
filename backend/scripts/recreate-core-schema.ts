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

async function recreateCoreSchema() {
  console.log('🔧 Recreating core schema (clean slate approach)...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'db', 'migrations', '20250130000002_recreate_core_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log('');
    console.log('⚠️  Manual SQL Execution Required');
    console.log('');
    console.log('The Supabase client cannot execute DDL statements directly.');
    console.log('Please run the following SQL in your Supabase dashboard:');
    console.log('');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the full migration SQL below');
    console.log('4. Execute the SQL');
    console.log('');
    console.log('⚠️  WARNING: This will DROP and RECREATE all core tables!');
    console.log('   Make sure you have backed up any important data.');
    console.log('');
    console.log('📋 Full migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log('');
    console.log('💡 This approach will:');
    console.log('   1. Drop all existing core tables (CASCADE)');
    console.log('   2. Recreate them with proper unique constraints');
    console.log('   3. Add all necessary indexes and triggers');
    console.log('   4. Verify the schema is correct');
    console.log('');
    console.log('✅ After running this, the core schema should work perfectly!');
    
  } catch (error) {
    console.error('❌ Error recreating core schema:', error);
  }
}

recreateCoreSchema();
