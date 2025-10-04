#!/usr/bin/env node

/**
 * Simple schema fix for characters table
 * This script applies the necessary changes to allow guest character creation
 */

import { createClient } from '@supabase/supabase-js';
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

async function fixSchema() {
  console.log('🔧 Applying schema fixes for guest character support...');
  
  try {
    // Try to add cookie_id column (ignore if it already exists)
    console.log('➕ Adding cookie_id column...');
    const { error: cookieError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE characters ADD COLUMN IF NOT EXISTS cookie_id UUID;'
    });
    
    if (cookieError) {
      console.log('⚠️  cookie_id column might already exist:', cookieError.message);
    } else {
      console.log('✅ Added cookie_id column');
    }
    
    // Try to add world_slug column (ignore if it already exists)
    console.log('➕ Adding world_slug column...');
    const { error: worldError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE characters ADD COLUMN IF NOT EXISTS world_slug VARCHAR(100);'
    });
    
    if (worldError) {
      console.log('⚠️  world_slug column might already exist:', worldError.message);
    } else {
      console.log('✅ Added world_slug column');
    }
    
    // Update existing characters to have a default world_slug
    console.log('🔄 Setting default world_slug for existing characters...');
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: "UPDATE characters SET world_slug = 'mystika' WHERE world_slug IS NULL;"
    });
    
    if (updateError) {
      console.log('⚠️  Error updating world_slug:', updateError.message);
    } else {
      console.log('✅ Updated world_slug for existing characters');
    }
    
    // Make world_slug NOT NULL
    console.log('🔒 Making world_slug NOT NULL...');
    const { error: notNullError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE characters ALTER COLUMN world_slug SET NOT NULL;'
    });
    
    if (notNullError) {
      console.log('⚠️  Error making world_slug NOT NULL:', notNullError.message);
    } else {
      console.log('✅ Made world_slug NOT NULL');
    }
    
    // Try to add the owner constraint
    console.log('🔒 Adding owner constraint...');
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_owner_check;
            ALTER TABLE characters ADD CONSTRAINT characters_owner_check 
            CHECK (
              (user_id IS NOT NULL AND cookie_id IS NULL) OR 
              (user_id IS NULL AND cookie_id IS NOT NULL)
            );`
    });
    
    if (constraintError) {
      console.log('⚠️  Error adding constraint:', constraintError.message);
    } else {
      console.log('✅ Added owner constraint');
    }
    
    // Create indexes
    console.log('📊 Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_characters_world_slug ON characters(world_slug);
        CREATE INDEX IF NOT EXISTS idx_characters_cookie_id ON characters(cookie_id);
      `
    });
    
    if (indexError) {
      console.log('⚠️  Error creating indexes:', indexError.message);
    } else {
      console.log('✅ Created indexes');
    }
    
    console.log('🎉 Schema fixes applied!');
    
  } catch (error) {
    console.error('❌ Error applying schema fixes:', error);
  }
}

// Run the fix
fixSchema();
