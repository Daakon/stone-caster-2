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

async function checkUserRole() {
  console.log('🔍 Checking user roles...');
  
  try {
    // Get all users
    const { data: users, error: findError } = await supabase.auth.admin.listUsers();
    
    if (findError) {
      console.error('❌ Error fetching users:', findError);
      return;
    }
    
    console.log(`📊 Found ${users.users.length} users:`);
    console.log('');
    
    users.users.forEach((user, index) => {
      const role = user.user_metadata?.role || 'none';
      const isAdmin = role === 'prompt_admin';
      const status = isAdmin ? '✅ ADMIN' : '❌ Regular';
      
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${role}`);
      console.log(`   Status: ${status}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    const adminUsers = users.users.filter(u => u.user_metadata?.role === 'prompt_admin');
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No users have prompt_admin role');
      console.log('💡 To assign admin role, run:');
      console.log('   npx tsx scripts/assign-admin-role.ts your-email@example.com');
    } else {
      console.log(`✅ Found ${adminUsers.length} admin user(s):`);
      adminUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking user roles:', error);
  }
}

checkUserRole();
