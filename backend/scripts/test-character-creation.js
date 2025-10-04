#!/usr/bin/env node

/**
 * Test character creation endpoint
 * This script tests the character creation functionality
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

async function testCharacterCreation() {
  console.log('🧪 Testing character creation...');
  
  try {
    // Test 1: Check if characters table exists and has the right structure
    console.log('📋 Checking characters table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'characters')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Error checking table structure:', columnsError);
      return;
    }
    
    console.log('✅ Characters table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test 2: Check if we can insert a test character
    console.log('📝 Testing character insertion...');
    const testCharacter = {
      id: 'test-character-123',
      name: 'Test Character',
      world_slug: 'mystika',
      race: 'Test Race',
      class: 'Test Class',
      level: 1,
      experience: 0,
      attributes: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: ['test-skill'],
      inventory: [],
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'test-user-123', // Use user_id for this test
    };
    
    const { data, error } = await supabase
      .from('characters')
      .insert([testCharacter])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error inserting test character:', error);
      return;
    }
    
    console.log('✅ Test character inserted successfully:', data.id);
    
    // Test 3: Clean up test character
    console.log('🧹 Cleaning up test character...');
    const { error: deleteError } = await supabase
      .from('characters')
      .delete()
      .eq('id', 'test-character-123');
    
    if (deleteError) {
      console.error('⚠️  Error cleaning up test character:', deleteError);
    } else {
      console.log('✅ Test character cleaned up');
    }
    
    console.log('🎉 Character creation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCharacterCreation();
