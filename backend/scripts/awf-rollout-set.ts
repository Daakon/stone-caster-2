#!/usr/bin/env tsx
/**
 * AWF Rollout Control Script
 * Phase 7: Production Rollout - Set rollout percentage
 */

import { getRolloutManager } from '../src/rollout/canary-rollout.js';
import { getAuditLogger } from '../src/audit/audit-logger.js';

interface RolloutSetOptions {
  percent: number;
  actor: string;
  dryRun?: boolean;
}

async function setRolloutPercent(options: RolloutSetOptions): Promise<void> {
  const { percent, actor, dryRun = false } = options;
  
  if (percent < 0 || percent > 100) {
    throw new Error('Percent must be between 0 and 100');
  }

  const rolloutManager = getRolloutManager();
  const auditLogger = getAuditLogger();
  
  console.log(`[AWF Rollout] Setting rollout to ${percent}% (actor: ${actor})`);
  
  if (dryRun) {
    console.log(`[AWF Rollout] DRY RUN: Would set rollout to ${percent}%`);
    return;
  }

  // Get current status
  const currentStatus = rolloutManager.getStatus();
  const previousPercent = currentStatus.percentRollout;
  
  // Set the new percentage
  rolloutManager.setPercentRollout(percent, actor);
  
  // Log the change
  auditLogger.log(actor, 'rollout_change', 'awf_rollout', {
    previous: previousPercent,
    current: percent,
    changeType: 'percent_rollout'
  });
  
  console.log(`[AWF Rollout] Rollout set to ${percent}% (was ${previousPercent}%)`);
  
  // Show new status
  const newStatus = rolloutManager.getStatus();
  console.log(`[AWF Rollout] Current status:`, {
    globalEnabled: newStatus.globalEnabled,
    percentRollout: newStatus.percentRollout,
    userOverrides: newStatus.userOverrideCount,
    sessionOverrides: newStatus.sessionOverrideCount
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
AWF Rollout Control Script

Usage:
  tsx awf-rollout-set.ts --percent <0-100> --actor <actor> [--dry-run]

Options:
  --percent <number>  Set rollout percentage (0-100)
  --actor <string>    Actor performing the change
  --dry-run          Show what would be changed without making changes
  --help             Show this help message

Examples:
  tsx awf-rollout-set.ts --percent 25 --actor admin
  tsx awf-rollout-set.ts --percent 0 --actor admin --dry-run
    `);
    process.exit(0);
  }

  let percent: number | undefined;
  let actor: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--percent':
        percent = parseInt(args[++i], 10);
        break;
      case '--actor':
        actor = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  if (percent === undefined) {
    console.error('Error: --percent is required');
    process.exit(1);
  }

  if (!actor) {
    console.error('Error: --actor is required');
    process.exit(1);
  }

  try {
    await setRolloutPercent({ percent, actor, dryRun });
    console.log('[AWF Rollout] Operation completed successfully');
  } catch (error) {
    console.error('[AWF Rollout] Error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}


