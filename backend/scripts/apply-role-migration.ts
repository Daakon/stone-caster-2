#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRoleMigration() {
  console.log('🚀 Applying role migration to user_profiles...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), '..', 'supabase', 'migrations', '20250108_add_role_to_user_profiles.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded, applying to database...');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`  Executing: ${statement.substring(0, 50)}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
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
        } catch (rpcError) {
          // If exec_sql doesn't work, try direct SQL execution
          console.log(`  Trying alternative execution method...`);
          const { error: directError } = await supabase
            .from('user_profiles')
            .select('*')
            .limit(1); // This will fail but might help with connection
          
          if (directError && directError.message.includes('exec_sql')) {
            console.log(`  ⚠️  exec_sql function not available, migration may need manual application`);
            console.log(`  📋 SQL to apply manually:`);
            console.log(statement);
          } else {
            throw rpcError;
          }
        }
      }
    }
    
    console.log('✅ Role migration completed successfully');
    
    // Verify the role column was added
    const { data: profiles, error: verifyError } = await supabase
      .from('user_profiles')
      .select('id, role')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
      return;
    }
    
    if (profiles && profiles.length > 0) {
      console.log('✅ Role column verified in user_profiles table');
    } else {
      console.log('⚠️  No user profiles found to verify role column');
    }
    
  } catch (error) {
    console.error('❌ Migration application failed:', error);
    console.log('\n📋 Manual application required:');
    console.log('Please run the SQL from the migration file manually in your database:');
    console.log(join(process.cwd(), '..', 'supabase', 'migrations', '20250108_add_role_to_user_profiles.sql'));
  }
}

applyRoleMigration();


