#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  console.log('   Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNPCUserID() {
  console.log('🔍 Testing NPC user_id column...');
  
  try {
    // Try to select the user_id column
    const { data, error } = await supabase
      .from('npcs')
      .select('id, version, user_id')
      .limit(1);
    
    if (error) {
      if (error.message.includes('column npcs.user_id does not exist')) {
        console.log('❌ user_id column does not exist');
        console.log('');
        console.log('📋 MANUAL MIGRATION REQUIRED:');
        console.log('1. Go to your Supabase Dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and paste the contents of scripts/fix-npc-user-id-migration.sql');
        console.log('4. Run the SQL script');
        console.log('5. Run this test script again');
        return false;
      } else {
        console.log('❌ Unexpected error:', error.message);
        return false;
      }
    }
    
    console.log('✅ user_id column exists!');
    console.log('📊 Sample data:', data);
    return true;
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

async function testNPCAdminAPI() {
  console.log('🧪 Testing NPC Admin API...');
  
  try {
    // Test the admin NPC API endpoint
    const response = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/awf/npcs`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ NPC Admin API working!');
      console.log('📊 Response:', data);
      return true;
    } else {
      const error = await response.text();
      console.log('❌ NPC Admin API failed:', error);
      return false;
    }
    
  } catch (error) {
    console.log('❌ NPC Admin API test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 NPC User ID Test Script');
  console.log('============================');
  console.log('');
  
  const userIDTest = await testNPCUserID();
  
  if (userIDTest) {
    console.log('');
    await testNPCAdminAPI();
  }
  
  console.log('');
  console.log('📋 Summary:');
  if (userIDTest) {
    console.log('✅ NPC user_id column is working');
    console.log('✅ Your admin API should now work without the user_id error');
  } else {
    console.log('❌ NPC user_id column is missing');
    console.log('❌ You need to run the manual migration first');
  }
}

main().catch(console.error);
