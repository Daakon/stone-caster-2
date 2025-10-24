#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNPCColumns() {
  console.log('🔍 Checking NPC table columns...');
  
  try {
    // Try different column combinations to see what exists
    const columnsToTest = [
      'id',
      'version', 
      'doc',
      'name',
      'status',
      'description',
      'created_at',
      'updated_at',
      'user_id',
      'visibility',
      'author_name',
      'author_type'
    ];
    
    const existingColumns = [];
    const missingColumns = [];
    
    for (const column of columnsToTest) {
      try {
        const { error } = await supabase
          .from('npcs')
          .select(column)
          .limit(1);
        
        if (error) {
          if (error.message.includes('does not exist')) {
            missingColumns.push(column);
          } else {
            console.log(`⚠️  Unexpected error for column ${column}:`, error.message);
          }
        } else {
          existingColumns.push(column);
        }
      } catch (err) {
        missingColumns.push(column);
      }
    }
    
    console.log('✅ Existing columns:', existingColumns);
    console.log('❌ Missing columns:', missingColumns);
    
    return { existingColumns, missingColumns };
    
  } catch (error) {
    console.log('❌ Column check failed:', error.message);
    return { existingColumns: [], missingColumns: [] };
  }
}

async function main() {
  console.log('🚀 NPC Column Check Script');
  console.log('===========================');
  console.log('');
  
  const { existingColumns, missingColumns } = await checkNPCColumns();
  
  console.log('');
  console.log('📋 Analysis:');
  
  if (missingColumns.includes('user_id')) {
    console.log('❌ user_id column is missing - this is causing the API error');
  }
  
  if (missingColumns.includes('version')) {
    console.log('⚠️  version column is missing - this suggests the AWF NPC schema was not applied');
  }
  
  if (existingColumns.includes('id') && existingColumns.includes('name')) {
    console.log('✅ Basic NPC columns exist - this might be the admin associations schema');
  }
  
  console.log('');
  console.log('🔧 Recommended fix:');
  console.log('1. Apply the user_id migration: scripts/fix-npc-user-id-migration.sql');
  console.log('2. Test the API again');
}

main().catch(console.error);
