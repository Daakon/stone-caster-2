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

async function testAdminEndpoint() {
  console.log('🧪 Testing admin endpoint access...');
  
  try {
    // Test 1: Check if worlds table exists
    console.log('1️⃣ Checking if worlds table exists...');
    const { data: worlds, error: worldsError } = await supabase
      .from('worlds')
      .select('*')
      .limit(1);
    
    if (worldsError) {
      console.error('❌ Error accessing worlds table:', worldsError);
      console.log('💡 The worlds table might not exist. Run the core schema migration first.');
      return;
    }
    
    console.log('✅ Worlds table exists and is accessible');
    console.log(`📊 Found ${worlds?.length || 0} worlds`);
    
    // Test 2: Check user authentication
    console.log('2️⃣ Testing user authentication...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    const adminUser = users.users.find(u => u.user_metadata?.role === 'prompt_admin');
    if (!adminUser) {
      console.error('❌ No admin user found');
      return;
    }
    
    console.log(`✅ Found admin user: ${adminUser.email}`);
    console.log(`📋 Role: ${adminUser.user_metadata?.role}`);
    
    // Test 3: Simulate the admin endpoint logic
    console.log('3️⃣ Testing admin endpoint logic...');
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(adminUser.id);
    
    if (userError) {
      console.error('❌ Error fetching user by ID:', userError);
      return;
    }
    
    const role = userData.user?.user_metadata?.role;
    console.log(`📋 User role from getUserById: ${role}`);
    
    if (role !== 'prompt_admin') {
      console.error('❌ Role check failed - user does not have prompt_admin role');
      return;
    }
    
    console.log('✅ Role check passed');
    
    // Test 4: Test the actual worlds query
    console.log('4️⃣ Testing worlds query...');
    const { data: worldsData, error: worldsQueryError } = await supabase
      .from('worlds')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (worldsQueryError) {
      console.error('❌ Error querying worlds:', worldsQueryError);
      return;
    }
    
    console.log('✅ Worlds query successful');
    console.log(`📊 Worlds data:`, worldsData);
    
    console.log('🎉 All tests passed! The admin endpoint should work.');
    console.log('💡 If you\'re still getting UNAUTHORIZED, check:');
    console.log('   1. Your authentication token is valid');
    console.log('   2. You\'re sending the Authorization header correctly');
    console.log('   3. The token hasn\'t expired');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminEndpoint();
