#!/usr/bin/env node

/**
 * Apply database migrations manually
 * This script applies the necessary migrations to fix the current issues
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function applyMigration(filename) {
  console.log(`📄 Applying migration: ${filename}`);
  
  try {
    const migrationPath = join(__dirname, '..', '..', 'supabase', 'migrations', filename);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`  Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // Some errors are expected (like "already exists")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('already exists') ||
              error.message.includes('policy') && error.message.includes('already exists') ||
              error.message.includes('trigger') && error.message.includes('already exists') ||
              error.message.includes('index') && error.message.includes('already exists')) {
            console.log(`  ⚠️  Expected: ${error.message}`);
          } else {
            console.error(`  ❌ Error: ${error.message}`);
            throw error;
          }
        } else {
          console.log(`  ✅ Success`);
        }
      }
    }
    
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Failed to apply migration ${filename}:`, error.message);
    throw error;
  }
}

async function applyMigrations() {
  console.log('🚀 Applying database migrations...');
  
  try {
    // Apply the migrations in order
    await applyMigration('013_allow_both_user_cookie_ids.sql');
    
    console.log('🎉 All migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migrations
applyMigrations();
