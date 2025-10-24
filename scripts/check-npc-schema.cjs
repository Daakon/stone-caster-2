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

async function checkNPCSchema() {
  console.log('🔍 Checking NPC table schema...');
  
  try {
    // Try to get table information
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'npcs')
      .eq('table_schema', 'public');
    
    if (error) {
      console.log('❌ Error querying schema:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log('✅ NPC table exists with columns:');
      data.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } else {
      console.log('❌ NPC table does not exist or has no columns');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Schema check failed:', error.message);
    return false;
  }
}

async function testNPCAccess() {
  console.log('🧪 Testing NPC table access...');
  
  try {
    // Try a simple select to see what columns exist
    const { data, error } = await supabase
      .from('npcs')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ NPC table access failed:', error.message);
      return false;
    }
    
    console.log('✅ NPC table accessible');
    console.log('📊 Sample data structure:', data);
    return true;
    
  } catch (error) {
    console.log('❌ NPC table access failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 NPC Schema Check Script');
  console.log('===========================');
  console.log('');
  
  await checkNPCSchema();
  console.log('');
  await testNPCAccess();
}

main().catch(console.error);
