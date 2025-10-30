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

async function applyNamingCleanupManual() {
  console.log('🚀 Naming Reference Cleanup Migration');
  console.log('');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'db', 'migrations', '20250203_naming_reference_cleanup.sql');
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
    console.log('💡 This migration will:');
    console.log('   - Add name, slug, description columns to worlds, rulesets, entry_points');
    console.log('   - Create the entry_point_rulesets join table for many-to-many relationships');
    console.log('   - Set up RLS policies for the new table');
    console.log('   - Add unique constraints and indexes');
    console.log('');
    console.log('📋 Full migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log('');
    
    // Test current state
    console.log('🔍 Checking current database state...');
    
    // Check if columns already exist
    const { data: worldsCols, error: worldsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'worlds')
      .eq('table_schema', 'public')
      .in('column_name', ['name', 'slug', 'description']);
    
    if (worldsError) {
      console.log('❌ Error checking worlds columns:', worldsError.message);
    } else {
      const existingCols = worldsCols?.map(c => c.column_name) || [];
      if (existingCols.includes('name') && existingCols.includes('slug')) {
        console.log('✅ Worlds table already has name/slug columns');
      } else {
        console.log('⚠️  Worlds table missing name/slug columns - migration needed');
      }
    }
    
    // Check rulesets table
    const { data: rulesetsCols, error: rulesetsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'rulesets')
      .eq('table_schema', 'public')
      .in('column_name', ['name', 'slug', 'description']);
    
    if (rulesetsError) {
      console.log('❌ Error checking rulesets columns:', rulesetsError.message);
    } else {
      const existingCols = rulesetsCols?.map(c => c.column_name) || [];
      if (existingCols.includes('name') && existingCols.includes('slug')) {
        console.log('✅ Rulesets table already has name/slug columns');
      } else {
        console.log('⚠️  Rulesets table missing name/slug columns - migration needed');
      }
    }
    
    // Check entry_point_rulesets table
    const { data: eprTable, error: eprError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'entry_point_rulesets')
      .eq('table_schema', 'public');
    
    if (eprError) {
      console.log('❌ Error checking entry_point_rulesets table:', eprError.message);
    } else if (eprTable && eprTable.length > 0) {
      console.log('✅ Entry_point_rulesets table already exists');
    } else {
      console.log('⚠️  Entry_point_rulesets table missing - migration needed');
    }
    
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Copy the SQL above');
    console.log('2. Go to your Supabase dashboard → SQL Editor');
    console.log('3. Paste and execute the SQL');
    console.log('4. Verify the changes by checking the tables');
    console.log('');
    console.log('💡 After running the migration, the frontend should work correctly!');
    
  } catch (error) {
    console.error('❌ Error preparing migration:', error);
  }
}

applyNamingCleanupManual();












