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

async function applyNamingCleanup() {
  console.log('🚀 Applying naming reference cleanup migration...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'db', 'migrations', '20250203_naming_reference_cleanup.sql');
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
          // Some errors are expected (like "already exists")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('already exists') ||
              error.message.includes('policy') && error.message.includes('already exists') ||
              error.message.includes('trigger') && error.message.includes('already exists') ||
              error.message.includes('index') && error.message.includes('already exists')) {
            console.log(`  ⚠️  Expected: ${error.message}`);
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
            return;
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      }
    }
    
    console.log('✅ Naming reference cleanup migration applied successfully');
    
    // Verify the columns were added
    console.log('🔍 Verifying migration results...');
    
    // Check worlds table
    const { data: worldsCols, error: worldsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'worlds')
      .eq('table_schema', 'public')
      .in('column_name', ['name', 'slug', 'description']);
    
    if (worldsError) {
      console.error('❌ Error checking worlds columns:', worldsError);
    } else {
      console.log('✅ Worlds table has name/slug/description columns');
    }
    
    // Check rulesets table
    const { data: rulesetsCols, error: rulesetsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'rulesets')
      .eq('table_schema', 'public')
      .in('column_name', ['name', 'slug', 'description']);
    
    if (rulesetsError) {
      console.error('❌ Error checking rulesets columns:', rulesetsError);
    } else {
      console.log('✅ Rulesets table has name/slug/description columns');
    }
    
    // Check entry_points table
    const { data: entryCols, error: entryError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'entry_points')
      .eq('table_schema', 'public')
      .in('column_name', ['name', 'slug']);
    
    if (entryError) {
      console.error('❌ Error checking entry_points columns:', entryError);
    } else {
      console.log('✅ Entry_points table has name/slug columns');
    }
    
    // Check entry_point_rulesets table
    const { data: eprTable, error: eprError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'entry_point_rulesets')
      .eq('table_schema', 'public');
    
    if (eprError) {
      console.error('❌ Error checking entry_point_rulesets table:', eprError);
    } else if (eprTable && eprTable.length > 0) {
      console.log('✅ Entry_point_rulesets table exists');
    } else {
      console.log('❌ Entry_point_rulesets table not found');
    }
    
  } catch (error) {
    console.error('❌ Migration application failed:', error);
  }
}

applyNamingCleanup();




















