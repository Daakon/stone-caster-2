#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function createAdventureStartsTable() {
  console.log('🚀 Creating adventure_starts table...');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS adventure_starts (
        adventure_ref TEXT PRIMARY KEY,
        doc JSONB NOT NULL,
        use_once BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    console.log('📄 Creating table...');
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (createError) {
      console.error('❌ Error creating table:', createError.message);
      throw createError;
    }
    
    // Create index
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_adventure_starts_created_at ON adventure_starts(created_at);
    `;
    
    console.log('📄 Creating index...');
    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexSQL });
    if (indexError) {
      console.error('❌ Error creating index:', indexError.message);
      throw indexError;
    }
    
    // Enable RLS
    const enableRLSSQL = `
      ALTER TABLE adventure_starts ENABLE ROW LEVEL SECURITY;
    `;
    
    console.log('📄 Enabling RLS...');
    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: enableRLSSQL });
    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError.message);
      throw rlsError;
    }
    
    // Create policies
    const createPolicySQL = `
      CREATE POLICY "Anyone can view adventure starts" ON adventure_starts
        FOR SELECT USING (TRUE);
      
      CREATE POLICY "Service role can manage all adventure starts" ON adventure_starts
        FOR ALL TO service_role USING (TRUE);
    `;
    
    console.log('📄 Creating policies...');
    const { error: policyError } = await supabase.rpc('exec_sql', { sql: createPolicySQL });
    if (policyError) {
      console.error('❌ Error creating policies:', policyError.message);
      throw policyError;
    }
    
    // Create trigger function
    const createTriggerFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_adventure_starts_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    console.log('📄 Creating trigger function...');
    const { error: triggerFunctionError } = await supabase.rpc('exec_sql', { sql: createTriggerFunctionSQL });
    if (triggerFunctionError) {
      console.error('❌ Error creating trigger function:', triggerFunctionError.message);
      throw triggerFunctionError;
    }
    
    // Create trigger
    const createTriggerSQL = `
      CREATE TRIGGER trigger_update_adventure_starts_updated_at
        BEFORE UPDATE ON adventure_starts
        FOR EACH ROW
        EXECUTE FUNCTION update_adventure_starts_updated_at();
    `;
    
    console.log('📄 Creating trigger...');
    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: createTriggerSQL });
    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError.message);
      throw triggerError;
    }
    
    console.log('✅ Adventure starts table created successfully!');
    
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
createAdventureStartsTable();
