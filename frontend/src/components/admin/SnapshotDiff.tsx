/**
 * Snapshot Diff Component
 * Displays unified diff between two snapshots
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

interface SnapshotDiffProps {
  snapshotIdA: string;
  snapshotIdB: string;
  onBack: () => void;
}

export function SnapshotDiff({ snapshotIdA, snapshotIdB, onBack }: SnapshotDiffProps) {
  const { data: diff, isLoading } = useQuery({
    queryKey: ['admin', 'prompt-snapshots', 'diff', snapshotIdA, snapshotIdB],
    queryFn: async () => {
      const res = await api.get(`/api/admin/prompt-snapshots/${snapshotIdA}/diff/${snapshotIdB}`);
      if (!res.ok) throw new Error('Failed to fetch diff');
      return res.data as {
        tpDiff: string;
        textDiff: string;
      };
    },
  });

  const renderDiff = (diffText: string) => {
    const lines = diffText.split('\n');
    return (
      <div className="font-mono text-xs">
        {lines.map((line, i) => {
          if (line.startsWith('+')) {
            return (
              <div key={i} className="bg-green-500/20 text-green-700 dark:text-green-400">
                {line}
              </div>
            );
          } else if (line.startsWith('-')) {
            return (
              <div key={i} className="bg-red-500/20 text-red-700 dark:text-red-400">
                {line}
              </div>
            );
          } else {
            return (
              <div key={i} className="text-muted-foreground">
                {line}
              </div>
            );
          }
        })}
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading diff...</div>;
  }

  if (!diff) {
    return (
      <div className="p-6">
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="mt-4">Diff not available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Snapshot Diff</h1>
          <p className="text-muted-foreground">
            Comparing {snapshotIdA.substring(0, 8)}... vs {snapshotIdB.substring(0, 8)}...
          </p>
        </div>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Tabs defaultValue="text" className="space-y-4">
        <TabsList>
          <TabsTrigger value="text">Linearized Text Diff</TabsTrigger>
          <TabsTrigger value="json">TurnPacket JSON Diff</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card>
            <CardHeader>
              <CardTitle>Text Diff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded overflow-auto max-h-[600px]">
                {renderDiff(diff.textDiff)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>JSON Diff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded overflow-auto max-h-[600px]">
                {renderDiff(diff.tpDiff)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

