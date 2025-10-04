#!/usr/bin/env node

/**
 * Check current database constraints on the characters table
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConstraints() {
  console.log('🔍 Checking current constraints on characters table...');
  
  try {
    // Check if we can query the characters table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('characters')
      .select('*')
      .limit(0);
    
    if (tableError) {
      console.error('❌ Error accessing characters table:', tableError);
      return;
    }
    
    console.log('✅ Characters table is accessible');
    
    // Try to get table information (this might not work with Supabase client)
    console.log('📋 Attempting to get table constraints...');
    
    // Since we can't directly query constraints via the client,
    // let's try a different approach - test the actual constraint behavior
    
    console.log('🧪 Testing constraint behavior...');
    
    // Test 1: Try to insert with user_id only
    const testUserChar = {
      id: uuidv4(),
      name: 'Test User Character',
      world_slug: 'mystika',
      race: 'Test Race',
      class: 'Test Class',
      level: 1,
      experience: 0,
      attributes: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: ['test-skill'],
      inventory: [],
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: uuidv4(),
    };
    
    console.log('  📝 Testing user_id only character...');
    const { data: userChar, error: userError } = await supabase
      .from('characters')
      .insert([testUserChar])
      .select()
      .single();
    
    if (userError) {
      console.log('  ❌ User character failed:', userError.message);
    } else {
      console.log('  ✅ User character succeeded:', userChar.id);
      // Clean up
      await supabase.from('characters').delete().eq('id', userChar.id);
    }
    
    // Test 2: Try to insert with cookie_id only
    const testCookieChar = {
      id: uuidv4(),
      name: 'Test Cookie Character',
      world_slug: 'mystika',
      race: 'Test Race',
      class: 'Test Class',
      level: 1,
      experience: 0,
      attributes: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: ['test-skill'],
      inventory: [],
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cookie_id: uuidv4(),
    };
    
    console.log('  📝 Testing cookie_id only character...');
    const { data: cookieChar, error: cookieError } = await supabase
      .from('characters')
      .insert([testCookieChar])
      .select()
      .single();
    
    if (cookieError) {
      console.log('  ❌ Cookie character failed:', cookieError.message);
      console.log('  🔍 Error code:', cookieError.code);
      console.log('  🔍 Error details:', cookieError.details);
    } else {
      console.log('  ✅ Cookie character succeeded:', cookieChar.id);
      // Clean up
      await supabase.from('characters').delete().eq('id', cookieChar.id);
    }
    
    // Test 3: Try to insert with both
    const testBothChar = {
      id: uuidv4(),
      name: 'Test Both Character',
      world_slug: 'mystika',
      race: 'Test Race',
      class: 'Test Class',
      level: 1,
      experience: 0,
      attributes: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: ['test-skill'],
      inventory: [],
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: uuidv4(),
      cookie_id: uuidv4(),
    };
    
    console.log('  📝 Testing both user_id and cookie_id character...');
    const { data: bothChar, error: bothError } = await supabase
      .from('characters')
      .insert([testBothChar])
      .select()
      .single();
    
    if (bothError) {
      console.log('  ❌ Both character failed:', bothError.message);
    } else {
      console.log('  ✅ Both character succeeded:', bothChar.id);
      // Clean up
      await supabase.from('characters').delete().eq('id', bothChar.id);
    }
    
    // Test 4: Try to insert with neither (should fail)
    const testNeitherChar = {
      id: uuidv4(),
      name: 'Test Neither Character',
      world_slug: 'mystika',
      race: 'Test Race',
      class: 'Test Class',
      level: 1,
      experience: 0,
      attributes: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: ['test-skill'],
      inventory: [],
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    console.log('  📝 Testing neither user_id nor cookie_id character (should fail)...');
    const { data: neitherChar, error: neitherError } = await supabase
      .from('characters')
      .insert([testNeitherChar])
      .select()
      .single();
    
    if (neitherError) {
      console.log('  ✅ Neither character failed as expected:', neitherError.message);
    } else {
      console.log('  ⚠️  Neither character succeeded (unexpected):', neitherChar.id);
      // Clean up
      await supabase.from('characters').delete().eq('id', neitherChar.id);
    }
    
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  }
}

// Run the constraint check
checkConstraints();
