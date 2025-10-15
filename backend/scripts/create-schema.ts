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

async function createSchema() {
  console.log('🚀 Creating prompting schema...');
  
  try {
    // Try to create the schema
    const { data, error } = await supabase
      .from('prompting.prompts')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Schema does not exist, trying to create it...');
      
      // The schema doesn't exist, we need to apply the migration
      console.log('📋 Please apply the migration manually:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the migration file: supabase/migrations/20250103000000_create_prompting_schema.sql');
      console.log('4. Then run: npm run ingest:prompts');
      
      return;
    }
    
    console.log('✅ Schema exists, found', data?.length || 0, 'records');
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

createSchema();
