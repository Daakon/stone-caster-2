/**
 * Story Edit Page
 * Phase 3: Edit/create story with tabs for segments and NPC bindings
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Send, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { entryPointsService, type EntryPoint, type CreateEntryPointData, type UpdateEntryPointData } from '@/services/admin.entryPoints';
import { EntryPointForm } from '@/admin/components/EntryPointForm';
import { EntryPointSegmentsTab } from '@/admin/components/EntryPointSegmentsTab';
import { EntryPointNpcsTab } from '@/admin/components/EntryPointNpcsTab';
import { SubmitForReviewButton } from '@/admin/components/SubmitForReviewButton';
import { useAppRoles } from '@/admin/routeGuard';

export default function EntryPointEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [entryPoint, setEntryPoint] = useState<EntryPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isNew = id === 'new';

  useEffect(() => {
    if (!isNew && id) {
      loadEntryPoint();
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const loadEntryPoint = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await entryPointsService.getEntryPoint(id);
      setEntryPoint(data);
    } catch (error) {
      toast.error('Failed to load story');
      navigate('/admin/entry-points');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: CreateEntryPointData | UpdateEntryPointData) => {
    try {
      setSaving(true);

      if (isNew) {
        const newEntryPoint = await entryPointsService.createEntryPoint(data as CreateEntryPointData);
        toast.success('Entry point created successfully');
        navigate(`/admin/entry-points/${newEntryPoint.id}`);
      } else if (entryPoint) {
        const updatedEntryPoint = await entryPointsService.updateEntryPoint(entryPoint.id, data as UpdateEntryPointData);
        setEntryPoint(updatedEntryPoint);
        toast.success('Entry point updated successfully');
      }
    } catch (error) {
      toast.error('Failed to save story');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/entry-points');
  };

  const handleSubmitForReview = async () => {
    if (!entryPoint) return;

    try {
      await entryPointsService.submitForReview(entryPoint.id);
      toast.success('Entry point submitted for review');
      loadEntryPoint(); // Reload to get updated lifecycle
    } catch (error) {
      toast.error('Failed to submit for review');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-lg font-medium">Loading entry point...</div>
          <div className="text-sm text-muted-foreground">Please wait</div>
        </div>
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Entry Points
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Entry Point</h1>
            <p className="text-muted-foreground">
              Create a new adventure entry point
            </p>
          </div>
        </div>

        <EntryPointForm
          onSave={handleSave}
          onCancel={handleCancel}
          loading={saving}
        />
      </div>
    );
  }

  if (!entryPoint) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-lg font-medium">Entry point not found</div>
          <div className="text-sm text-muted-foreground">The entry point you're looking for doesn't exist</div>
          <Button onClick={handleCancel} className="mt-4">
            Back to Entry Points
          </Button>
        </div>
      </div>
    );
  }

  const canSubmitForReview = isCreator && 
    (entryPoint.lifecycle === 'draft' || entryPoint.lifecycle === 'changes_requested');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Entry Points
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{entryPoint.title}</h1>
            <p className="text-muted-foreground">
              {entryPoint.type} • {entryPoint.visibility} • {entryPoint.lifecycle.replace('_', ' ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canSubmitForReview && (
            <SubmitForReviewButton
              entryPointId={entryPoint.id}
              entryPointTitle={entryPoint.title}
              onSubmitted={loadEntryPoint}
            />
          )}
          
          <Button variant="outline" disabled>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="segments">Prompt Segments</TabsTrigger>
          <TabsTrigger value="npcs">NPC Bindings</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <EntryPointForm
            entryPoint={entryPoint}
            onSave={handleSave}
            onCancel={handleCancel}
            loading={saving}
          />
        </TabsContent>

        <TabsContent value="segments">
          <EntryPointSegmentsTab entryPointId={entryPoint.id} />
        </TabsContent>

        <TabsContent value="npcs">
          <EntryPointNpcsTab entryPointId={entryPoint.id} worldId={entryPoint.world_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
