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

async function checkAndSetupTables() {
  console.log('🔍 Checking database tables...');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const tables = [
    'adventure_starts',
    'adventures', 
    'worlds',
    'core_contracts',
    'injection_map'
  ];
  
  const missingTables = [];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        console.log(`❌ Table '${table}' does not exist`);
        missingTables.push(table);
      } else if (error) {
        console.log(`❌ Error checking table '${table}': ${error.message}`);
        missingTables.push(table);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    } catch (err) {
      console.log(`❌ Error checking table '${table}': ${err.message}`);
      missingTables.push(table);
    }
  }
  
  if (missingTables.length > 0) {
    console.log('\n📋 Missing tables detected. Please run the following SQL in your Supabase SQL editor:');
    console.log('\n' + '='.repeat(80));
    
    for (const table of missingTables) {
      const sqlFile = join(process.cwd(), '..', 'supabase', 'migrations', `20250119_awf_${table}.sql`);
      try {
        const sql = readFileSync(sqlFile, 'utf-8');
        console.log(`\n-- ${table.toUpperCase()} TABLE`);
        console.log(sql);
        console.log('\n' + '-'.repeat(40));
      } catch (err) {
        console.log(`\n-- ${table.toUpperCase()} TABLE (manual setup required)`);
        console.log(`-- Please create the ${table} table manually`);
        console.log('\n' + '-'.repeat(40));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Execute the SQL');
    console.log('5. Run this script again to verify');
  } else {
    console.log('\n✅ All required tables exist!');
    console.log('🎉 Database is ready for the AWF bundle system');
  }
}

// Run the check
checkAndSetupTables();
