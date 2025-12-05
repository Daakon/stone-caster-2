#!/usr/bin/env tsx

/**
 * Mark Official Content Script
 * Marks legacy NULL owner content as "Official" and assigns it to an admin
 * 
 * Usage: 
 *   npx tsx backend/scripts/mark-official-content.ts
 *   npx tsx backend/scripts/mark-official-content.ts admin@example.com
 * 
 * This script:
 * 1. Finds an admin user (or uses provided email)
 * 2. Updates NULL owner_user_id content to be owned by that admin
 * 3. Marks it as is_official = true
 * 4. Sets published_by = admin ID (audit trail)
 * 5. Sets visibility = 'public'
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function markOfficialContent() {
  console.log('🔧 Marking Legacy Content as Official...\n');
  
  try {
    // Step 1: Find admin user
    const emailArg = process.argv[2];
    let adminUser: { id: string; email: string } | null = null;
    
    if (emailArg) {
      console.log(`📧 Looking for admin user: ${emailArg}`);
      const { data: usersData, error: findError } = await supabase.auth.admin.listUsers();
      
      if (findError) {
        console.error('❌ Error fetching users:', findError);
        process.exit(1);
      }
      
      adminUser = usersData.users.find(u => u.email === emailArg) || null;
      
      if (!adminUser) {
        console.error(`❌ User with email ${emailArg} not found`);
        process.exit(1);
      }
      
      // Verify user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminUser.id)
        .single();
      
      if (profile?.role !== 'admin' && profile?.role !== 'system') {
        console.warn(`⚠️  User ${emailArg} is not an admin (role: ${profile?.role || 'none'})`);
        console.warn('   Continuing anyway, but this user should be an admin...');
      }
    } else {
      // Find first admin user
      console.log('🔍 Looking for first admin user...');
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role')
        .in('role', ['admin', 'system'])
        .limit(1);
      
      if (profilesError) {
        console.error('❌ Error fetching admin profiles:', profilesError);
        process.exit(1);
      }
      
      if (!profiles || profiles.length === 0) {
        console.error('❌ No admin users found. Please create an admin user first.');
        console.error('   Or provide an email: npx tsx backend/scripts/mark-official-content.ts admin@example.com');
        process.exit(1);
      }
      
      const adminProfile = profiles[0];
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(adminProfile.id);
      
      if (userError || !userData.user) {
        console.error('❌ Error fetching admin user:', userError);
        process.exit(1);
      }
      
      adminUser = {
        id: userData.user.id,
        email: userData.user.email || 'unknown'
      };
    }
    
    console.log(`✅ Found admin user: ${adminUser.email} (${adminUser.id})\n`);
    
    // Step 2: Count NULL owner content
    const { count: worldsCount } = await supabase
      .from('chimera_worlds')
      .select('*', { count: 'exact', head: true })
      .is('owner_user_id', null);
    
    const { count: entitiesCount } = await supabase
      .from('chimera_entities')
      .select('*', { count: 'exact', head: true })
      .is('owner_user_id', null);
    
    const { count: loreCount } = await supabase
      .from('chimera_lore')
      .select('*', { count: 'exact', head: true })
      .is('owner_user_id', null);
    
    console.log('📊 Legacy content found:');
    console.log(`   - Worlds: ${worldsCount || 0}`);
    console.log(`   - Entities: ${entitiesCount || 0}`);
    console.log(`   - Lore: ${loreCount || 0}\n`);
    
    if ((worldsCount || 0) === 0 && (entitiesCount || 0) === 0 && (loreCount || 0) === 0) {
      console.log('✅ No legacy content to mark as official. All content already has owners.');
      return;
    }
    
    const now = new Date().toISOString();
    
    // Step 3: Mark worlds as official
    if ((worldsCount || 0) > 0) {
      console.log(`🔨 Marking ${worldsCount} world(s) as official...`);
      const { data: worldsData, error: worldsError } = await supabase
        .from('chimera_worlds')
        .update({
          owner_user_id: adminUser.id,
          is_official: true,
          published_by: adminUser.id,
          published_at: now,
          visibility: 'public'
        })
        .is('owner_user_id', null)
        .select('id, name');
      
      if (worldsError) {
        console.error('❌ Error marking worlds:', worldsError);
      } else {
        console.log(`✅ Successfully marked ${worldsData?.length || 0} world(s) as official`);
        if (worldsData && worldsData.length > 0) {
          worldsData.forEach(w => console.log(`   - ${w.name || w.id}`));
        }
      }
    }
    
    // Step 4: Mark entities as official
    if ((entitiesCount || 0) > 0) {
      console.log(`\n🔨 Marking ${entitiesCount} entit(ies) as official...`);
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('chimera_entities')
        .update({
          owner_user_id: adminUser.id,
          is_official: true,
          published_by: adminUser.id,
          published_at: now,
          visibility: 'public'
        })
        .is('owner_user_id', null)
        .select('id, key');
      
      if (entitiesError) {
        console.error('❌ Error marking entities:', entitiesError);
      } else {
        console.log(`✅ Successfully marked ${entitiesData?.length || 0} entit(ies) as official`);
        if (entitiesData && entitiesData.length > 0) {
          entitiesData.forEach(e => console.log(`   - ${e.key || e.id}`));
        }
      }
    }
    
    // Step 5: Mark lore as official
    if ((loreCount || 0) > 0) {
      console.log(`\n🔨 Marking ${loreCount} lore template(s) as official...`);
      const { data: loreData, error: loreError } = await supabase
        .from('chimera_lore')
        .update({
          owner_user_id: adminUser.id,
          is_official: true,
          published_by: adminUser.id,
          published_at: now,
          visibility: 'public'
        })
        .is('owner_user_id', null)
        .select('id, key');
      
      if (loreError) {
        console.error('❌ Error marking lore:', loreError);
      } else {
        console.log(`✅ Successfully marked ${loreData?.length || 0} lore template(s) as official`);
        if (loreData && loreData.length > 0) {
          loreData.forEach(l => console.log(`   - ${l.key || l.id}`));
        }
      }
    }
    
    // Step 6: Verify
    console.log('\n🔍 Verifying...');
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
    
    console.log('📊 Remaining NULL owner content:');
    console.log(`   - Worlds: ${remainingWorlds || 0}`);
    console.log(`   - Entities: ${remainingEntities || 0}`);
    console.log(`   - Lore: ${remainingLore || 0}`);
    
    if ((remainingWorlds || 0) === 0 && (remainingEntities || 0) === 0 && (remainingLore || 0) === 0) {
      console.log('\n🎉 All legacy content has been marked as official!');
      console.log(`💡 Content is now visible in "Casting Circle" as Official content`);
      console.log(`💡 Content is also visible in "My Creations" for ${adminUser.email}`);
    } else {
      console.log('\n⚠️  Some content still has NULL owner_user_id');
    }
    
  } catch (error) {
    console.error('❌ Error marking official content:', error);
    process.exit(1);
  }
}

markOfficialContent();

