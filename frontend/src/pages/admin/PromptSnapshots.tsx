/**
 * Prompt Snapshots Admin Page
 * List, view, diff, and override prompt snapshots
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, GitCompare, Edit, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { SnapshotList } from '@/components/admin/SnapshotList';
import { SnapshotView } from '@/components/admin/SnapshotView';
import { SnapshotDiff } from '@/components/admin/SnapshotDiff';
import { SnapshotOverrideDialog } from '@/components/admin/SnapshotOverrideDialog';

export default function PromptSnapshots() {
  const navigate = useNavigate();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'diff'>('list');
  const [diffOtherId, setDiffOtherId] = useState<string | null>(null);
  const [overrideSnapshotId, setOverrideSnapshotId] = useState<string | null>(null);
  const [gameIdFilter, setGameIdFilter] = useState('');
  const [limit, setLimit] = useState(50);

  // Fetch snapshots list
  const { data: snapshots, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'prompt-snapshots', gameIdFilter, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (gameIdFilter) params.set('gameId', gameIdFilter);
      params.set('limit', String(limit));
      const res = await api.get(`/api/admin/prompt-snapshots?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      return res.data as Array<{
        id: string;
        snapshot_id: string;
        created_at: string;
        source: 'auto' | 'manual';
        templates_version?: string;
        game_id?: string;
        turn_id?: string;
      }>;
    },
  });

  const handleView = (snapshotId: string) => {
    setSelectedSnapshotId(snapshotId);
    setViewMode('view');
  };

  const handleDiff = (snapshotId: string) => {
    setSelectedSnapshotId(snapshotId);
    // Find previous snapshot in list
    const currentIndex = snapshots?.findIndex(s => s.snapshot_id === snapshotId) ?? -1;
    if (currentIndex > 0 && snapshots) {
      setDiffOtherId(snapshots[currentIndex - 1].snapshot_id);
    }
    setViewMode('diff');
  };

  const handleOverride = (snapshotId: string) => {
    setOverrideSnapshotId(snapshotId);
  };

  const handleOverrideSuccess = (newSnapshotId: string) => {
    setOverrideSnapshotId(null);
    setSelectedSnapshotId(newSnapshotId);
    setViewMode('view');
    refetch();
  };

  if (viewMode === 'view' && selectedSnapshotId) {
    return (
      <SnapshotView
        snapshotId={selectedSnapshotId}
        onBack={() => setViewMode('list')}
        onDiff={(otherId) => {
          setDiffOtherId(otherId);
          setViewMode('diff');
        }}
      />
    );
  }

  if (viewMode === 'diff' && selectedSnapshotId && diffOtherId) {
    return (
      <SnapshotDiff
        snapshotIdA={selectedSnapshotId}
        snapshotIdB={diffOtherId}
        onBack={() => setViewMode('list')}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Prompt Snapshots</h1>
        <p className="text-muted-foreground">
          View and manage prompt snapshots for debugging
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            <div className="flex gap-4 items-center mt-2">
              <Input
                placeholder="Filter by Game ID"
                value={gameIdFilter}
                onChange={(e) => setGameIdFilter(e.target.value)}
                className="w-64"
              />
              <Input
                type="number"
                placeholder="Limit"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10) || 50)}
                className="w-32"
              />
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <SnapshotList
              snapshots={snapshots || []}
              onView={handleView}
              onDiff={handleDiff}
              onOverride={handleOverride}
            />
          )}
        </CardContent>
      </Card>

      {overrideSnapshotId && (
        <SnapshotOverrideDialog
          snapshotId={overrideSnapshotId}
          onClose={() => setOverrideSnapshotId(null)}
          onSuccess={handleOverrideSuccess}
        />
      )}
    </div>
  );
}

