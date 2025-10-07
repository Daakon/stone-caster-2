#!/usr/bin/env node

/**
 * Simple test to demonstrate JSON cleaning functionality
 * This shows the cleaning in action without requiring a full build
 */

// Simulate the JSON cleaning function
function cleanJsonContent(content) {
  // Remove JSON comments (// and /* */ style comments)
  let cleaned = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
    .replace(/\/\/.*$/gm, '') // Remove // comments
    .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
    .trim();
  
  try {
    // Parse and re-stringify to ensure valid JSON and remove extra whitespace
    const parsed = JSON.parse(cleaned);
    return JSON.stringify(parsed, null, 0);
  } catch (error) {
    // If parsing fails, return the cleaned content as-is
    console.warn('Failed to parse JSON content for cleaning:', error.message);
    return cleaned;
  }
}

function minimizeJson(obj) {
  return JSON.stringify(obj, null, 0);
}

function formatJsonAsPrompt(parsed, filename) {
  // Create a human-readable format from JSON
  let formatted = `## ${filename}\n\n`;
  
  if (parsed.name || parsed.title) {
    formatted += `**Name**: ${parsed.name || parsed.title}\n\n`;
  }
  
  if (parsed.version) {
    formatted += `**Version**: ${parsed.version}\n\n`;
  }
  
  if (parsed.about || parsed.description) {
    formatted += `**About**: ${parsed.about || parsed.description}\n\n`;
  }
  
  // Add key sections with minimized JSON in code blocks
  const keySections = ['rules', 'mechanics', 'policies', 'constraints', 'guidelines', 'awf_contract', 'schemas'];
  for (const section of keySections) {
    if (parsed[section]) {
      formatted += `### ${section.charAt(0).toUpperCase() + section.slice(1)}\n\n`;
      formatted += formatJsonSection(parsed[section]);
      formatted += '\n\n';
    }
  }
  
  // Add complete minimized JSON at the end for reference
  formatted += `### Complete Configuration\n\n\`\`\`json\n${minimizeJson(parsed)}\n\`\`\`\n\n`;
  
  return formatted.trim();
}

function formatJsonSection(section) {
  if (typeof section === 'string') {
    return section;
  } else if (Array.isArray(section)) {
    // For arrays, show a summary and include minimized JSON
    const summary = section.length > 0 ? `${section.length} items` : 'Empty array';
    return `${summary}\n\n\`\`\`json\n${minimizeJson(section)}\n\`\`\``;
  } else if (typeof section === 'object' && section !== null) {
    // For objects, show key summary and include minimized JSON
    const keys = Object.keys(section);
    const summary = keys.length > 0 ? `Keys: ${keys.join(', ')}` : 'Empty object';
    return `${summary}\n\n\`\`\`json\n${minimizeJson(section)}\n\`\`\``;
  }
  return `\`\`\`json\n${minimizeJson(section)}\n\`\`\``;
}

async function demonstratePromptCleaning() {
  console.log('🧹 Prompt Generation JSON Cleaning Demo\n');
  
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
  const cleaned = cleanJsonContent(messyJson);
  
  console.log('✨ Cleaned JSON (minimized):');
  console.log('─'.repeat(60));
  console.log(cleaned);
  console.log('─'.repeat(60));
  console.log(`Length: ${cleaned.length} characters`);
  console.log(`Reduction: ${((messyJson.length - cleaned.length) / messyJson.length * 100).toFixed(1)}%\n`);

  // Parse and format as prompt
  const parsed = JSON.parse(cleaned);
  const formatted = formatJsonAsPrompt(parsed, 'example-system');
  
  console.log('📝 Formatted Prompt (with markdown code blocks):');
  console.log('─'.repeat(60));
  console.log(formatted);
  console.log('─'.repeat(60));
  console.log(`Length: ${formatted.length} characters\n`);

  // Show section formatting
  console.log('🔧 Section Formatting Examples:');
  console.log('─'.repeat(60));
  
  const rulesSection = formatJsonSection(parsed.rules);
  console.log('Rules Section:');
  console.log(rulesSection);
  console.log();
  
  const mechanicsSection = formatJsonSection(parsed.mechanics);
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
  
  console.log('\n🔍 To see this in live debug output:');
  console.log('1. Start the backend server: npm run dev');
  console.log('2. Make a game turn request');
  console.log('3. Check the console output for [DEBUG] and [TURNS_SERVICE] logs');
  console.log('4. Look for "Cleaned prompt content" sections');
}

// Run the demonstration
demonstratePromptCleaning().catch(console.error);
