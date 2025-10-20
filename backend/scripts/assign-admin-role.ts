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

async function assignAdminRole() {
  console.log('🔧 Assigning prompt_admin role...');
  
  try {
    // Get the email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.error('❌ Please provide an email address as an argument');
      console.log('Usage: npx tsx scripts/assign-admin-role.ts your-email@example.com');
      process.exit(1);
    }
    
    console.log(`📧 Looking for user with email: ${email}`);
    
    // Find the user by email
    const { data: users, error: findError } = await supabase.auth.admin.listUsers();
    
    if (findError) {
      console.error('❌ Error fetching users:', findError);
      return;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      console.log('Available users:');
      users.users.forEach(u => console.log(`  - ${u.email} (${u.id})`));
      return;
    }
    
    console.log(`✅ Found user: ${user.email} (${user.id})`);
    console.log(`📋 Current role: ${user.user_metadata?.role || 'none'}`);
    
    // Update user metadata to include prompt_admin role
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          role: 'prompt_admin'
        }
      }
    );
    
    if (updateError) {
      console.error('❌ Error updating user role:', updateError);
      return;
    }
    
    console.log('✅ Successfully assigned prompt_admin role!');
    console.log('📋 Updated user metadata:', updateData.user.user_metadata);
    
    // Verify the role was assigned
    const { data: verifyData, error: verifyError } = await supabase.auth.admin.getUserById(user.id);
    
    if (verifyError) {
      console.error('❌ Error verifying role assignment:', verifyError);
      return;
    }
    
    console.log('🔍 Verification:');
    console.log(`  - User ID: ${verifyData.user.id}`);
    console.log(`  - Email: ${verifyData.user.email}`);
    console.log(`  - Role: ${verifyData.user.user_metadata?.role}`);
    
    if (verifyData.user.user_metadata?.role === 'prompt_admin') {
      console.log('🎉 Role assignment verified successfully!');
      console.log('💡 You can now access admin routes.');
    } else {
      console.log('❌ Role assignment verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error assigning admin role:', error);
  }
}

assignAdminRole();
