#!/usr/bin/env tsx
/**
 * Grant Admin Role Script
 * 
 * Grants admin role to a user by updating all role sources:
 * 1. user_metadata.role in auth.users
 * 2. profiles.role in public.profiles
 * 3. app_roles table (preferred, Phase 5+)
 * 
 * Usage: npx tsx scripts/grant-admin.ts <email>
 */

import 'dotenv/config';
import { supabaseAdmin } from '../src/services/supabase.js';

async function grantAdminRole() {
  console.log('🔧 Granting admin role...');
  
  try {
    // Get the email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.error('❌ Please provide an email address as an argument');
      console.log('Usage: npx tsx scripts/grant-admin.ts your-email@example.com');
      process.exit(1);
    }
    
    console.log(`📧 Looking for user with email: ${email}`);
    
    // Find the user by email using admin API
    const { data: { users }, error: findError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (findError) {
      console.error('❌ Error fetching users:', findError);
      process.exit(1);
    }
    
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      console.log('\nAvailable users:');
      users.forEach(u => console.log(`  - ${u.email || 'no email'} (${u.id})`));
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.email} (${user.id})`);
    console.log(`📋 Current metadata role: ${user.user_metadata?.role || 'none'}`);
    
    // Step 1: Update user_metadata in auth.users
    console.log('\n📝 Step 1: Updating user_metadata.role...');
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          role: 'admin'
        }
      }
    );
    
    if (updateError) {
      console.error('❌ Error updating user metadata:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Successfully updated user_metadata.role = "admin"');
    
    // Step 2: Upsert into profiles table
    console.log('\n📝 Step 2: Upserting into profiles table...');
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        role: 'admin',
        joined_at: user.created_at || new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('❌ Error upserting profile:', profileError);
      process.exit(1);
    }
    
    console.log('✅ Successfully upserted profiles.role = "admin"');
    
    // Step 3: Upsert into app_roles table (preferred, Phase 5+)
    console.log('\n📝 Step 3: Upserting into app_roles table...');
    
    // First, check if admin role already exists
    const { data: existingRoles, error: checkError } = await supabaseAdmin
      .from('app_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('⚠️  Warning: Error checking app_roles:', checkError);
    }
    
    if (!existingRoles || existingRoles.length === 0) {
      // Insert admin role
      const { error: insertError } = await supabaseAdmin
        .from('app_roles')
        .insert({
          user_id: user.id,
          role: 'admin',
        });
      
      if (insertError) {
        console.error('❌ Error inserting app_roles:', insertError);
        // Don't exit - app_roles might not exist yet, that's okay
        console.log('⚠️  Warning: app_roles table might not exist. Continuing...');
      } else {
        console.log('✅ Successfully inserted app_roles.role = "admin"');
      }
    } else {
      console.log('✅ Admin role already exists in app_roles');
    }
    
    // Verification
    console.log('\n🔍 Verification:');
    const { data: verifyUser, error: verifyError } = await supabaseAdmin.auth.admin.getUserById(user.id);
    
    if (verifyError) {
      console.error('❌ Error verifying user:', verifyError);
    } else {
      console.log(`  - User ID: ${verifyUser.user.id}`);
      console.log(`  - Email: ${verifyUser.user.email}`);
      console.log(`  - Metadata Role: ${verifyUser.user.user_metadata?.role || 'none'}`);
    }
    
    // Verify profiles table
    const { data: verifyProfile, error: verifyProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (verifyProfileError) {
      console.warn('⚠️  Warning: Could not verify profiles table:', verifyProfileError);
    } else {
      console.log(`  - Profiles Role: ${verifyProfile?.role || 'none'}`);
    }
    
    // Verify app_roles table
    const { data: verifyAppRoles, error: verifyAppRolesError } = await supabaseAdmin
      .from('app_roles')
      .select('role')
      .eq('user_id', user.id);
    
    if (verifyAppRolesError && verifyAppRolesError.code !== 'PGRST116') {
      console.warn('⚠️  Warning: Could not verify app_roles table:', verifyAppRolesError);
    } else if (verifyAppRoles && verifyAppRoles.length > 0) {
      const roles = verifyAppRoles.map(r => r.role);
      console.log(`  - App Roles: ${roles.join(', ')}`);
    } else {
      console.log('  - App Roles: (table may not exist yet)');
    }
    
    console.log('\n🎉 Admin role granted successfully!');
    console.log('💡 The user should now be able to access admin routes.');
    console.log('💡 Note: User may need to log out and log back in for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error granting admin role:', error);
    process.exit(1);
  }
}

grantAdminRole();

