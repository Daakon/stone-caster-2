#!/usr/bin/env node

/**
 * Fix characters table schema to support guest users
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

async function fixCharactersSchema() {
  console.log('🔧 Fixing characters table schema to support guest users...');
  
  try {
    // First, let's check the current schema
    console.log('📋 Checking current characters table schema...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, is_nullable, data_type')
      .eq('table_name', 'characters')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Error checking schema:', columnsError);
      return;
    }
    
    console.log('Current columns:', columns);
    
    // Check if cookie_id column exists
    const hasCookieId = columns.some(col => col.column_name === 'cookie_id');
    const hasWorldSlug = columns.some(col => col.column_name === 'world_slug');
    
    if (!hasCookieId) {
      console.log('➕ Adding cookie_id column...');
      const { error: addCookieError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE characters ADD COLUMN cookie_id UUID;'
      });
      
      if (addCookieError) {
        console.error('❌ Error adding cookie_id column:', addCookieError);
        return;
      }
      console.log('✅ Added cookie_id column');
    } else {
      console.log('✅ cookie_id column already exists');
    }
    
    if (!hasWorldSlug) {
      console.log('➕ Adding world_slug column...');
      const { error: addWorldError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE characters ADD COLUMN world_slug VARCHAR(100);'
      });
      
      if (addWorldError) {
        console.error('❌ Error adding world_slug column:', addWorldError);
        return;
      }
      console.log('✅ Added world_slug column');
    } else {
      console.log('✅ world_slug column already exists');
    }
    
    // Update existing characters to have a default world_slug
    console.log('🔄 Setting default world_slug for existing characters...');
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: "UPDATE characters SET world_slug = 'mystika' WHERE world_slug IS NULL;"
    });
    
    if (updateError) {
      console.error('❌ Error updating world_slug:', updateError);
      return;
    }
    console.log('✅ Updated world_slug for existing characters');
    
    // Make world_slug NOT NULL
    console.log('🔒 Making world_slug NOT NULL...');
    const { error: notNullError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE characters ALTER COLUMN world_slug SET NOT NULL;'
    });
    
    if (notNullError) {
      console.error('❌ Error making world_slug NOT NULL:', notNullError);
      return;
    }
    console.log('✅ Made world_slug NOT NULL');
    
    // Add constraint to ensure either user_id or cookie_id is present
    console.log('🔒 Adding owner constraint...');
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE characters ADD CONSTRAINT characters_owner_check 
            CHECK (
              (user_id IS NOT NULL AND cookie_id IS NULL) OR 
              (user_id IS NULL AND cookie_id IS NOT NULL)
            );`
    });
    
    if (constraintError) {
      console.error('❌ Error adding constraint:', constraintError);
      return;
    }
    console.log('✅ Added owner constraint');
    
    // Create indexes
    console.log('📊 Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_characters_world_slug ON characters(world_slug);
        CREATE INDEX IF NOT EXISTS idx_characters_cookie_id ON characters(cookie_id);
      `
    });
    
    if (indexError) {
      console.error('❌ Error creating indexes:', indexError);
      return;
    }
    console.log('✅ Created indexes');
    
    console.log('🎉 Characters table schema fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
  }
}

// Run the fix
fixCharactersSchema();
