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

async function applyUniqueConstraints() {
  console.log('🔧 Applying unique constraints migration...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'db', 'migrations', '20250130000001_add_unique_constraints.sql');
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
    console.log('3. Copy and paste the following SQL:');
    console.log('');
    console.log('-- Add unique constraints to existing tables');
    console.log('ALTER TABLE worlds ADD CONSTRAINT uk_worlds_id UNIQUE (id);');
    console.log('ALTER TABLE rulesets ADD CONSTRAINT uk_rulesets_id UNIQUE (id);');
    console.log('ALTER TABLE entry_points ADD CONSTRAINT uk_entry_points_id UNIQUE (id);');
    console.log('');
    console.log('-- If any of these fail because the constraint already exists,');
    console.log('-- that\'s fine - just continue with the next one.');
    console.log('');
    console.log('4. Execute the SQL');
    console.log('');
    console.log('Alternatively, you can use the Supabase CLI:');
    console.log('  supabase db reset');
    console.log('  supabase db push');
    console.log('');
    console.log('📋 Full migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    
  } catch (error) {
    console.error('❌ Error applying unique constraints:', error);
  }
}

applyUniqueConstraints();
