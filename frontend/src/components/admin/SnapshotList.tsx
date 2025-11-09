/**
 * Snapshot List Component
 * Displays table of prompt snapshots with actions
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, GitCompare, Edit } from 'lucide-react';

interface Snapshot {
  id: string;
  snapshot_id: string;
  created_at: string;
  source: 'auto' | 'manual';
  templates_version?: string;
  game_id?: string;
  turn_id?: string;
}

interface SnapshotListProps {
  snapshots: Snapshot[];
  onView: (snapshotId: string) => void;
  onDiff: (snapshotId: string) => void;
  onOverride: (snapshotId: string) => void;
}

export function SnapshotList({ snapshots, onView, onDiff, onOverride }: SnapshotListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Templates Version</TableHead>
          <TableHead>Game ID</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshots.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No snapshots found
            </TableCell>
          </TableRow>
        ) : (
          snapshots.map((snapshot) => (
            <TableRow key={snapshot.id}>
              <TableCell className="font-mono text-xs">
                {snapshot.snapshot_id.substring(0, 8)}...
              </TableCell>
              <TableCell>
                {new Date(snapshot.created_at).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant={snapshot.source === 'auto' ? 'default' : 'secondary'}>
                  {snapshot.source}
                </Badge>
              </TableCell>
              <TableCell>
                {snapshot.templates_version || 'Latest'}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {snapshot.game_id ? `${snapshot.game_id.substring(0, 8)}...` : '-'}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(snapshot.snapshot_id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDiff(snapshot.snapshot_id)}
                  >
                    <GitCompare className="h-4 w-4 mr-1" />
                    Diff
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOverride(snapshot.snapshot_id)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Override
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

