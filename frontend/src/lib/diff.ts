/**
 * Lightweight diff utility for comparing prompts, pieces, and policy
 * Used in debug drawer compare mode
 */

export interface DiffLine {
  type: 'equal' | 'add' | 'remove';
  content: string;
  lineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  equalCount: number;
}

/**
 * Normalize line endings and trim trailing whitespace
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // Windows CRLF -> LF
    .replace(/\r/g, '\n')    // Mac CR -> LF
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

/**
 * Compute a simple character-based diff between two strings
 * Uses line-by-line comparison for better readability
 * Normalizes line endings and trims trailing whitespace before diffing
 */
export function diffStrings(left: string, right: string, showWhitespace = false): DiffResult {
  const normalizedLeft = showWhitespace ? left : normalizeText(left);
  const normalizedRight = showWhitespace ? right : normalizeText(right);
  
  const leftLines = normalizedLeft.split('\n');
  const rightLines = normalizedRight.split('\n');
  
  const maxLen = Math.max(leftLines.length, rightLines.length);
  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let equalCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const leftLine = leftLines[i];
    const rightLine = rightLines[i];

    if (leftLine === undefined && rightLine !== undefined) {
      // Added in right
      lines.push({ type: 'add', content: rightLine, lineNumber: i + 1 });
      addedCount++;
    } else if (rightLine === undefined && leftLine !== undefined) {
      // Removed from left
      lines.push({ type: 'remove', content: leftLine, lineNumber: i + 1 });
      removedCount++;
    } else if (leftLine === rightLine) {
      // Equal
      lines.push({ type: 'equal', content: leftLine, lineNumber: i + 1 });
      equalCount++;
    } else {
      // Modified: show both
      lines.push({ type: 'remove', content: leftLine, lineNumber: i + 1 });
      lines.push({ type: 'add', content: rightLine, lineNumber: i + 1 });
      removedCount++;
      addedCount++;
    }
  }

  return { lines, addedCount, removedCount, equalCount };
}

/**
 * Diff two arrays of pieces (by scope:slug@version key)
 */
export interface PieceDiff {
  key: string; // scope:slug@version
  left?: { scope: string; slug: string; version?: string; tokens?: number };
  right?: { scope: string; slug: string; version?: string; tokens?: number };
  status: 'equal' | 'added' | 'removed' | 'modified';
}

export function diffPieces(
  left: Array<{ scope: string; slug: string; version?: string; tokens?: number }>,
  right: Array<{ scope: string; slug: string; version?: string; tokens?: number }>
): PieceDiff[] {
  const key = (p: { scope: string; slug: string; version?: string }) => 
    `${p.scope}:${p.slug}@${p.version || '1.0.0'}`;

  const leftMap = new Map(left.map(p => [key(p), p]));
  const rightMap = new Map(right.map(p => [key(p), p]));

  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const diffs: PieceDiff[] = [];

  for (const keyStr of Array.from(allKeys).sort()) {
    const leftPiece = leftMap.get(keyStr);
    const rightPiece = rightMap.get(keyStr);

    if (!leftPiece && rightPiece) {
      diffs.push({ key: keyStr, right: rightPiece, status: 'added' });
    } else if (leftPiece && !rightPiece) {
      diffs.push({ key: keyStr, left: leftPiece, status: 'removed' });
    } else if (leftPiece && rightPiece) {
      // Compare tokens to detect modifications
      if (leftPiece.tokens !== rightPiece.tokens) {
        diffs.push({ key: keyStr, left: leftPiece, right: rightPiece, status: 'modified' });
      } else {
        diffs.push({ key: keyStr, left: leftPiece, right: rightPiece, status: 'equal' });
      }
    }
  }

  return diffs;
}

/**
 * Diff two policy arrays (simple string comparison)
 */
export interface PolicyDiff {
  added: string[];
  removed: string[];
  common: string[];
}

export function diffPolicy(left: string[], right: string[]): PolicyDiff {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  return {
    added: right.filter(p => !leftSet.has(p)),
    removed: left.filter(p => !rightSet.has(p)),
    common: left.filter(p => rightSet.has(p)),
  };
}

