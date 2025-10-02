#!/usr/bin/env node
// Loads .env if present, ensures required env vars have safe local defaults,
// then spawns `npx tsx watch src/index.ts` so the backend starts in watch mode.
// This is intended for local development only and does NOT store any secrets.
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startDevServer() {
  // Load dotenv if available and a .env file exists
  try {
    const dotenv = await import('dotenv');
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.info('[dev-with-default-env] Loaded .env file');
    }
  } catch (err) {
    // ignore if dotenv isn't installed in this context
  }

  // Provide safe, non-secret defaults for local development when missing
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-local';
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'service-local';
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'openai-local';
  process.env.PRIMARY_AI_MODEL = process.env.PRIMARY_AI_MODEL || 'gpt-4';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
  process.env.PORT = process.env.PORT || '3000';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_local_dev_key';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_local_dev_secret';

  console.info('[dev-with-default-env] Starting backend with local defaults (development only)');

  const isWin = process.platform === 'win32';
  const workingDir = path.resolve(__dirname, '..');
  
  console.info(`[dev-with-default-env] Working directory: ${workingDir}`);

  // Use a more reliable approach for Windows
  let child;
  if (isWin) {
    // On Windows, use cmd /c to run npx
    const command = 'npx tsx watch src/index.ts';
    console.info(`[dev-with-default-env] Running: cmd /c "${command}"`);
    child = spawn('cmd', ['/c', command], { 
      stdio: 'inherit', 
      env: process.env, 
      cwd: workingDir,
      shell: true
    });
  } else {
    // On Unix-like systems, use npx directly
    const args = ['tsx', 'watch', 'src/index.ts'];
    console.info(`[dev-with-default-env] Running: npx ${args.join(' ')}`);
    child = spawn('npx', args, { 
      stdio: 'inherit', 
      env: process.env, 
      cwd: workingDir
    });
  }

  child.on('exit', code => process.exit(code));
  child.on('error', err => {
    console.error('[dev-with-default-env] Failed to start backend process', err);
    process.exit(1);
  });
}

// Start the dev server
startDevServer().catch(err => {
  console.error('[dev-with-default-env] Failed to start dev server:', err);
  process.exit(1);
});
