#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('🔍 Checking database connection and schema...');
  
  try {
    // Check if the prompting schema exists
    const { data: schemas, error: schemaError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'prompting');
    
    if (schemaError) {
      console.error('❌ Error checking schemas:', schemaError);
      return;
    }
    
    if (schemas && schemas.length > 0) {
      console.log('✅ Prompting schema exists');
    } else {
      console.log('❌ Prompting schema does not exist');
      return;
    }
    
    // Check if the prompts table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'prompting')
      .eq('table_name', 'prompts');
    
    if (tableError) {
      console.error('❌ Error checking tables:', tableError);
      return;
    }
    
    if (tables && tables.length > 0) {
      console.log('✅ Prompts table exists');
      
      // Check if there are any records
      const { data: records, error: recordsError } = await supabase
        .from('prompting.prompts')
        .select('id')
        .limit(1);
      
      if (recordsError) {
        console.error('❌ Error checking records:', recordsError);
        return;
      }
      
      console.log(`📊 Found ${records?.length || 0} prompt records`);
    } else {
      console.log('❌ Prompts table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase();
