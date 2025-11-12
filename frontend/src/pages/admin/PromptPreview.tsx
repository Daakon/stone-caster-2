/**
 * Prompt Preview Admin Page
 * Preview TurnPacketV3 and linearized prompt
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAppRoles } from '@/admin/routeGuard';
import { PromptPreviewForm } from '@/components/admin/PromptPreviewForm';
import { PromptPreviewResult } from '@/components/admin/PromptPreviewResult';

export default function PromptPreview() {
  const { isAdmin } = useAppRoles(); // Use isAdmin as proxy for publisher for now
  const isPublisher = isAdmin; // TODO: Add isPublisher to useAppRoles
  const [previewData, setPreviewData] = useState<any>(null);
  const [createSnapshotEnabled] = useState(
    process.env.NEXT_PUBLIC_ENABLE_MANUAL_SNAPSHOTS === 'true' || false
  );

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (params: {
      worldId?: string;
      rulesetId?: string;
      scenarioId?: string;
      npcIds?: string[];
      templatesVersion?: number;
    }) => {
      const res = await api.post('/api/admin/prompt-preview', params);
      if (!res.ok) throw new Error(res.error || 'Failed to generate preview');
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      toast.success('Preview generated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate preview');
    },
  });

  // Create snapshot mutation
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error('No preview data');
      const res = await api.post('/api/admin/prompt-snapshots/create', {
        tp: previewData.tp,
        linearized_prompt_text: previewData.linearized,
        templates_version: previewData.templates_version,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to create snapshot');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Snapshot created: ${data.data.snapshot_id.substring(0, 8)}...`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create snapshot');
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Prompt Preview</h1>
        <p className="text-muted-foreground">
          Preview TurnPacketV3 and linearized prompt without invoking the model
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <PromptPreviewForm
            onSubmit={(params) => previewMutation.mutate(params)}
            isLoading={previewMutation.isPending}
          />
        </CardContent>
      </Card>

      {previewData && (
        <>
          <PromptPreviewResult
            data={previewData}
            warnings={previewData.warnings || []}
            errors={previewData.errors || []}
          />

          {createSnapshotEnabled && isPublisher && (
            <Card>
              <CardHeader>
                <CardTitle>Create Snapshot</CardTitle>
                <CardDescription>
                  Save this preview as a manual snapshot
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => createSnapshotMutation.mutate()}
                  disabled={createSnapshotMutation.isPending}
                >
                  {createSnapshotMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Snapshot
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

