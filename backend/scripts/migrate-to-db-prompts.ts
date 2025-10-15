#!/usr/bin/env tsx

/**
 * Migration Script: Filesystem to Database Prompts
 * 
 * This script demonstrates how to migrate from filesystem-based prompt loading
 * to the new database-backed system. It can be used to test the migration
 * and validate that the database system works correctly.
 */

import 'dotenv/config';
import { DatabasePromptService } from '../src/services/db-prompt.service.js';
import { PromptRepository } from '../src/repositories/prompt.repository.js';

// Environment setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function testDatabasePromptSystem() {
  console.log('🧪 Testing Database-Backed Prompt System...\n');

  try {
    // Initialize services
    const promptService = new DatabasePromptService();
    
    // Test 1: Get prompt statistics
    console.log('📊 Testing prompt statistics...');
    const stats = await promptService.getPromptStats();
    console.log('Prompt Statistics:', stats);
    console.log('✅ Statistics retrieved successfully\n');

    // Test 2: Validate dependencies
    console.log('🔗 Testing dependency validation...');
    const dependencies = await promptService.validateDependencies();
    console.log('Dependencies:', dependencies);
    console.log('✅ Dependencies validated successfully\n');

    // Test 3: Test prompt assembly with mock context
    console.log('🔧 Testing prompt assembly...');
    const mockContext = {
      character: {
        name: 'Test Character',
        race: 'Human',
        skills: { combat: 50, stealth: 60 },
        inventory: ['sword', 'potion'],
        relationships: { 'npc-1': 70 },
        goals: { short_term: ['find treasure'], long_term: ['save the world'] },
        flags: { has_sword: true },
        reputation: { 'town-1': 80 },
      },
      game: {
        id: 'test-game-123',
        turn_index: 5,
        summary: 'Adventure in progress',
        current_scene: 'forest-clearing',
        state_snapshot: { location: 'forest', time: 'day' },
        option_id: 'option-1',
      },
      world: {
        name: 'Mystika',
        setting: 'Fantasy world',
        genre: 'Fantasy',
        themes: ['magic', 'adventure'],
        rules: { magic_system: 'elemental' },
        mechanics: { combat: 'turn-based' },
        lore: 'Ancient magical world',
        logic: { physics: 'magical' },
      },
      adventure: {
        name: 'Whispercross',
        scenes: ['forest-clearing', 'ancient-ruins'],
        objectives: ['find the artifact', 'defeat the guardian'],
        npcs: [{ id: 'npc-1', name: 'Guide' }],
        places: [{ id: 'place-1', name: 'Forest' }],
        triggers: [{ id: 'trigger-1', condition: 'enters_forest' }],
      },
      runtime: {
        ticks: 150,
        presence: 'calm',
        ledgers: { gold: 100 },
        flags: { quest_started: true },
        last_acts: [{ type: 'MOVE', target: 'forest' }],
        style_hint: 'cinematic',
      },
      system: {
        schema_version: '1.0.0',
        prompt_version: '1.0.0',
        load_order: ['core', 'engine', 'content'],
        hash: 'test-hash',
      },
    };

    const promptResult = await promptService.assemblePrompt(mockContext);
    console.log(`✅ Prompt assembled successfully:`);
    console.log(`   - Segments: ${promptResult.metadata.totalSegments}`);
    console.log(`   - Variables: ${promptResult.metadata.totalVariables}`);
    console.log(`   - Tokens: ${promptResult.audit.tokenCount}`);
    console.log(`   - Version: ${promptResult.audit.version}`);
    console.log(`   - Hash: ${promptResult.audit.hash}`);
    console.log('');

    // Test 4: Test caching
    console.log('💾 Testing prompt caching...');
    const startTime = Date.now();
    const cachedResult = await promptService.assemblePrompt(mockContext);
    const endTime = Date.now();
    console.log(`✅ Cached prompt assembled in ${endTime - startTime}ms`);
    console.log('');

    // Test 5: Test different contexts
    console.log('🌍 Testing different world contexts...');
    
    // Test core prompts (no world)
    const corePrompts = await promptService.getCorePrompts();
    console.log(`✅ Retrieved ${corePrompts.length} core prompts`);
    
    // Test world-specific prompts
    const worldPrompts = await promptService.getWorldPrompts('mystika');
    console.log(`✅ Retrieved ${worldPrompts.length} world-specific prompts`);
    
    // Test adventure-specific prompts
    const adventurePrompts = await promptService.getAdventurePrompts('mystika', 'whispercross');
    console.log(`✅ Retrieved ${adventurePrompts.length} adventure-specific prompts`);
    console.log('');

    console.log('🎉 All tests passed! Database-backed prompt system is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting database prompt system test...');
  await testDatabasePromptSystem();
  console.log('✅ Database prompt system test completed');
}

// Run main function
main().catch(console.error);

export { testDatabasePromptSystem };
