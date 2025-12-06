#!/usr/bin/env tsx

/**
 * Claim Legacy Content Script
 * Assigns NULL owner_user_id content to a specified user
 * 
 * Usage: npx tsx backend/scripts/claim-legacy-content.ts your-email@example.com
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

async function claimLegacyContent() {
  console.log('🔧 Claiming legacy content (NULL owner_user_id)...\n');
  
  try {
    // Get the email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.error('❌ Please provide an email address as an argument');
      console.log('Usage: npx tsx backend/scripts/claim-legacy-content.ts your-email@example.com');
      process.exit(1);
    }
    
    console.log(`📧 Looking for user with email: ${email}`);
    
    // Find the user by email
    const { data: usersData, error: findError } = await supabase.auth.admin.listUsers();
    
    if (findError) {
      console.error('❌ Error fetching users:', findError);
      process.exit(1);
    }
    
    const user = usersData.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      console.log('\nAvailable users:');
      usersData.users.forEach(u => console.log(`  - ${u.email} (${u.id})`));
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.email} (${user.id})\n`);
    
    // Count NULL owner content before claiming
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
    console.log(`  - Worlds: ${worldsCount || 0}`);
    console.log(`  - Entities: ${entitiesCount || 0}`);
    console.log(`  - Lore: ${loreCount || 0}\n`);
    
    if ((worldsCount || 0) === 0 && (entitiesCount || 0) === 0 && (loreCount || 0) === 0) {
      console.log('✅ No legacy content to claim. All content already has owners.');
      return;
    }
    
    // Claim worlds
    if ((worldsCount || 0) > 0) {
      console.log(`🔨 Claiming ${worldsCount} world(s)...`);
      const { data: worldsData, error: worldsError } = await supabase
        .from('chimera_worlds')
        .update({ owner_user_id: user.id, visibility: 'private' })
        .is('owner_user_id', null)
        .select('id, name');
      
      if (worldsError) {
        console.error('❌ Error claiming worlds:', worldsError);
      } else {
        console.log(`✅ Successfully claimed ${worldsData?.length || 0} world(s)`);
        if (worldsData && worldsData.length > 0) {
          worldsData.forEach(w => console.log(`   - ${w.name || w.id}`));
        }
      }
    }
    
    // Claim entities
    if ((entitiesCount || 0) > 0) {
      console.log(`\n🔨 Claiming ${entitiesCount} entit(ies)...`);
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('chimera_entities')
        .update({ owner_user_id: user.id, visibility: 'private' })
        .is('owner_user_id', null)
        .select('id, key, display_name');
      
      if (entitiesError) {
        console.error('❌ Error claiming entities:', entitiesError);
      } else {
        console.log(`✅ Successfully claimed ${entitiesData?.length || 0} entit(ies)`);
        if (entitiesData && entitiesData.length > 0) {
          entitiesData.forEach(e => console.log(`   - ${e.display_name || e.key || e.id}`));
        }
      }
    }
    
    // Claim lore
    if ((loreCount || 0) > 0) {
      console.log(`\n🔨 Claiming ${loreCount} lore template(s)...`);
      const { data: loreData, error: loreError } = await supabase
        .from('chimera_lore')
        .update({ owner_user_id: user.id, visibility: 'private' })
        .is('owner_user_id', null)
        .select('id, key, display_name');
      
      if (loreError) {
        console.error('❌ Error claiming lore:', loreError);
      } else {
        console.log(`✅ Successfully claimed ${loreData?.length || 0} lore template(s)`);
        if (loreData && loreData.length > 0) {
          loreData.forEach(l => console.log(`   - ${l.display_name || l.key || l.id}`));
        }
      }
    }
    
    // Verify the claim
    console.log('\n🔍 Verifying claim...');
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
    console.log(`  - Worlds: ${remainingWorlds || 0}`);
    console.log(`  - Entities: ${remainingEntities || 0}`);
    console.log(`  - Lore: ${remainingLore || 0}`);
    
    if ((remainingWorlds || 0) === 0 && (remainingEntities || 0) === 0 && (remainingLore || 0) === 0) {
      console.log('\n🎉 All legacy content has been successfully claimed!');
      console.log(`💡 Content is now visible in "My Creations" for ${user.email}`);
    } else {
      console.log('\n⚠️  Some content still has NULL owner_user_id');
    }
    
  } catch (error) {
    console.error('❌ Error claiming legacy content:', error);
    process.exit(1);
  }
}

claimLegacyContent();

