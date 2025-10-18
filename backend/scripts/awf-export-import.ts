#!/usr/bin/env tsx

import { ExportImportService } from '../src/services/export-import.service.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const command = args[0];

const exportImportService = new ExportImportService();

async function exportSession() {
  const sessionIndex = args.indexOf('--session');
  const outputIndex = args.indexOf('--output');
  
  if (sessionIndex === -1 || !args[sessionIndex + 1]) {
    console.error('Usage: yarn awf:export --session <id> [--output <file>]');
    process.exit(1);
  }
  
  const sessionId = args[sessionIndex + 1];
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : `session-${sessionId}-export.json`;
  
  try {
    const exportData = await exportImportService.exportSession({
      session_id: sessionId
    });
    
    const outputPath = join(process.cwd(), outputFile);
    writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    
    console.log('✅ Session exported successfully');
    console.log(`Output file: ${outputPath}`);
    console.log(`Session ID: ${exportData.session.session_id}`);
    console.log(`Player ID: ${exportData.session.player_id}`);
    console.log(`Turn ID: ${exportData.session.turn_id}`);
    console.log(`Exported at: ${exportData.metadata.exported_at}`);
  } catch (error) {
    console.error('❌ Failed to export session:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function importSession() {
  const fileIndex = args.indexOf('--file');
  const preserveTurnIdIndex = args.indexOf('--preserveTurnId');
  
  if (fileIndex === -1 || !args[fileIndex + 1]) {
    console.error('Usage: yarn awf:import --file <export.json> [--preserveTurnId]');
    process.exit(1);
  }
  
  const filePath = args[fileIndex + 1];
  const preserveTurnId = preserveTurnIdIndex !== -1;
  
  try {
    const exportData = JSON.parse(readFileSync(filePath, 'utf-8'));
    
    const newSessionId = await exportImportService.importSession({
      exportData,
      preserveTurnId
    });
    
    console.log('✅ Session imported successfully');
    console.log(`New session ID: ${newSessionId}`);
    console.log(`Original session ID: ${exportData.session.session_id}`);
    console.log(`Turn ID preserved: ${preserveTurnId ? 'Yes' : 'No'}`);
    console.log(`Imported at: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('❌ Failed to import session:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'export':
      await exportSession();
      break;
    case 'import':
      await importSession();
      break;
    default:
      console.error('Usage: yarn awf:export-import:<command> [options]');
      console.error('Commands: export, import');
      process.exit(1);
  }
}

main().catch(console.error);


