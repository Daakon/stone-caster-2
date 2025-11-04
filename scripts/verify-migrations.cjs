#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Migration Verification Script');
console.log('================================');
console.log('');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  console.log('   Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigrations() {
  console.log('🔍 Checking database schema...');
  console.log('');

  try {
    // Check if npcs table exists and has the required columns
    console.log('1. Checking npcs table...');
    const { data: npcsData, error: npcsError } = await supabase
      .from('npcs')
      .select('id, name, visibility, user_id, author_name, author_type')
      .limit(1);

    if (npcsError) {
      console.log('   ❌ npcs table error:', npcsError.message);
      if (npcsError.message.includes('column npcs.visibility does not exist')) {
        console.log('   🚨 CRITICAL: The visibility column is missing!');
        console.log('   📋 You need to run migration #9: 20250205_npc_visibility_and_authors_fixed.sql');
      }
    } else {
      console.log('   ✅ npcs table exists with required columns');
    }

    // Check if rulesets table exists
    console.log('2. Checking rulesets table...');
    const { data: rulesetsData, error: rulesetsError } = await supabase
      .from('rulesets')
      .select('id, name, status')
      .limit(1);

    if (rulesetsError) {
      console.log('   ❌ rulesets table error:', rulesetsError.message);
    } else {
      console.log('   ✅ rulesets table exists');
    }

    // Check if entries table exists
    console.log('3. Checking entries table...');
    const { data: entriesData, error: entriesError } = await supabase
      .from('entries')
      .select('id, name, status')
      .limit(1);

    if (entriesError) {
      console.log('   ❌ entries table error:', entriesError.message);
    } else {
      console.log('   ✅ entries table exists');
    }

    // Check if worlds_admin view exists
    console.log('4. Checking worlds_admin view...');
    const { data: worldsData, error: worldsError } = await supabase
      .from('worlds_admin')
      .select('id, name, status')
      .limit(1);

    if (worldsError) {
      console.log('   ❌ worlds_admin view error:', worldsError.message);
    } else {
      console.log('   ✅ worlds_admin view exists');
    }

    console.log('');
    console.log('📊 SUMMARY:');
    if (npcsError && npcsError.message.includes('visibility does not exist')) {
      console.log('❌ MIGRATIONS NOT COMPLETE');
      console.log('   The npcs.visibility column is missing');
      console.log('   You need to run all 9 migrations in your Supabase SQL Editor');
    } else if (npcsError || rulesetsError || entriesError || worldsError) {
      console.log('⚠️  PARTIAL MIGRATIONS');
      console.log('   Some tables exist but others are missing');
      console.log('   Check the errors above and run missing migrations');
    } else {
      console.log('✅ ALL MIGRATIONS COMPLETE');
      console.log('   Your frontend should work without database errors');
    }

  } catch (error) {
    console.log('❌ Verification failed:', error.message);
  }
}

verifyMigrations();









