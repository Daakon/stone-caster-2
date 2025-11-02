/**
 * Preview Pieces Table
 * Pieces grouped by scope with tokens and policy badges
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Piece {
  scope: string;
  slug: string;
  version?: string;
  tokens: number;
}

export interface PreviewPiecesTableProps {
  pieces: Piece[];
  policy?: string[];
  qaReport?: Array<{
    type: string;
    piece: string;
    severity: 'error' | 'warn' | 'info';
    message: string;
    pct?: number;
  }>;
  onPieceClick?: (piece: string) => void;
}

export function PreviewPiecesTable({
  pieces,
  policy = [],
  qaReport = [],
  onPieceClick,
}: PreviewPiecesTableProps) {
  // Group pieces by scope
  const piecesByScope: Record<string, Piece[]> = {};
  for (const piece of pieces) {
    const scope = piece.scope;
    if (!piecesByScope[scope]) {
      piecesByScope[scope] = [];
    }
    piecesByScope[scope].push(piece);
  }

  const scopes = ['core', 'ruleset', 'world', 'scenario', 'entry', 'npc'];

  // Build QA lookup
  const qaByPiece = new Map<string, typeof qaReport>();
  for (const qa of qaReport) {
    if (!qaByPiece.has(qa.piece)) {
      qaByPiece.set(qa.piece, []);
    }
    qaByPiece.get(qa.piece)!.push(qa);
  }

  const getQaBadges = (pieceId: string) => {
    const qaItems = qaByPiece.get(pieceId) || [];
    return qaItems.map((qa, idx) => (
      <Badge
        key={idx}
        variant={
          qa.severity === 'error'
            ? 'destructive'
            : qa.severity === 'warn'
            ? 'default'
            : 'outline'
        }
        className="ml-1"
      >
        {qa.type}
      </Badge>
    ));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pieces</h3>
      <ScrollArea className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scope</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead>QA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scopes.map((scope) => {
              const scopePieces = piecesByScope[scope] || [];
              if (scopePieces.length === 0) return null;

              return (
                <TableRow key={scope} className="bg-muted/50">
                  <TableCell colSpan={5} className="font-semibold">
                    {scope.toUpperCase()} ({scopePieces.length})
                  </TableCell>
                </TableRow>
              ).concat(
                scopePieces.map((piece) => {
                  const pieceId = `${piece.scope}:${piece.slug}@${piece.version || '1.0.0'}`;
                  const hasQA = qaByPiece.has(pieceId);
                  
                  return (
                    <TableRow
                      key={pieceId}
                      className={hasQA ? 'hover:bg-muted cursor-pointer' : ''}
                      onClick={() => onPieceClick?.(pieceId)}
                    >
                      <TableCell className="font-mono text-xs">{piece.scope}</TableCell>
                      <TableCell className="font-mono text-xs">{piece.slug}</TableCell>
                      <TableCell className="font-mono text-xs">{piece.version || '1.0.0'}</TableCell>
                      <TableCell className="text-right">{piece.tokens}</TableCell>
                      <TableCell>{getQaBadges(pieceId)}</TableCell>
                    </TableRow>
                  );
                })
              ) as React.ReactNode[];
            })}
          </TableBody>
        </Table>
      </ScrollArea>
      {policy.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm font-medium">Policy:</span>
          {policy.map((p, idx) => (
            <Badge key={idx} variant="outline">
              {p}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

