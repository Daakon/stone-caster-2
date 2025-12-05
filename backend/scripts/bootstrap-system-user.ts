#!/usr/bin/env tsx

/**
 * Bootstrap System User Script
 * Creates a dedicated system user (system@stonecaster.io) to own official content
 * 
 * Usage: npx tsx backend/scripts/bootstrap-system-user.ts
 * 
 * This script:
 * 1. Checks if system@stonecaster.io exists
 * 2. Creates it if not (with auto-confirmed email)
 * 3. Creates/updates profile with role='system'
 * 4. Outputs SYSTEM_USER_ID for use in migrations
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('');
  console.error('💡 To fix this, you have two options:');
  console.error('');
  console.error('Option 1: Create a .env file in the project root with:');
  console.error('   SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_KEY=your-service-role-key');
  console.error('');
  console.error('Option 2: Set environment variables in PowerShell:');
  console.error('   $env:SUPABASE_URL="https://your-project.supabase.co"');
  console.error('   $env:SUPABASE_SERVICE_KEY="your-service-role-key"');
  console.error('   npx tsx backend/scripts/bootstrap-system-user.ts');
  console.error('');
  console.error('📝 Note: The .env file should be in the project root (same directory as package.json)');
  process.exit(1);
}

// Validate service key format (should be a JWT, typically 200+ characters)
if (supabaseServiceKey.length < 100) {
  console.error('⚠️  WARNING: SUPABASE_SERVICE_KEY appears to be too short.');
  console.error(`   Current length: ${supabaseServiceKey.length} characters`);
  console.error('   Expected: 200+ characters (JWT token)');
  console.error('');
  if (supabaseServiceKey.startsWith('sb_publishable_')) {
    console.error('❌ ERROR: You have copied the PUBLISHABLE key, not the SERVICE_ROLE key!');
    console.error('   The publishable key starts with "sb_publishable_" and is for frontend use.');
    console.error('   The service_role key starts with "eyJ" and is a long JWT token.');
    console.error('');
  } else if (supabaseServiceKey.startsWith('eyJ')) {
    console.error('⚠️  The key starts with "eyJ" (correct format) but is too short.');
    console.error('   Make sure you copied the ENTIRE token (it should be very long).');
    console.error('');
  } else {
    console.error('⚠️  The key format doesn\'t look correct.');
    console.error('   The service_role key should start with "eyJ..." (a JWT token).');
    console.error('');
  }
  console.error('💡 To get the correct SERVICE_ROLE key:');
  console.error('   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api');
  console.error('   2. Scroll down to find "service_role" key (NOT "anon" or "publishable")');
  console.error('   3. Click "Reveal" to show the full key');
  console.error('   4. Copy the ENTIRE JWT token (starts with "eyJ..." and is 200+ chars)');
  console.error('   5. Update your .env file: SUPABASE_SERVICE_KEY=eyJ...');
  console.error('');
  console.error('⚠️  Continuing anyway, but authentication will likely fail...');
  console.error('');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const SYSTEM_EMAIL = 'system@stonecaster.io';
const SYSTEM_DISPLAY_NAME = 'StoneCaster Official';

async function bootstrapSystemUser() {
  console.log('🔧 Bootstrapping System User...\n');
  
  try {
    // Step 1: Check if user already exists
    console.log(`📧 Checking if ${SYSTEM_EMAIL} exists...`);
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error fetching users:', listError);
      process.exit(1);
    }
    
    let systemUser = usersData.users.find(u => u.email === SYSTEM_EMAIL);
    
    if (systemUser) {
      console.log(`✅ System user already exists: ${systemUser.id}`);
    } else {
      // Step 2: Create the system user
      console.log(`\n🔨 Creating system user: ${SYSTEM_EMAIL}...`);
      
      // Generate a secure random password (won't be used, but required)
      const randomPassword = randomBytes(32).toString('base64');
      
      const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
        email: SYSTEM_EMAIL,
        password: randomPassword,
        email_confirm: true, // Auto-confirm email so user is active
        user_metadata: {
          display_name: SYSTEM_DISPLAY_NAME,
          role: 'system'
        }
      });
      
      if (createError) {
        console.error('❌ Error creating system user:', createError);
        process.exit(1);
      }
      
      if (!newUserData.user) {
        console.error('❌ Failed to create system user: no user data returned');
        process.exit(1);
      }
      
      systemUser = newUserData.user;
      console.log(`✅ System user created: ${systemUser.id}`);
    }
    
    const systemUserId = systemUser.id;
    
    // Step 3: Ensure profile exists with role='system'
    console.log(`\n📋 Ensuring profile exists for ${systemUserId}...`);
    
    // Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', systemUserId)
      .single();
    
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // PGRST116 is "not found", which is expected if profile doesn't exist
      console.error('❌ Error checking profile:', profileCheckError);
      process.exit(1);
    }
    
    if (existingProfile) {
      // Update existing profile
      console.log(`📝 Updating existing profile...`);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'system',
          display_name: SYSTEM_DISPLAY_NAME
        })
        .eq('id', systemUserId);
      
      if (updateError) {
        console.error('❌ Error updating profile:', updateError);
        process.exit(1);
      }
      
      console.log(`✅ Profile updated with role='system'`);
    } else {
      // Create new profile
      console.log(`📝 Creating new profile...`);
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: systemUserId,
          role: 'system',
          display_name: SYSTEM_DISPLAY_NAME
        });
      
      if (insertError) {
        console.error('❌ Error creating profile:', insertError);
        process.exit(1);
      }
      
      console.log(`✅ Profile created with role='system'`);
    }
    
    // Step 4: Self-Healing - Fix any NULL owner_user_id values
    console.log('\n🔧 Self-Healing: Fixing NULL owner_user_id values...');
    
    // Count NULLs before fixing
    const { count: worldsNullCount } = await supabase
      .from('chimera_worlds')
      .select('*', { count: 'exact', head: true })
      .is('owner_user_id', null);
    
    const { count: entitiesNullCount } = await supabase
      .from('chimera_entities')
      .select('*', { count: 'exact', head: true })
      .is('owner_user_id', null);
    
    const { count: loreNullCount } = await supabase
      .from('chimera_lore')
      .select('*', { count: 'exact', head: true })
      .is('owner_user_id', null);
    
    const totalNulls = (worldsNullCount || 0) + (entitiesNullCount || 0) + (loreNullCount || 0);
    
    if (totalNulls > 0) {
      console.log(`📊 Found ${totalNulls} items with NULL owner_user_id:`);
      console.log(`   - Worlds: ${worldsNullCount || 0}`);
      console.log(`   - Entities: ${entitiesNullCount || 0}`);
      console.log(`   - Lore: ${loreNullCount || 0}`);
      console.log(`\n🔨 Assigning to system user...`);
      
      // Fix worlds
      if ((worldsNullCount || 0) > 0) {
        const { error: worldsError } = await supabase
          .from('chimera_worlds')
          .update({ 
            owner_user_id: systemUserId,
            visibility: 'public' // System content is public
          })
          .is('owner_user_id', null);
        
        if (worldsError) {
          console.error('❌ Error fixing worlds:', worldsError);
        } else {
          console.log(`✅ Fixed ${worldsNullCount} world(s)`);
        }
      }
      
      // Fix entities
      if ((entitiesNullCount || 0) > 0) {
        const { error: entitiesError } = await supabase
          .from('chimera_entities')
          .update({ 
            owner_user_id: systemUserId,
            visibility: 'public' // System content is public
          })
          .is('owner_user_id', null);
        
        if (entitiesError) {
          console.error('❌ Error fixing entities:', entitiesError);
        } else {
          console.log(`✅ Fixed ${entitiesNullCount} entit(ies)`);
        }
      }
      
      // Fix lore
      if ((loreNullCount || 0) > 0) {
        const { error: loreError } = await supabase
          .from('chimera_lore')
          .update({ 
            owner_user_id: systemUserId,
            visibility: 'public' // System content is public
          })
          .is('owner_user_id', null);
        
        if (loreError) {
          console.error('❌ Error fixing lore:', loreError);
        } else {
          console.log(`✅ Fixed ${loreNullCount} lore template(s)`);
        }
      }
      
      // Verify all NULLs are fixed
      const { count: remainingWorlds } = await supabase
        .from('chimera_worlds')
        .select('*', { count: 'exact', head: true })
        .is('owner_user_id', null);
      
      const { count: remainingEntities } = await supabase
        .from('chimera_entities')
        .select('*', { count: 'exact', head: true })
        .is('owner_user_id', null);
      
      const { count: remainingLore } = await supabase
        .from('chimera_lore')
        .select('*', { count: 'exact', head: true })
        .is('owner_user_id', null);
      
      const remaining = (remainingWorlds || 0) + (remainingEntities || 0) + (remainingLore || 0);
      
      if (remaining === 0) {
        console.log('\n✅ All NULL owner_user_id values have been fixed!');
      } else {
        console.log(`\n⚠️  Warning: ${remaining} items still have NULL owner_user_id`);
      }
    } else {
      console.log('✅ No NULL owner_user_id values found. Database is clean!');
    }
    
    // Step 5: Output SYSTEM_USER_ID
    console.log('\n' + '='.repeat(60));
    console.log('✅ System User Bootstrap Complete!');
    console.log('='.repeat(60));
    console.log(`\n📋 SYSTEM_USER_ID: ${systemUserId}`);
    console.log(`📧 Email: ${SYSTEM_EMAIL}`);
    console.log(`👤 Display Name: ${SYSTEM_DISPLAY_NAME}`);
    console.log(`\n💡 Next step: Run the migration to enforce NOT NULL constraints:`);
    console.log(`   supabase/migrations/20251204_enforce_ownership.sql`);
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

bootstrapSystemUser();

