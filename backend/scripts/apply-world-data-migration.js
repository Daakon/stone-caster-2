#!/usr/bin/env node

/**
 * Apply the world_data migration to characters table
 * This script adds the missing world_data, avatar, and backstory columns
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

async function applyWorldDataMigration() {
  console.log('🔧 Applying world_data migration to characters table...');
  
  try {
    // Read the migration file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationPath = path.join(__dirname, '../../supabase/migrations/017_add_world_data_to_characters.sql');
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration using rpc
    console.log('  📝 Executing migration SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('  ❌ Migration failed:', error);
      return false;
    }
    
    console.log('  ✅ Migration executed successfully');
    
    // Test that the columns exist
    console.log('  🧪 Testing new columns...');
    const { data: testData, error: testError } = await supabase
      .from('characters')
      .select('id, name, world_data, avatar, backstory')
      .limit(1);
    
    if (testError) {
      console.error('  ❌ Error testing new columns:', testError);
      return false;
    }
    
    console.log('  ✅ New columns are accessible');
    console.log('  📊 Sample data:', testData?.[0] || 'No characters found');
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Applying world_data migration...');
  
  const success = await applyWorldDataMigration();
  
  if (success) {
    console.log('🎉 Migration completed successfully!');
    console.log('💡 The characters table now has world_data, avatar, and backstory columns');
  } else {
    console.log('❌ Migration failed');
    console.log('💡 You may need to run the SQL migration directly in your Supabase dashboard');
    console.log('💡 The migration file is at: supabase/migrations/017_add_world_data_to_characters.sql');
  }
}

// Run the migration
main();
