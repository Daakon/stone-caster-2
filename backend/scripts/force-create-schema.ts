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

async function forceCreateSchema() {
  console.log('🔧 Attempting to create prompting schema directly...');
  
  try {
    // Try to create a simple test record to see if the schema exists
    console.log('📋 Testing if prompting.prompts table exists...');
    
    const { data, error } = await supabase
      .from('prompting.prompts')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Schema not found:', error.message);
      console.log('');
      console.log('🔧 The migration needs to be applied manually.');
      console.log('Please run this SQL in Supabase SQL Editor:');
      console.log('');
      console.log('-- Create prompting schema');
      console.log('CREATE SCHEMA IF NOT EXISTS prompting;');
      console.log('');
      console.log('-- Create prompts table');
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
      console.log('-- Create indexes');
      console.log('CREATE INDEX idx_prompts_world_adventure ON prompting.prompts(world_slug, adventure_slug) WHERE active = true;');
      console.log('CREATE INDEX idx_prompts_layer_sort ON prompting.prompts(layer, sort_order) WHERE active = true;');
      console.log('CREATE INDEX idx_prompts_hash ON prompting.prompts(hash);');
      console.log('');
      console.log('-- Enable RLS');
      console.log('ALTER TABLE prompting.prompts ENABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('-- Create basic policies');
      console.log('CREATE POLICY "Service role full access" ON prompting.prompts FOR ALL USING (auth.role() = \'service_role\');');
      console.log('CREATE POLICY "Authenticated users read active prompts" ON prompting.prompts FOR SELECT USING (auth.role() = \'authenticated\' AND active = true AND locked = false);');
      console.log('');
      console.log('-- Grant permissions');
      console.log('GRANT USAGE ON SCHEMA prompting TO authenticated, service_role;');
      console.log('GRANT SELECT ON prompting.prompts TO authenticated;');
      console.log('GRANT ALL ON prompting.prompts TO service_role;');
      console.log('');
      console.log('After running this SQL, come back and run: npm run ingest:prompts');
      return;
    }
    
    console.log('✅ Schema exists! Found', data?.length || 0, 'records');
    
    // Test RPC function
    console.log('🔧 Testing RPC function...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('prompt_segments_for_context');
    
    if (rpcError) {
      console.log('⚠️  RPC function not found:', rpcError.message);
      console.log('You may need to create the RPC function as well.');
    } else {
      console.log('✅ RPC function working! Found', rpcData?.length || 0, 'segments');
    }
    
    console.log('');
    console.log('🎉 Schema verification complete!');
    console.log('You can now run: npm run ingest:prompts');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceCreateSchema();
