#!/usr/bin/env node

/**
 * Test script to demonstrate prompt cleaning in action
 * This will show the cleaned prompt output in the console
 */

import { PromptLoader } from '../dist/prompts/loader.js';
import { PromptAssembler } from '../dist/prompts/assembler.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testPromptCleaning() {
  console.log('🧪 Testing Prompt Cleaning in Action\n');
  
  try {
    // Test 1: JSON Content Cleaning
    console.log('1️⃣ Testing JSON Content Cleaning');
    console.log('─'.repeat(60));
    
    const loader = new PromptLoader(join(process.cwd(), 'AI API Prompts'));
    
    // Example messy JSON
    const messyJson = `{
      // This is a comment
      "name": "Test System",
      "version": "1.0.0",
      "about": "A test system",
      
      /* Block comment */
      "rules": {
        "enabled": true,
        "settings": ["option1", "option2"]
      }
    }`;

    console.log('Original JSON:');
    console.log(messyJson);
    console.log(`Length: ${messyJson.length} chars\n`);

    const cleaned = loader.cleanJsonContent(messyJson);
    console.log('Cleaned JSON:');
    console.log(cleaned);
    console.log(`Length: ${cleaned.length} chars`);
    console.log(`Reduction: ${((messyJson.length - cleaned.length) / messyJson.length * 100).toFixed(1)}%\n`);

    // Test 2: Prompt Assembly (if templates exist)
    console.log('2️⃣ Testing Prompt Assembly');
    console.log('─'.repeat(60));
    
    try {
      const assembler = new PromptAssembler();
      await assembler.initialize('mystika');
      
      // Create a test context
      const testContext = {
        character: {
          name: 'Test Character',
          level: 1,
          race: 'Human',
          class: 'Warrior'
        },
        game: {
          id: 'test-game-123',
          turn_index: 1,
          summary: 'Test game',
          current_scene: 'test-scene',
          state_snapshot: {},
          option_id: 'test-option'
        },
        world: {
          name: 'Mystika',
          setting: 'Fantasy',
          genre: 'RPG',
          themes: ['adventure', 'magic'],
          rules: {},
          mechanics: {},
          lore: 'A magical world',
          logic: {}
        },
        adventure: {
          name: 'Test Adventure',
          scenes: [],
          objectives: [],
          npcs: [],
          places: [],
          triggers: []
        },
        runtime: {
          ticks: 1,
          presence: 'active',
          ledgers: {},
          flags: {},
          last_acts: [],
          style_hint: 'test'
        },
        system: {
          schema_version: '1.0.0',
          prompt_version: '1.0.0',
          load_order: [],
          hash: 'test-hash'
        }
      };

      const result = await assembler.assemblePrompt(testContext);
      
      console.log('✅ Prompt assembly successful!');
      console.log(`Final prompt length: ${result.prompt.length} characters`);
      console.log(`Templates used: ${result.audit.templateIds.length}`);
      console.log(`Token count: ${result.audit.tokenCount}`);
      
      // Show a preview of the cleaned prompt
      const preview = result.prompt.length > 800 ? result.prompt.substring(0, 800) + '...' : result.prompt;
      console.log('\n📝 Cleaned Prompt Preview:');
      console.log('─'.repeat(80));
      console.log(preview);
      console.log('─'.repeat(80));
      
    } catch (error) {
      console.log('⚠️  Prompt assembly test skipped (templates may not be available)');
      console.log(`Error: ${error.message}`);
    }

    console.log('\n✅ Prompt cleaning test completed!');
    console.log('\n🔍 To see cleaned prompts in live debug output:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Make a game turn request');
    console.log('3. Check the console output for [DEBUG] and [TURNS_SERVICE] logs');
    console.log('4. Look for "Cleaned prompt content" sections');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPromptCleaning().catch(console.error);
