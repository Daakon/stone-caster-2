#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createCoreTables() {
  console.log('🚀 Creating core tables...');
  
  try {
    // Since we can't run DDL directly through the Supabase client,
    // we'll provide instructions for manual execution
    
    console.log('📋 Manual SQL Execution Required');
    console.log('');
    console.log('The Supabase client cannot execute DDL statements directly.');
    console.log('Please run the following SQL in your Supabase dashboard:');
    console.log('');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of: db/migrations/20250130000000_core_schema.sql');
    console.log('4. Execute the SQL');
    console.log('');
    console.log('Alternatively, you can use the Supabase CLI:');
    console.log('  supabase db reset');
    console.log('  supabase db push');
    console.log('');
    
    // Test if tables already exist
    console.log('🔍 Checking if tables already exist...');
    
    const tables = ['worlds', 'rulesets', 'entry_points', 'prompt_segments', 'games', 'turns'];
    const existingTables = [];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error) {
          existingTables.push(table);
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.log(`❌ Table '${table}' does not exist`);
        }
      } catch (err) {
        console.log(`❌ Table '${table}' does not exist`);
      }
    }
    
    if (existingTables.length === tables.length) {
      console.log('🎉 All core tables already exist!');
      return;
    }
    
    console.log('');
    console.log(`📊 Found ${existingTables.length}/${tables.length} tables`);
    console.log('Missing tables:', tables.filter(t => !existingTables.includes(t)).join(', '));
    console.log('');
    console.log('Please run the SQL migration manually as described above.');
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  }
}

createCoreTables();
