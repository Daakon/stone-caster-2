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

async function fixUniqueConstraints() {
  console.log('🔧 Fixing unique constraints...');
  
  try {
    // Check current table structure
    console.log('1️⃣ Checking current table structure...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['worlds', 'rulesets', 'entry_points']);
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }
    
    console.log('📊 Found tables:', tables.map(t => t.table_name));
    
    // Check existing constraints
    console.log('2️⃣ Checking existing constraints...');
    
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, table_name, constraint_type')
      .eq('table_schema', 'public')
      .in('table_name', ['worlds', 'rulesets', 'entry_points'])
      .in('constraint_type', ['UNIQUE', 'PRIMARY KEY']);
    
    if (constraintsError) {
      console.error('❌ Error checking constraints:', constraintsError);
      return;
    }
    
    console.log('📋 Existing constraints:');
    constraints.forEach(c => {
      console.log(`  - ${c.table_name}: ${c.constraint_name} (${c.constraint_type})`);
    });
    
    // Check if we can add constraints
    console.log('3️⃣ Testing table access...');
    
    const { data: worlds, error: worldsError } = await supabase
      .from('worlds')
      .select('id')
      .limit(1);
    
    if (worldsError) {
      console.error('❌ Error accessing worlds table:', worldsError);
      return;
    }
    
    console.log('✅ Worlds table is accessible');
    
    // Since we can't run DDL directly through the Supabase client,
    // we need to provide the SQL to run manually
    console.log('');
    console.log('📋 Manual SQL Execution Required');
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
    
  } catch (error) {
    console.error('❌ Error fixing constraints:', error);
  }
}

fixUniqueConstraints();
