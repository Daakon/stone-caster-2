/**
 * Snapshot Diff Utility
 * Generates unified diffs for prompt snapshots
 */

import { getPromptSnapshot } from '../services/prompt-snapshots.service.js';
import { buildLinearizedPrompt } from './linearized-prompt.js';

export interface SnapshotDiff {
  tpDiff: string;
  textDiff: string;
}

/**
 * Generate unified diff between two snapshots
 */
export async function diffSnapshots(
  aId: string,
  bId: string
): Promise<SnapshotDiff> {
  const [snapshotA, snapshotB] = await Promise.all([
    getPromptSnapshot(aId),
    getPromptSnapshot(bId),
  ]);

  if (!snapshotA) {
    throw new Error(`Snapshot ${aId} not found`);
  }
  if (!snapshotB) {
    throw new Error(`Snapshot ${bId} not found`);
  }

  // Generate linearized prompts
  const linearizedA = buildLinearizedPromptSync(snapshotA.tp);
  const linearizedB = buildLinearizedPromptSync(snapshotB.tp);

  // Generate JSON diff (simple string comparison for now)
  const tpDiff = generateJSONDiff(snapshotA.tp, snapshotB.tp);

  // Generate text diff (simple line-by-line for now)
  const textDiff = generateTextDiff(linearizedA, linearizedB);

  return {
    tpDiff,
    textDiff,
  };
}

/**
 * Generate JSON diff (simplified - just show differences)
 */
function generateJSONDiff(a: any, b: any): string {
  const aStr = JSON.stringify(a, null, 2);
  const bStr = JSON.stringify(b, null, 2);

  if (aStr === bStr) {
    return 'No differences in TurnPacketV3 structure';
  }

  // Simple diff: show both versions side by side
  return `--- TurnPacketV3 A\n+++ TurnPacketV3 B\n\n${generateUnifiedDiff(aStr, bStr)}`;
}

/**
 * Generate text diff using unified diff format
 */
function generateTextDiff(a: string, b: string): string {
  if (a === b) {
    return 'No differences in linearized prompt text';
  }

  return generateUnifiedDiff(a, b);
}

/**
 * Simple unified diff generator (line-by-line)
 */
function generateUnifiedDiff(a: string, b: string): string {
  const linesA = a.split('\n');
  const linesB = b.split('\n');

  const maxLen = Math.max(linesA.length, linesB.length);
  const diff: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];

    if (lineA === undefined) {
      diff.push(`+${lineB}`);
    } else if (lineB === undefined) {
      diff.push(`-${lineA}`);
    } else if (lineA !== lineB) {
      diff.push(`-${lineA}`);
      diff.push(`+${lineB}`);
    } else {
      diff.push(` ${lineA}`);
    }
  }

  return diff.join('\n');
}

