#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function applyCoreContractsMigration() {
  console.log('Applying core_contracts migration...');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // First, let's try to query the table to see if it exists
    console.log('Checking if core_contracts table exists...');
    const { data: existingData, error: queryError } = await supabase
      .from('core_contracts')
      .select('id')
      .limit(1);
    
    if (queryError && queryError.code === 'PGRST205') {
      console.log('Table does not exist, creating it...');
      
      // Since we can't execute raw SQL directly, let's try a different approach
      // We'll create a simple test record to trigger table creation
      console.log('Attempting to create table by inserting a test record...');
      
      const testRecord = {
        id: 'test-migration',
        version: '1.0.0',
        doc: { test: true },
        hash: 'test-hash',
        active: false
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('core_contracts')
        .insert(testRecord)
        .select();
      
      if (insertError) {
        console.error('Error creating table via insert:', insertError);
        console.log('This suggests the table structure needs to be created manually in the Supabase dashboard.');
        console.log('Please run the following SQL in your Supabase SQL editor:');
        console.log('');
        console.log('-- Create core_contracts table');
        console.log('CREATE TABLE IF NOT EXISTS core_contracts (');
        console.log('  id TEXT NOT NULL,');
        console.log('  version TEXT NOT NULL,');
        console.log('  doc JSONB NOT NULL,');
        console.log('  hash TEXT NOT NULL,');
        console.log('  active BOOLEAN NOT NULL DEFAULT false,');
        console.log('  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
        console.log('  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
        console.log('  PRIMARY KEY (id, version)');
        console.log(');');
        console.log('');
        console.log('-- Create indexes');
        console.log('CREATE INDEX IF NOT EXISTS idx_core_contracts_active ON core_contracts(active) WHERE active = true;');
        console.log('CREATE INDEX IF NOT EXISTS idx_core_contracts_created_at ON core_contracts(created_at);');
        console.log('');
        console.log('-- Enable RLS');
        console.log('ALTER TABLE core_contracts ENABLE ROW LEVEL SECURITY;');
        console.log('');
        console.log('-- Create policies');
        console.log('CREATE POLICY "Anyone can view active core contracts" ON core_contracts');
        console.log('  FOR SELECT USING (active = true);');
        console.log('');
        console.log('CREATE POLICY "Service role can manage all core contracts" ON core_contracts');
        console.log('  FOR ALL TO service_role USING (TRUE);');
        console.log('');
        console.log('-- Create trigger function');
        console.log('CREATE OR REPLACE FUNCTION update_core_contracts_updated_at()');
        console.log('RETURNS TRIGGER AS $$');
        console.log('BEGIN');
        console.log('  NEW.updated_at = NOW();');
        console.log('  RETURN NEW;');
        console.log('END;');
        console.log('$$ LANGUAGE plpgsql;');
        console.log('');
        console.log('CREATE TRIGGER trigger_update_core_contracts_updated_at');
        console.log('  BEFORE UPDATE ON core_contracts');
        console.log('  FOR EACH ROW');
        console.log('  EXECUTE FUNCTION update_core_contracts_updated_at();');
        process.exit(1);
      } else {
        console.log('✅ Table created successfully via insert');
        
        // Clean up the test record
        await supabase
          .from('core_contracts')
          .delete()
          .eq('id', 'test-migration');
        
        console.log('✅ Test record cleaned up');
      }
    } else if (queryError) {
      console.error('Unexpected error querying table:', queryError);
      process.exit(1);
    } else {
      console.log('✅ core_contracts table already exists');
    }
    
    // Verify the table works
    console.log('Verifying table functionality...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('core_contracts')
      .select('id, version, active, created_at')
      .limit(5);
    
    if (verifyError) {
      console.error('Error verifying table:', verifyError);
      process.exit(1);
    }
    
    console.log('✅ core_contracts table is working correctly');
    console.log(`Found ${verifyData?.length || 0} existing records`);
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyCoreContractsMigration();
