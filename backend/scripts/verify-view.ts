#!/usr/bin/env tsx
/**
 * Verify profiles_view Script
 * Phase 3.8: Verify that profiles_view exists and is accessible to Service Role
 * Provides SQL fix if the view is missing
 * 
 * Usage: npx tsx backend/scripts/verify-view.ts
 */

import 'dotenv/config';
import { supabaseAdmin } from '../src/services/supabase.js';

const CREATE_VIEW_SQL = `
-- ============================================================================
-- Phase 3.6: Create profiles_view for Role Management
-- View to join profiles and auth.users for displaying user roles with emails
-- ============================================================================

-- View to join profiles and auth.users
-- This allows the Admin UI to display both Role (from public.profiles) 
-- and Email (from auth.users) without complex client-side joins
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT
  p.id,
  p.role,
  au.updated_at,
  au.created_at,
  au.email,
  au.last_sign_in_at,
  au.raw_user_meta_data
FROM public.profiles p
JOIN auth.users au ON p.id = au.id;

-- Grant access permissions
ALTER VIEW public.profiles_view OWNER TO postgres;
GRANT SELECT ON public.profiles_view TO authenticated;

-- Note: RLS does not apply to Views automatically.
-- If strictly for Admins, we will filter in the application layer
-- or simple RLS on the underlying table if security_invoker is used.
`;

async function verifyView() {
  console.log('🔍 Checking for public.profiles_view...\n');

  try {
    // Test query to profiles_view using count (head: true means no data returned, just count)
    const { data, error, count } = await supabaseAdmin
      .from('profiles_view')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ View Verification Failed:');
      console.error(`   Code: ${error.code || 'UNKNOWN'}`);
      console.error(`   Message: ${error.message}`);
      if (error.details) console.error(`   Details: ${error.details}`);
      if (error.hint) console.error(`   Hint: ${error.hint}`);
      
      // Check if it's a "relation does not exist" error
      const isMissingView = error.code === 'PGRST204' || 
                           error.code === '42P01' ||
                           error.message?.toLowerCase().includes('does not exist') ||
                           error.message?.toLowerCase().includes('relation') ||
                           error.message?.toLowerCase().includes('view');

      if (isMissingView) {
        console.log('\n💡 ACTION REQUIRED:');
        console.log('The database migration did not apply. The profiles_view is missing.');
        console.log('\n📋 Please run the following SQL in your Supabase Dashboard SQL Editor:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(CREATE_VIEW_SQL);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📍 Steps:');
        console.log('   1. Open your Supabase Dashboard');
        console.log('   2. Go to SQL Editor');
        console.log('   3. Paste the SQL above');
        console.log('   4. Click "Run"');
        console.log('   5. Re-run this script to verify: npx tsx backend/scripts/verify-view.ts\n');
      } else {
        console.log('\n⚠️  This appears to be a different error (not a missing view).');
        console.log('   Please check your database connection and permissions.\n');
      }
      
      process.exit(1);
    }

    // If we get here, the view exists
    console.log('✅ profiles_view exists and is accessible!');
    
    // Try to get actual data to show sample
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('profiles_view')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log(`⚠️  View exists but query returned error: ${sampleError.message}`);
    } else if (sampleData && sampleData.length > 0) {
      console.log('\n📋 Sample record:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    } else {
      console.log('\n⚠️  View is accessible but contains no records.');
      console.log('   This is normal if no users exist yet.');
    }

    if (count !== null && count !== undefined) {
      console.log(`\n📊 Total records in view: ${count}`);
    }

    console.log('\n✅ Verification successful!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

verifyView();

