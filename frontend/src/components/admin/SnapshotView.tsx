/**
 * Snapshot View Component
 * Displays TurnPacket JSON and linearized text with copy functionality
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { CollapsibleSection } from '@/components/admin/CollapsibleSection';

interface SnapshotViewProps {
  snapshotId: string;
  onBack: () => void;
  onDiff: (otherId: string) => void;
}

export function SnapshotView({ snapshotId, onBack, onDiff }: SnapshotViewProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['admin', 'prompt-snapshots', snapshotId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/prompt-snapshots/${snapshotId}`);
      if (!res.ok) throw new Error('Failed to fetch snapshot');
      return res.data as {
        id: string;
        snapshot_id: string;
        tp: any;
        linearized_prompt_text: string;
        templates_version?: string;
        created_at: string;
        source: 'auto' | 'manual';
      };
    },
  });

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!snapshot) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Snapshot not found</AlertDescription>
        </Alert>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Snapshot View</h1>
          <p className="text-muted-foreground">
            {snapshot.snapshot_id} • {new Date(snapshot.created_at).toLocaleString()}
          </p>
        </div>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>

      <Tabs defaultValue="json" className="space-y-4">
        <TabsList>
          <TabsTrigger value="json">TurnPacket JSON</TabsTrigger>
          <TabsTrigger value="text">Linearized Text</TabsTrigger>
        </TabsList>

        <TabsContent value="json" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>TurnPacketV3</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(JSON.stringify(snapshot.tp, null, 2), 'JSON')}
                >
                  {copied === 'JSON' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <CollapsibleSection title="Core" defaultOpen>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(snapshot.tp.core, null, 2)}
                  </pre>
                </CollapsibleSection>
                <CollapsibleSection title="Ruleset">
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(snapshot.tp.ruleset, null, 2)}
                  </pre>
                </CollapsibleSection>
                <CollapsibleSection title="World">
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(snapshot.tp.world, null, 2)}
                  </pre>
                </CollapsibleSection>
                {snapshot.tp.scenario && (
                  <CollapsibleSection title="Scenario">
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {JSON.stringify(snapshot.tp.scenario, null, 2)}
                    </pre>
                  </CollapsibleSection>
                )}
                {snapshot.tp.npcs && snapshot.tp.npcs.length > 0 && (
                  <CollapsibleSection title="NPCs">
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {JSON.stringify(snapshot.tp.npcs, null, 2)}
                    </pre>
                  </CollapsibleSection>
                )}
                <CollapsibleSection title="State">
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(snapshot.tp.state, null, 2)}
                  </pre>
                </CollapsibleSection>
                <CollapsibleSection title="Input">
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(snapshot.tp.input, null, 2)}
                  </pre>
                </CollapsibleSection>
                {snapshot.tp.meta && (
                  <CollapsibleSection title="Meta">
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {JSON.stringify(snapshot.tp.meta, null, 2)}
                    </pre>
                  </CollapsibleSection>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Linearized Prompt Text</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(snapshot.linearized_prompt_text, 'Text')}
                >
                  {copied === 'Text' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded overflow-auto whitespace-pre-wrap">
                {snapshot.linearized_prompt_text}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

