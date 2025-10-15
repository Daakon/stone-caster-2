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

async function createSchemaStepByStep() {
  console.log('🔧 Creating prompting schema step by step...');
  console.log('Database URL:', supabaseUrl);
  console.log('');
  
  try {
    // Step 1: Try to create schema
    console.log('📋 Step 1: Creating schema...');
    try {
      const { data, error } = await supabase
        .from('prompting.prompts')
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('❌ Schema does not exist yet. Error:', error.message);
        console.log('');
        console.log('🔧 Please apply the migration manually:');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Run this SQL:');
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
        console.log('');
        console.log('ALTER TABLE prompting.prompts ENABLE ROW LEVEL SECURITY;');
        console.log('GRANT USAGE ON SCHEMA prompting TO authenticated, service_role;');
        console.log('GRANT SELECT ON prompting.prompts TO authenticated;');
        console.log('GRANT ALL ON prompting.prompts TO service_role;');
        console.log('');
        console.log('5. After running the SQL, come back and run: npm run ingest:prompts');
        return;
      }
      
      console.log('✅ Schema exists! Found', data?.length || 0, 'records');
      
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
        console.log('⚠️  RPC function not found:', rpcError.message);
        console.log('You may need to create the RPC function as well.');
      } else {
        console.log('✅ RPC function working! Found', rpcData?.length || 0, 'segments');
      }
    } catch (error) {
      console.log('⚠️  RPC function test failed:', error);
    }
    
    console.log('');
    console.log('🎉 Schema verification complete!');
    console.log('You can now run: npm run ingest:prompts');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createSchemaStepByStep();
