#!/usr/bin/env node

/**
 * Demonstration script showing the improved JSON prompt cleaning functionality
 */

import { PromptLoader } from '../src/prompts/loader.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function demonstratePromptCleaning() {
  console.log('🧹 Prompt Generation JSON Cleaning Demo\n');
  
  const loader = new PromptLoader(join(process.cwd(), 'GPT Prompts'));
  
  // Example JSON with comments and extra whitespace
  const messyJson = `{
    // This is a comment about the system
    "name": "Example System",
    "version": "1.0.0",
    "about": "A demonstration of JSON cleaning",
    
    /* This is a block comment
       with multiple lines */
    "rules": {
      "enabled": true,
      "settings": [
        "option1",
        "option2",
        "option3"
      ]
    },
    
    "mechanics": {
      "type": "rpg",
      "complexity": "medium",
      "features": {
        "combat": true,
        "social": true,
        "exploration": false
      }
    }
  }`;

  console.log('📄 Original JSON (with comments and whitespace):');
  console.log('─'.repeat(60));
  console.log(messyJson);
  console.log('─'.repeat(60));
  console.log(`Length: ${messyJson.length} characters\n`);

  // Clean the JSON content
  const cleaned = loader.cleanJsonContent(messyJson);
  
  console.log('✨ Cleaned JSON (minimized):');
  console.log('─'.repeat(60));
  console.log(cleaned);
  console.log('─'.repeat(60));
  console.log(`Length: ${cleaned.length} characters`);
  console.log(`Reduction: ${((messyJson.length - cleaned.length) / messyJson.length * 100).toFixed(1)}%\n`);

  // Parse and format as prompt
  const parsed = JSON.parse(cleaned);
  const formatted = loader.formatJsonAsPrompt(parsed, 'example-system');
  
  console.log('📝 Formatted Prompt (with markdown code blocks):');
  console.log('─'.repeat(60));
  console.log(formatted);
  console.log('─'.repeat(60));
  console.log(`Length: ${formatted.length} characters\n`);

  // Show section formatting
  console.log('🔧 Section Formatting Examples:');
  console.log('─'.repeat(60));
  
  const rulesSection = loader.formatJsonSection(parsed.rules);
  console.log('Rules Section:');
  console.log(rulesSection);
  console.log();
  
  const mechanicsSection = loader.formatJsonSection(parsed.mechanics);
  console.log('Mechanics Section:');
  console.log(mechanicsSection);
  console.log();

  console.log('✅ Benefits of the new system:');
  console.log('• JSON content is minimized to reduce token usage');
  console.log('• Comments and unnecessary whitespace are removed');
  console.log('• JSON is properly wrapped in markdown code blocks');
  console.log('• Sections include both summaries and complete JSON');
  console.log('• Complete configuration is available for reference');
  console.log('• Better readability and maintainability');
}

// Run the demonstration
demonstratePromptCleaning().catch(console.error);
