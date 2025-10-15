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

async function testTableStructure() {
  console.log('🔍 Testing prompts table structure...');
  console.log('');
  
  try {
    // Test basic access
    console.log('📋 Testing basic table access...');
    const { data: basicData, error: basicError } = await supabase
      .from('prompts')
      .select('id, slug, scope, version, hash, content, active, metadata, created_at, updated_at')
      .limit(1);
    
    if (basicError) {
      console.log('❌ Basic access failed:', basicError.message);
      return;
    }
    
    console.log('✅ Basic table access successful');
    
    // Test new columns
    console.log('');
    console.log('🔧 Testing new columns...');
    const newColumns = ['layer', 'world_slug', 'adventure_slug', 'scene_id', 'turn_stage', 'sort_order', 'locked'];
    const missingColumns = [];
    
    for (const column of newColumns) {
      try {
        const { error } = await supabase
          .from('prompts')
          .select(column)
          .limit(1);
        
        if (error) {
          missingColumns.push(column);
          console.log(`❌ Column '${column}' not found`);
        } else {
          console.log(`✅ Column '${column}' found`);
        }
      } catch (error) {
        missingColumns.push(column);
        console.log(`❌ Column '${column}' error:`, error);
      }
    }
    
    if (missingColumns.length > 0) {
      console.log('');
      console.log('⚠️  Missing columns:', missingColumns.join(', '));
      console.log('Please add these columns to the prompts table:');
      console.log('');
      for (const column of missingColumns) {
        if (column === 'layer') {
          console.log('ALTER TABLE prompts ADD COLUMN layer VARCHAR(50);');
        } else if (column === 'world_slug') {
          console.log('ALTER TABLE prompts ADD COLUMN world_slug VARCHAR(100);');
        } else if (column === 'adventure_slug') {
          console.log('ALTER TABLE prompts ADD COLUMN adventure_slug VARCHAR(100);');
        } else if (column === 'scene_id') {
          console.log('ALTER TABLE prompts ADD COLUMN scene_id VARCHAR(100);');
        } else if (column === 'turn_stage') {
          console.log('ALTER TABLE prompts ADD COLUMN turn_stage VARCHAR(50) DEFAULT \'any\';');
        } else if (column === 'sort_order') {
          console.log('ALTER TABLE prompts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;');
        } else if (column === 'locked') {
          console.log('ALTER TABLE prompts ADD COLUMN locked BOOLEAN NOT NULL DEFAULT false;');
        }
      }
      console.log('');
      console.log('After adding the columns, run: npm run ingest:prompts');
    } else {
      console.log('');
      console.log('🎉 All required columns exist!');
      console.log('The table is ready for ingestion.');
      console.log('You can now run: npm run ingest:prompts');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTableStructure();
