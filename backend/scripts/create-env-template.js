#!/usr/bin/env node

/**
 * Creates a .env.example template file for the backend
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envTemplate = `# Stone Caster Backend Environment Configuration
# Copy this file to .env and fill in your actual values

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# AI Configuration
OPENAI_API_KEY=your-openai-api-key-here
PRIMARY_AI_MODEL=gpt-4
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Server Configuration
SESSION_SECRET=your-session-secret-here
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Development Notes:
# - For local development, you can use the dev:server:local script which provides safe defaults
# - Never commit the actual .env file to version control
# - The SESSION_SECRET should be a long, random string for production
`;

const templatePath = join(__dirname, '..', '.env.example');

try {
  writeFileSync(templatePath, envTemplate);
  console.log('✅ Created .env.example template file');
  console.log('📝 Next steps:');
  console.log('   1. Copy .env.example to .env: cp .env.example .env');
  console.log('   2. Edit .env with your actual values');
  console.log('   3. Run: npm run setup:config');
  console.log('   4. Start development: npm run dev:server:local');
} catch (error) {
  console.error('❌ Failed to create .env.example:', error.message);
  process.exit(1);
}




