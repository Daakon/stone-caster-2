#!/usr/bin/env tsx
/**
 * AWF Override Control Script
 * Phase 7: Production Rollout - Set user/session overrides
 */

import { getRolloutManager } from '../src/rollout/canary-rollout.js';
import { getAuditLogger } from '../src/audit/audit-logger.js';

interface OverrideOptions {
  type: 'user' | 'session';
  id: string;
  enabled: boolean;
  actor: string;
  dryRun?: boolean;
}

async function setOverride(options: OverrideOptions): Promise<void> {
  const { type, id, enabled, actor, dryRun = false } = options;
  
  const rolloutManager = getRolloutManager();
  const auditLogger = getAuditLogger();
  
  console.log(`[AWF Override] Setting ${type} override for ${id} to ${enabled} (actor: ${actor})`);
  
  if (dryRun) {
    console.log(`[AWF Override] DRY RUN: Would set ${type} override for ${id} to ${enabled}`);
    return;
  }

  // Set the override
  if (type === 'user') {
    rolloutManager.setUserOverride(id, enabled, actor);
  } else {
    rolloutManager.setSessionOverride(id, enabled, actor);
  }
  
  // Log the change
  auditLogger.log(actor, 'override_change', `${type}_override`, {
    id,
    enabled,
    changeType: `${type}_override`
  });
  
  console.log(`[AWF Override] ${type} override set for ${id} to ${enabled}`);
}

async function clearOverride(options: { type: 'user' | 'session'; id: string; actor: string; dryRun?: boolean }): Promise<void> {
  const { type, id, actor, dryRun = false } = options;
  
  const rolloutManager = getRolloutManager();
  const auditLogger = getAuditLogger();
  
  console.log(`[AWF Override] Clearing ${type} override for ${id} (actor: ${actor})`);
  
  if (dryRun) {
    console.log(`[AWF Override] DRY RUN: Would clear ${type} override for ${id}`);
    return;
  }

  // Clear the override
  if (type === 'user') {
    rolloutManager.clearUserOverride(id, actor);
  } else {
    rolloutManager.clearSessionOverride(id, actor);
  }
  
  // Log the change
  auditLogger.log(actor, 'override_clear', `${type}_override`, {
    id,
    changeType: `${type}_override_clear`
  });
  
  console.log(`[AWF Override] ${type} override cleared for ${id}`);
}

async function listOverrides(): Promise<void> {
  const rolloutManager = getRolloutManager();
  const status = rolloutManager.getStatus();
  
  console.log(`[AWF Override] Current override status:`, {
    userOverrides: status.userOverrideCount,
    sessionOverrides: status.sessionOverrideCount,
    globalEnabled: status.globalEnabled,
    percentRollout: status.percentRollout
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
AWF Override Control Script

Usage:
  tsx awf-override.ts --session <id> --enable/--disable --actor <actor> [--dry-run]
  tsx awf-override.ts --user <id> --enable/--disable --actor <actor> [--dry-run]
  tsx awf-override.ts --clear-session <id> --actor <actor> [--dry-run]
  tsx awf-override.ts --clear-user <id> --actor <actor> [--dry-run]
  tsx awf-override.ts --list

Options:
  --session <id>     Set session override
  --user <id>        Set user override
  --enable           Enable override
  --disable          Disable override
  --clear-session <id> Clear session override
  --clear-user <id>    Clear user override
  --actor <string>   Actor performing the change
  --dry-run          Show what would be changed without making changes
  --list             List current overrides
  --help             Show this help message

Examples:
  tsx awf-override.ts --session session-123 --enable --actor admin
  tsx awf-override.ts --user user-456 --disable --actor admin
  tsx awf-override.ts --clear-session session-123 --actor admin
  tsx awf-override.ts --list
    `);
    process.exit(0);
  }

  let type: 'user' | 'session' | undefined;
  let id: string | undefined;
  let enabled: boolean | undefined;
  let actor: string | undefined;
  let dryRun = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--session':
        type = 'session';
        id = args[++i];
        break;
      case '--user':
        type = 'user';
        id = args[++i];
        break;
      case '--enable':
        enabled = true;
        break;
      case '--disable':
        enabled = false;
        break;
      case '--clear-session':
        type = 'session';
        id = args[++i];
        enabled = undefined; // Special value for clear
        break;
      case '--clear-user':
        type = 'user';
        id = args[++i];
        enabled = undefined; // Special value for clear
        break;
      case '--actor':
        actor = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--list':
        list = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  if (list) {
    await listOverrides();
    return;
  }

  if (!type || !id) {
    console.error('Error: --session or --user with ID is required');
    process.exit(1);
  }

  if (enabled === null) {
    // Clear override
    if (!actor) {
      console.error('Error: --actor is required for clear operations');
      process.exit(1);
    }
    
    try {
      await clearOverride({ type, id, actor, dryRun });
      console.log('[AWF Override] Clear operation completed successfully');
    } catch (error) {
      console.error('[AWF Override] Error:', error);
      process.exit(1);
    }
  } else {
    // Set override
    if (enabled === undefined) {
      console.error('Error: --enable or --disable is required');
      process.exit(1);
    }

    if (!actor) {
      console.error('Error: --actor is required');
      process.exit(1);
    }

    try {
      await setOverride({ type, id, enabled, actor, dryRun });
      console.log('[AWF Override] Operation completed successfully');
    } catch (error) {
      console.error('[AWF Override] Error:', error);
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
