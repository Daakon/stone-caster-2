#!/usr/bin/env tsx

import { WALService } from '../src/services/wal.service.js';

const args = process.argv.slice(2);
const command = args[0];

const walService = new WALService();

async function reconcile() {
  const sessionIndex = args.indexOf('--session');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1]) {
    console.error('Usage: yarn awf:wal:reconcile --session <id>');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  
  try {
    const result = await walService.reconcile({
      session_id: sessionId
    });
    
    console.log('✅ WAL reconciliation completed');
    console.log(`Applied entries: ${result.applied}`);
    console.log(`Discarded entries: ${result.discarded}`);
  } catch (error) {
    console.error('❌ Failed to reconcile WAL:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function listEntries() {
  const sessionIndex = args.indexOf('--session');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1]) {
    console.error('Usage: yarn awf:wal:list --session <id>');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  
  try {
    const entries = await walService.getUnappliedEntries(sessionId);
    
    if (entries.length === 0) {
      console.log('No unapplied WAL entries found for this session');
      return;
    }
    
    console.log(`Found ${entries.length} unapplied WAL entries:`);
    console.log('');
    
    for (const entry of entries) {
      console.log(`ID: ${entry.id}`);
      console.log(`Turn ID: ${entry.turn_id}`);
      console.log(`Applied: ${entry.applied}`);
      console.log(`Created: ${entry.created_at}`);
      console.log('---');
    }
  } catch (error) {
    console.error('❌ Failed to list WAL entries:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function cleanup() {
  const daysIndex = args.indexOf('--days');
  
  const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1]) : 7;
  
  try {
    const deletedCount = await walService.cleanupOldEntries(days);
    
    console.log('✅ WAL cleanup completed');
    console.log(`Deleted ${deletedCount} old entries (older than ${days} days)`);
  } catch (error) {
    console.error('❌ Failed to cleanup WAL:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'reconcile':
      await reconcile();
      break;
    case 'list':
      await listEntries();
      break;
    case 'cleanup':
      await cleanup();
      break;
    default:
      console.error('Usage: yarn awf:wal:<command> [options]');
      console.error('Commands: reconcile, list, cleanup');
      process.exit(1);
  }
}

main().catch(console.error);


