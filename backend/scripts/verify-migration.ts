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

async function verifyMigration() {
  console.log('🔍 Verifying prompting schema migration...');
  
  try {
    // Try to access the prompting.prompts table directly
    const { data, error } = await supabase
      .from('prompting.prompts')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Migration not applied yet. Error:', error.message);
      console.log('');
      console.log('📋 To apply the migration:');
      console.log('1. Go to https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to SQL Editor');
      console.log('4. Copy and paste the contents of: supabase/migrations/20250103000000_create_prompting_schema.sql');
      console.log('5. Run the SQL');
      console.log('6. Then run: npm run ingest:prompts');
      return;
    }
    
    console.log('✅ Migration applied successfully!');
    console.log(`📊 Found ${data?.length || 0} prompt records`);
    
    // Test the RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('prompt_segments_for_context');
    
    if (rpcError) {
      console.log('⚠️  RPC function error:', rpcError.message);
    } else {
      console.log('✅ RPC function working, found', rpcData?.length || 0, 'segments');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration();
