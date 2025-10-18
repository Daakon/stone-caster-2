#!/usr/bin/env tsx

import { SnapshotsService } from '../src/services/snapshots.service.js';

const args = process.argv.slice(2);
const command = args[0];

const snapshotsService = new SnapshotsService();

async function createSnapshot() {
  const sessionIndex = args.indexOf('--session');
  const labelIndex = args.indexOf('--label');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1]) {
    console.error('Usage: yarn awf:snapshot:create --session <id> [--label "..."]');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  const label = labelIndex !== -1 ? args[labelIndex + 1] : undefined;
  
  try {
    const snapshot = await snapshotsService.createSnapshot({
      session_id: sessionId,
      label
    });
    
    console.log('✅ Snapshot created successfully');
    console.log(`ID: ${snapshot.id}`);
    console.log(`Content Hash: ${snapshot.content_hash}`);
    console.log(`Label: ${snapshot.label || 'No label'}`);
    console.log(`Created: ${snapshot.created_at}`);
  } catch (error) {
    console.error('❌ Failed to create snapshot:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function listSnapshots() {
  const sessionIndex = args.indexOf('--session');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1]) {
    console.error('Usage: yarn awf:snapshot:list --session <id>');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  
  try {
    const snapshots = await snapshotsService.listSnapshots(sessionId);
    
    if (snapshots.length === 0) {
      console.log('No snapshots found for this session');
      return;
    }
    
    console.log(`Found ${snapshots.length} snapshots:`);
    console.log('');
    
    for (const snapshot of snapshots) {
      console.log(`ID: ${snapshot.id}`);
      console.log(`Label: ${snapshot.label || 'No label'}`);
      console.log(`Content Hash: ${snapshot.content_hash}`);
      console.log(`Created: ${snapshot.created_at}`);
      console.log('---');
    }
  } catch (error) {
    console.error('❌ Failed to list snapshots:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function restoreSnapshot() {
  const sessionIndex = args.indexOf('--session');
  const snapshotIndex = args.indexOf('--snapshot');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1] || snapshotIndex === -1 || !args[snapshotIndex + 1]) {
    console.error('Usage: yarn awf:snapshot:restore --session <id> --snapshot <snapshotId>');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  const snapshotId = args[snapshotIndex + 1];
  
  try {
    await snapshotsService.restoreSnapshot({
      session_id: sessionId,
      snapshot_id: snapshotId
    });
    
    console.log('✅ Session restored from snapshot successfully');
  } catch (error) {
    console.error('❌ Failed to restore snapshot:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function deleteSnapshot() {
  const sessionIndex = args.indexOf('--session');
  const snapshotIndex = args.indexOf('--snapshot');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1] || snapshotIndex === -1 || !args[snapshotIndex + 1]) {
    console.error('Usage: yarn awf:snapshot:delete --session <id> --snapshot <snapshotId>');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  const snapshotId = args[snapshotIndex + 1];
  
  try {
    await snapshotsService.deleteSnapshot(sessionId, snapshotId);
    
    console.log('✅ Snapshot deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete snapshot:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'create':
      await createSnapshot();
      break;
    case 'list':
      await listSnapshots();
      break;
    case 'restore':
      await restoreSnapshot();
      break;
    case 'delete':
      await deleteSnapshot();
      break;
    default:
      console.error('Usage: yarn awf:snapshot:<command> [options]');
      console.error('Commands: create, list, restore, delete');
      process.exit(1);
  }
}

main().catch(console.error);


