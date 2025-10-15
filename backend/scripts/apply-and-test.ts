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

async function applyAndTest() {
  console.log('🚀 Prompt Migration Helper');
  console.log('==========================');
  console.log('');
  
  // Step 1: Check current status
  console.log('📋 Step 1: Checking current database status...');
  try {
    const { data: schemaData, error: schemaError } = await supabase
      .from('prompting.prompts')
      .select('id')
      .limit(1);
    
    if (schemaError) {
      console.log('❌ Prompting schema not found. You need to apply the migration.');
      console.log('');
      console.log('🔧 To apply the migration:');
      console.log('1. Go to https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to SQL Editor');
      console.log('4. Copy and paste the contents of: backend/scripts/simple-migration.sql');
      console.log('5. Run the SQL');
      console.log('6. Come back here and run: npm run test:db-prompts');
      console.log('');
      console.log('📄 The SQL file contains:');
      console.log('- Creating prompting schema');
      console.log('- Creating prompts table with indexes');
      console.log('- Setting up RLS policies');
      console.log('- Creating RPC function for segment retrieval');
      console.log('- Granting proper permissions');
      return;
    }
    
    console.log('✅ Prompting schema found!');
    console.log(`📊 Found ${schemaData?.length || 0} prompt records`);
    
  } catch (error) {
    console.log('❌ Error checking schema:', error);
    return;
  }
  
  // Step 2: Test RPC function
  console.log('');
  console.log('🔧 Step 2: Testing RPC function...');
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('prompt_segments_for_context');
    
    if (rpcError) {
      console.log('❌ RPC function error:', rpcError.message);
      console.log('The RPC function may not be created yet.');
    } else {
      console.log('✅ RPC function working!');
      console.log(`📊 Found ${rpcData?.length || 0} prompt segments`);
    }
  } catch (error) {
    console.log('⚠️  RPC function test failed:', error);
  }
  
  // Step 3: Test ingestion
  console.log('');
  console.log('📥 Step 3: Testing prompt ingestion...');
  console.log('Run: npm run ingest:prompts');
  console.log('');
  
  // Step 4: Test full system
  console.log('🧪 Step 4: Testing full system...');
  console.log('Run: npm run test:db-prompts');
  console.log('');
  
  console.log('🎉 Migration helper complete!');
}

applyAndTest();
