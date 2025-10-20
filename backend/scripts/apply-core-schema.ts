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

async function applyCoreSchema() {
  console.log('🚀 Applying core schema migration...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'db', 'migrations', '20250130000000_core_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded, applying to database...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          console.error(`❌ Statement ${i + 1} failed:`, error);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          return;
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('✅ Core schema migration applied successfully');
    
    // Verify the tables were created
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['worlds', 'rulesets', 'entry_points', 'prompt_segments', 'games', 'turns']);
    
    if (tableError) {
      console.error('❌ Error verifying tables:', tableError);
      return;
    }
    
    if (tables && tables.length >= 6) {
      console.log('✅ All core tables verified');
      console.log('📋 Created tables:', tables.map(t => t.table_name).join(', '));
    } else {
      console.log('❌ Not all core tables found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration application failed:', error);
  }
}

applyCoreSchema();
