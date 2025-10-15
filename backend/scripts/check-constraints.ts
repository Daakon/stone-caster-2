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

async function checkConstraints() {
  console.log('🔍 Checking prompts table constraints...');
  console.log('');
  
  try {
    // Try to insert a test record with different scope values
    const testScopes = ['core', 'world', 'adventure', 'system', 'foundation', 'engine', 'ai_behavior', 'data_management', 'performance', 'content', 'enhancement'];
    
    for (const scope of testScopes) {
      try {
        const { error } = await supabase
          .from('prompts')
          .insert({
            slug: `test-${scope}`,
            scope: scope,
            layer: 'test',
            content: 'test content',
            hash: 'test-hash',
            active: true,
            locked: false
          });
        
        if (error) {
          console.log(`❌ Scope '${scope}' failed:`, error.message);
        } else {
          console.log(`✅ Scope '${scope}' works`);
          // Clean up the test record
          await supabase.from('prompts').delete().eq('slug', `test-${scope}`);
        }
      } catch (error) {
        console.log(`❌ Scope '${scope}' error:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkConstraints();
