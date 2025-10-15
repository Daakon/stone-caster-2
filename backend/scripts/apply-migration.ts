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

async function applyMigration() {
  console.log('🚀 Applying prompting schema migration...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'supabase', 'migrations', '20250103000000_create_prompting_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded, applying to database...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      return;
    }
    
    console.log('✅ Migration applied successfully');
    
    // Verify the schema was created
    const { data: schemas, error: schemaError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'prompting');
    
    if (schemaError) {
      console.error('❌ Error verifying schema:', schemaError);
      return;
    }
    
    if (schemas && schemas.length > 0) {
      console.log('✅ Prompting schema verified');
    } else {
      console.log('❌ Prompting schema not found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration application failed:', error);
  }
}

applyMigration();
