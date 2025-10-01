#!/usr/bin/env node

/**
 * Setup script for StoneCaster configuration
 * This script runs the database migrations and seeds the configuration tables
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
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

async function runMigration(filename) {
  console.log(`📄 Running migration: ${filename}`);
  
  try {
    const migrationPath = join(__dirname, '..', '..', 'supabase', 'migrations', filename);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error(`❌ Migration ${filename} failed:`, error.message);
      throw error;
    }
    
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Failed to run migration ${filename}:`, error.message);
    throw error;
  }
}

async function verifyConfig() {
  console.log('🔍 Verifying configuration...');
  
  try {
    // Check all config tables exist and have data
    const tables = ['app_config', 'pricing_config', 'ai_config', 'feature_flags', 'config_meta'];
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*');
      
      if (error) {
        console.error(`❌ Failed to query ${table}:`, error.message);
        throw error;
      }
      
      console.log(`✅ ${table}: ${data.length} rows`);
    }
    
    // Check specific baseline values
    const { data: pricingData } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('key', 'turn_cost_default');
    
    if (pricingData && pricingData.length > 0) {
      const value = pricingData[0].value.value;
      console.log(`✅ Baseline pricing config verified: turn_cost_default = ${value}`);
    }
    
    const { data: metaData } = await supabase
      .from('config_meta')
      .select('*')
      .single();
    
    if (metaData) {
      console.log(`✅ Config meta verified: version = ${metaData.version}`);
    }
    
  } catch (error) {
    console.error('❌ Configuration verification failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Setting up StoneCaster configuration...\n');
  
  try {
    // Run migrations
    await runMigration('002_config_tables.sql');
    await runMigration('003_config_seed.sql');
    
    // Verify configuration
    await verifyConfig();
    
    console.log('\n🎉 Configuration setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Test the config endpoint: curl http://localhost:3000/api/config');
    console.log('3. Run tests: npm test');
    
  } catch (error) {
    console.error('\n❌ Configuration setup failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();

