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

async function detailedVerify() {
  console.log('🔍 Detailed database verification...');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Key:', supabaseServiceKey.substring(0, 20) + '...');
  console.log('');
  
  try {
    // Test 1: Basic connection
    console.log('📡 Testing basic connection...');
    const { data: testData, error: testError } = await supabase
      .from('characters')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Basic connection failed:', testError.message);
      return;
    }
    console.log('✅ Basic connection successful');
    
    // Test 2: Check if prompting schema exists
    console.log('📋 Checking for prompting schema...');
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .from('prompting.prompts')
        .select('id')
        .limit(1);
      
      if (schemaError) {
        console.log('❌ Prompting schema not found:', schemaError.message);
        console.log('');
        console.log('🔧 The migration needs to be applied. Here are the options:');
        console.log('');
        console.log('Option 1 - Manual SQL (Recommended):');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Copy the contents of: supabase/migrations/20250103000000_create_prompting_schema.sql');
        console.log('5. Paste and run the SQL');
        console.log('');
        console.log('Option 2 - Direct table creation:');
        console.log('Run this SQL in Supabase SQL Editor:');
        console.log('');
        console.log('CREATE SCHEMA IF NOT EXISTS prompting;');
        console.log('CREATE TABLE prompting.prompts (');
        console.log('    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('    layer VARCHAR(50) NOT NULL,');
        console.log('    world_slug VARCHAR(100),');
        console.log('    adventure_slug VARCHAR(100),');
        console.log('    scene_id VARCHAR(100),');
        console.log('    turn_stage VARCHAR(50) DEFAULT \'any\',');
        console.log('    sort_order INTEGER NOT NULL DEFAULT 0,');
        console.log('    version VARCHAR(20) NOT NULL DEFAULT \'1.0.0\',');
        console.log('    hash VARCHAR(64) NOT NULL,');
        console.log('    content TEXT NOT NULL,');
        console.log('    metadata JSONB DEFAULT \'{}\',');
        console.log('    active BOOLEAN NOT NULL DEFAULT true,');
        console.log('    locked BOOLEAN NOT NULL DEFAULT false,');
        console.log('    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
        console.log('    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
        console.log(');');
        return;
      }
      
      console.log('✅ Prompting schema found!');
      console.log(`📊 Found ${schemaData?.length || 0} prompt records`);
      
    } catch (error) {
      console.log('❌ Error checking prompting schema:', error);
      return;
    }
    
    // Test 3: Check RPC function
    console.log('🔧 Testing RPC function...');
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('prompt_segments_for_context');
      
      if (rpcError) {
        console.log('⚠️  RPC function error:', rpcError.message);
        console.log('The RPC function may not be created yet.');
      } else {
        console.log('✅ RPC function working, found', rpcData?.length || 0, 'segments');
      }
    } catch (error) {
      console.log('⚠️  RPC function test failed:', error);
    }
    
    console.log('');
    console.log('🎉 Database verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

detailedVerify();
