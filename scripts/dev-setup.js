#!/usr/bin/env node
/**
 * Development Setup Script for Stone Caster
 * 
 * This script ensures all developers have a consistent development environment
 * by setting up default environment variables and providing clear instructions.
 * 
 * Usage: npm run dev:setup
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function checkFileExists(filePath) {
  return fs.existsSync(path.resolve(process.cwd(), filePath));
}

function createEnvExample() {
  const envExamplePath = path.resolve(process.cwd(), '.env.example');
  const envExampleContent = `# Stone Caster Development Environment
# Copy this file to .env and update with your actual values

# Supabase Configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
PRIMARY_AI_MODEL=gpt-4

# Session Configuration
SESSION_SECRET=your-session-secret-here

# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Optional: Anthropic API Key
ANTHROPIC_API_KEY=your-anthropic-api-key-here
`;

  if (!checkFileExists('.env.example')) {
    fs.writeFileSync(envExamplePath, envExampleContent);
    logSuccess('Created .env.example file');
  } else {
    log('📄 .env.example already exists', 'blue');
  }
}

function checkDependencies() {
  logStep(1, 'Checking dependencies');
  
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  if (!checkFileExists('package.json')) {
    logError('package.json not found. Are you in the project root?');
    process.exit(1);
  }
  
  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  if (!checkFileExists('node_modules')) {
    logWarning('node_modules not found. Run "npm install" first.');
    return false;
  }
  
  logSuccess('Dependencies check passed');
  return true;
}

function setupEnvironment() {
  logStep(2, 'Setting up environment');
  
  // Create .env.example if it doesn't exist
  createEnvExample();
  
  // Check if .env exists
  if (checkFileExists('.env')) {
    logSuccess('.env file found');
  } else {
    logWarning('.env file not found. Using default development values.');
    log('📝 For production, copy .env.example to .env and update with real values', 'blue');
  }
}

function showUsageInstructions() {
  logStep(3, 'Development Commands');
  
  log('\n🚀 Available commands:', 'bright');
  log('  npm run dev              - Start both frontend and backend in development mode', 'green');
  log('  npm run dev:client       - Start only the frontend (React + Vite)', 'green');
  log('  npm run dev:server       - Start only the backend (Node + Express)', 'green');
  log('  npm run dev:server:local - Start backend with default environment variables', 'green');
  log('  npm run build            - Build both frontend and backend', 'green');
  log('  npm run test             - Run all tests', 'green');
  log('  npm run test:ci          - Run tests in CI mode (headless, single-run)', 'green');
  log('  npm run lint             - Lint all code', 'green');
  log('  npm run type-check       - Type check all TypeScript', 'green');
  log('  npm run setup            - Setup database configuration', 'green');
  
  log('\n📋 Development Workflow:', 'bright');
  log('  1. npm install           - Install dependencies', 'blue');
  log('  2. npm run setup         - Setup database configuration', 'blue');
  log('  3. npm run dev           - Start development servers', 'blue');
  log('  4. Open http://localhost:5173 - Frontend', 'blue');
  log('  5. API available at http://localhost:3000 - Backend', 'blue');
  
  log('\n🔧 Environment Setup:', 'bright');
  log('  • Default development values are provided automatically', 'blue');
  log('  • For production, create .env file with real values', 'blue');
  log('  • Backend runs on port 3000 with default environment', 'blue');
  log('  • Frontend runs on port 5173 (Vite default)', 'blue');
}

function main() {
  log('🎮 Stone Caster Development Setup', 'bright');
  log('=====================================', 'bright');
  
  try {
    const depsOk = checkDependencies();
    setupEnvironment();
    showUsageInstructions();
    
    log('\n🎉 Setup complete!', 'green');
    log('Run "npm run dev" to start development servers.', 'bright');
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

main();
