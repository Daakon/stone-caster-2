#!/usr/bin/env tsx
/**
 * Inspect Other Tables Script
 * 
 * Lists all tables in the public schema that are NOT:
 * - chimera_*
 * - awf_*
 * - stone_*
 * - mod_*
 * 
 * Purpose: Identify remaining tables that may be legacy candidates for deletion.
 * Date: 2025-12-04
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.PROD_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_KEY');
  console.error('   Or: PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectOtherTables() {
  console.log('🔍 Inspecting database tables...\n');
  
  try {
    // Try to query information_schema via REST API
    console.log('📡 Attempting to query information_schema...');
    
    const sqlQuery = `
      SELECT 
        table_schema as schemaname,
        table_name as table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'chimera_%'
        AND table_name NOT LIKE 'awf_%'
        AND table_name NOT LIKE 'stone_%'
        AND table_name NOT LIKE 'mod_%'
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT LIKE 'sql_%'
      ORDER BY table_name;
    `;
    
    // Use REST API to execute query
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql_query: sqlQuery })
    });
    
    if (!response.ok) {
      throw new Error(`RPC exec_sql not available (${response.status})`);
    }
    
    const data = await response.json();
    console.log(`✅ Found ${data.length || 0} tables\n`);
    
    // Format output
    const outputPath = join(__dirname, '../../docs/FINAL_TABLE_AUDIT.txt');
    let output = `FINAL TABLE AUDIT - Other Tables
Generated: ${new Date().toISOString()}
Total Tables Found: ${data.length || 0}

================================================================================

TABLE LIST:
===========

`;
    
    if (data && data.length > 0) {
      data.forEach((row: any, index: number) => {
        output += `${index + 1}. ${row.table_name || row.table_name}\n`;
      });
    } else {
      output += 'No tables found matching the criteria.\n';
    }
    
    output += `
================================================================================

NOTES:
- These tables are NOT prefixed with chimera_*, awf_*, stone_*, or mod_*
- They may be legacy tables that can be dropped
- Review each table before deletion
- Check for foreign key dependencies

================================================================================
`;
    
    writeFileSync(outputPath, output, 'utf-8');
    console.log(`✅ Results saved to: ${outputPath}\n`);
    
  } catch (error: any) {
    console.log('⚠️  Direct query failed:', error.message);
    console.log('\n📋 Falling back to manual SQL execution...\n');
    
    // Read SQL file and provide instructions
    const sqlPath = join(__dirname, 'inspect_other_tables.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');
    
    const outputPath = join(__dirname, '../../docs/FINAL_TABLE_AUDIT.txt');
    const instructions = `FINAL TABLE AUDIT - Other Tables
Generated: ${new Date().toISOString()} (Manual execution required)

================================================================================

INSTRUCTIONS:
=============

To generate the actual table audit, run the SQL query below in Supabase Dashboard:

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the SQL query below
3. Execute the query
4. Export results and update this file

SQL QUERY:
==========

${sqlContent}

================================================================================
`;

    writeFileSync(outputPath, instructions, 'utf-8');
    console.log(`✅ Created instruction file: ${outputPath}`);
    console.log('   Please run the SQL query manually in Supabase Dashboard.\n');
  }
}

inspectOtherTables();

