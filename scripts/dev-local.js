#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

const DEFAULT_API_PORT = Number(process.env.PORT || 3000);
const DEFAULT_WEB_PORT = Number(process.env.VITE_PORT || 5173);

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`No open port found between ${startPort} and ${startPort + 99}`);
}

function run(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (error) => {
    console.error(`[dev-local] ${name} failed to start:`, error);
    stopAll(1);
  });

  child.on('exit', (code, signal) => {
    if (stopping) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev-local] ${name} exited with ${reason}`);
    stopAll(code ?? 1);
  });

  children.add(child);
  return child;
}

const children = new Set();
let stopping = false;

function stopAll(exitCode = 0) {
  if (stopping) {
    return;
  }

  stopping = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

try {
  const apiPort = await findOpenPort(DEFAULT_API_PORT);
  const webPort = await findOpenPort(DEFAULT_WEB_PORT);
  const apiBase = `http://localhost:${apiPort}`;
  const webBase = `http://localhost:${webPort}`;
  const env = {
    ...process.env,
    PORT: String(apiPort),
    VITE_PORT: String(webPort),
    VITE_API_BASE: apiBase,
    API_BASE_URL: apiBase,
    WEB_BASE_URL: webBase,
    FRONTEND_URL: webBase,
    CORS_ORIGIN: webBase,
  };

  console.info(`[dev-local] API: ${apiBase}`);
  console.info(`[dev-local] Web: ${webBase}`);

  run('backend', npmCommand, ['run', 'dev:server:local'], env);
  run('frontend', npmCommand, ['run', 'dev:client', '--', '--host', 'localhost', '--port', String(webPort)], env);

  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
} catch (error) {
  console.error('[dev-local] Failed to start local dev environment:', error);
  process.exit(1);
}
