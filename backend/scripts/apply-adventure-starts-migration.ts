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

async function applyAdventureStartsMigration() {
  console.log('🚀 Applying adventure_starts migration...');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'supabase', 'migrations', '20250119_awf_adventure_starts.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded, applying to database...');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`Error executing statement: ${error.message}`);
          console.error(`Statement: ${statement}`);
          throw error;
        }
      }
    }
    
    console.log('✅ Adventure starts migration applied successfully!');
    
    // Test the table exists
    const { data, error } = await supabase
      .from('adventure_starts')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Table test failed:', error.message);
    } else {
      console.log('✅ Table test passed - adventure_starts table is accessible');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyAdventureStartsMigration();
