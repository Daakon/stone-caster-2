/**
 * Full comparison view for debug drawer
 * Shows side-by-side diff for prompts, pieces, and policy
 */

import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ComparePromptView } from './ComparePromptView';
import { diffPieces, diffPolicy } from '@/lib/diff';
import type { DebugPayload } from '@/lib/debugStore';

interface CompareViewProps {
  left: DebugPayload;
  right: DebugPayload;
}

export function CompareView({ left, right }: CompareViewProps) {
  // Memoize diff computations
  const piecesDiff = useMemo(
    () => diffPieces(left.assembler.pieces, right.assembler.pieces),
    [left.assembler.pieces, right.assembler.pieces]
  );
  
  const policyDiff = useMemo(
    () => diffPolicy(
      left.assembler.meta.policy || [],
      right.assembler.meta.policy || []
    ),
    [left.assembler.meta.policy, right.assembler.meta.policy]
  );

  const handleExport = (side: 'left' | 'right') => {
    const data = side === 'left' ? left : right;
    const fileName = `debug-${side}-${data.debugId}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const leftTurnNum = left.debugId.split(':')[1];
  const rightTurnNum = right.debugId.split(':')[1];
  
  const leftNpcTrimmed = left.assembler.meta.npcTrimmedCount || 0;
  const rightNpcTrimmed = right.assembler.meta.npcTrimmedCount || 0;

  return (
    <div className="space-y-6">
      {/* Header with npcTrimmedCount and token% */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Compare Turns</h2>
          <div className="text-sm text-muted-foreground">
            {left.assembler.meta.tokenEst && right.assembler.meta.tokenEst && (
              <>
                <span>Token%: {Math.round(left.assembler.meta.tokenEst.pct * 100)}% → {Math.round(right.assembler.meta.tokenEst.pct * 100)}%</span>
                <span className="mx-2">•</span>
              </>
            )}
            <span>Left: {leftNpcTrimmed} NPCs trimmed</span>
            <span className="mx-2">•</span>
            <span>Right: {rightNpcTrimmed} NPCs trimmed</span>
          </div>
        </div>
      </div>
      {/* Prompt comparison */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Prompt Comparison</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('left')}
              aria-label={`Export left turn ${leftTurnNum} as JSON`}
            >
              <Download className="h-4 w-4 mr-1" />
              Left
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('right')}
              aria-label={`Export right turn ${rightTurnNum} as JSON`}
            >
              <Download className="h-4 w-4 mr-1" />
              Right
            </Button>
          </div>
        </div>
        <ComparePromptView
          left={left.assembler.prompt}
          right={right.assembler.prompt}
          leftLabel={`Turn ${leftTurnNum}`}
          rightLabel={`Turn ${rightTurnNum}`}
        />
      </section>

      {/* Pieces comparison */}
      <section>
        <h3 className="font-medium mb-2">Pieces Comparison</h3>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Left Turn {leftTurnNum}</TableHead>
                <TableHead>Right Turn {rightTurnNum}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {piecesDiff.map((diff) => (
                <TableRow key={diff.key}>
                  <TableCell className="font-mono text-xs">{diff.key}</TableCell>
                  <TableCell>
                    {diff.left ? (
                      <div className="text-sm">
                        <div>Tokens: {diff.left.tokens || 0}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {diff.right ? (
                      <div className="text-sm">
                        <div>Tokens: {diff.right.tokens || 0}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {diff.status === 'added' && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Added
                      </Badge>
                    )}
                    {diff.status === 'removed' && (
                      <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Removed
                      </Badge>
                    )}
                    {diff.status === 'modified' && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                        Modified
                      </Badge>
                    )}
                    {diff.status === 'equal' && (
                      <Badge variant="outline" className="bg-muted">
                        Equal
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Policy comparison */}
      <section>
        <h3 className="font-medium mb-2">Policy Comparison</h3>
        <div className="space-y-4">
          {policyDiff.common.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">Common</div>
              <div className="flex flex-wrap gap-1">
                {policyDiff.common.map((policy) => (
                  <Badge key={policy} variant="outline">
                    {policy}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {policyDiff.removed.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1 text-red-600 dark:text-red-400">
                Removed in Turn {rightTurnNum}
              </div>
              <div className="flex flex-wrap gap-1">
                {policyDiff.removed.map((policy) => (
                  <Badge key={policy} variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {policy}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {policyDiff.added.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1 text-green-600 dark:text-green-400">
                Added in Turn {rightTurnNum}
              </div>
              <div className="flex flex-wrap gap-1">
                {policyDiff.added.map((policy) => (
                  <Badge key={policy} variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    {policy}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

