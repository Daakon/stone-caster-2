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

async function checkExistingTable() {
  console.log('🔍 Checking existing prompts table...');
  console.log('Database URL:', supabaseUrl);
  console.log('');
  
  try {
    // Check if the table exists in public schema
    console.log('📋 Checking public.prompts table...');
    const { data: tableData, error: tableError } = await supabase
      .from('prompts')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Error accessing public.prompts:', tableError.message);
      return;
    }
    
    console.log('✅ public.prompts table found!');
    console.log(`📊 Found ${tableData?.length || 0} records`);
    
    if (tableData && tableData.length > 0) {
      console.log('📋 Sample record:', JSON.stringify(tableData[0], null, 2));
    }
    
    // Check the table structure
    console.log('');
    console.log('🔧 Checking table structure...');
    const { data: structureData, error: structureError } = await supabase
      .from('prompts')
      .select('id, slug, scope, version, hash, content, active, metadata, created_at, updated_at')
      .limit(1);
    
    if (structureError) {
      console.log('❌ Error checking structure:', structureError.message);
    } else {
      console.log('✅ Table structure accessible');
      if (structureData && structureData.length > 0) {
        console.log('📋 Available columns:', Object.keys(structureData[0]));
      }
    }
    
    // Check if we need to add missing columns
    console.log('');
    console.log('🔧 Checking for required columns...');
    const requiredColumns = ['layer', 'world_slug', 'adventure_slug', 'scene_id', 'turn_stage', 'sort_order', 'locked'];
    const missingColumns = [];
    
    for (const column of requiredColumns) {
      try {
        const { error } = await supabase
          .from('prompts')
          .select(column)
          .limit(1);
        
        if (error) {
          missingColumns.push(column);
        }
      } catch (error) {
        missingColumns.push(column);
      }
    }
    
    if (missingColumns.length > 0) {
      console.log('⚠️  Missing columns:', missingColumns.join(', '));
      console.log('');
      console.log('🔧 You need to add these columns to the prompts table:');
      console.log('Run this SQL in Supabase SQL Editor:');
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
      console.log('✅ All required columns exist!');
      console.log('');
      console.log('🎉 The table is ready for ingestion!');
      console.log('You can now run: npm run ingest:prompts');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkExistingTable();
