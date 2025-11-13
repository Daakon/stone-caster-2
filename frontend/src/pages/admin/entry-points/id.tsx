/**
 * Story Edit Page
 * Phase 3: Edit/create story with tabs for segments and NPC bindings
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { PublishButton } from '@/components/publishing/PublishButton';
import { PreflightPanel } from '@/components/publishing/PreflightPanel';
import { isPublishingWizardEnabled, isAdminMediaEnabled } from '@/lib/feature-flags';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { CoverImagePanel } from '@/components/admin/CoverImagePanel';
import { GalleryManager } from '@/components/admin/GalleryManager';
import { getCoverMedia, getGalleryLinks, type GalleryLinkWithMedia } from '@/services/admin.media';
import type { MediaAssetDTO } from '@shared/types/media';

// Cover Image Section Component
function CoverImageSection({ 
  storyId, 
  storyTitle, 
  isLocked,
  selectedMediaId,
  onMediaSelected,
}: { 
  storyId: string; 
  storyTitle: string; 
  isLocked: boolean;
  selectedMediaId?: string | null;
  onMediaSelected?: (mediaId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  
  const { data: coverMedia, isLoading: loadingCover } = useQuery({
    queryKey: ['admin-media-cover', 'story', storyId],
    queryFn: async () => {
      const result = await getCoverMedia({ kind: 'story', entityId: storyId });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to load cover media');
      }
      return result.data;
    },
    enabled: !!storyId && isAdminMediaEnabled(),
    staleTime: 30 * 1000,
  });

  const handleCoverChange = async (mediaId: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['admin-media-cover', 'story', storyId] });
    queryClient.invalidateQueries({ queryKey: ['admin-entry', storyId] });
    if (onMediaSelected) {
      onMediaSelected(null); // Clear selection after setting cover
    }
  };

  if (loadingCover) {
    return <div className="text-sm text-muted-foreground">Loading cover image...</div>;
  }

  return (
    <CoverImagePanel
      entityKind="story"
      entityId={storyId}
      coverMedia={coverMedia || undefined}
      selectedMediaId={selectedMediaId || null}
      disabled={isLocked}
      onChange={handleCoverChange}
      entityName={storyTitle}
    />
  );
}

// Gallery Section Component
function GallerySection({ storyId, storyTitle, isLocked }: { storyId: string; storyTitle: string; isLocked: boolean }) {
  const queryClient = useQueryClient();
  
  const { data: galleryItems, isLoading: loadingGallery } = useQuery({
    queryKey: ['admin-media-gallery', 'story', storyId],
    queryFn: async () => {
      const result = await getGalleryLinks({ kind: 'story', entityId: storyId });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to load gallery');
      }
      return result.data.items;
    },
    enabled: !!storyId && isAdminMediaEnabled(),
    staleTime: 30 * 1000,
  });

  const handleGalleryChange = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-media-gallery', 'story', storyId] });
  };

  if (loadingGallery) {
    return <div className="text-sm text-muted-foreground">Loading gallery...</div>;
  }

  return (
    <GalleryManager
      entityKind="story"
      entityId={storyId}
      items={galleryItems || []}
      disabled={isLocked}
      onChange={handleGalleryChange}
      entityName={storyTitle}
    />
  );
}

export default function EntryPointEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [entryPoint, setEntryPoint] = useState<EntryPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
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
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/entry-points/wizard/${entryPoint.id}`)}
          >
            Open Entry Wizard
          </Button>
          {isPublishingWizardEnabled() && (
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/publishing-wizard/story/${entryPoint.id}`)}
              disabled={entryPoint.lifecycle === 'published'}
            >
              Publishing Wizard
            </Button>
          )}
          <PublishButton
            type="story"
            id={entryPoint.id}
            worldId={entryPoint.world_id}
            worldName={entryPoint.world_id} // TODO: Get actual world name
          />
          <Button variant="outline" disabled>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      {/* Phase 6: Preflight Panel */}
      {entryPoint.id && <PreflightPanel type="story" id={entryPoint.id} />}

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="segments">Prompt Segments</TabsTrigger>
          <TabsTrigger value="npcs">NPC Bindings</TabsTrigger>
          {isAdminMediaEnabled() && (
            <TabsTrigger value="images">Images</TabsTrigger>
          )}
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

        {/* Phase 3b: Images section (admin-only, feature-flagged) */}
        {isAdminMediaEnabled() && entryPoint && (
          <TabsContent value="images">
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>
                  Upload and manage cover images and gallery for this story.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Section */}
                <MediaUploader
                  kind="story"
                  entityName={entryPoint.title}
                  onUploaded={async (media) => {
                    toast.success('Image uploaded and finalized successfully');
                    // Set the uploaded media as selected so user can set it as cover
                    setSelectedMediaId(media.id);
                    
                    // Automatically add to gallery
                    try {
                      const { createMediaLink } = await import('@/services/admin.media');
                      const result = await createMediaLink({
                        target: { kind: 'story', id: entryPoint.id },
                        mediaId: media.id,
                        role: 'gallery',
                      });
                      
                      if (result.ok) {
                        toast.success('Image added to gallery');
                      } else if (result.error?.message?.includes('already linked')) {
                        // Already in gallery, that's fine
                      } else {
                        console.warn('Failed to auto-add to gallery:', result.error);
                      }
                    } catch (err) {
                      console.error('Error auto-adding to gallery:', err);
                      // Don't show error toast - gallery add is optional
                    }
                    
                    // Invalidate queries to refresh cover and gallery
                    queryClient.invalidateQueries({ queryKey: ['admin-media-cover', 'story', entryPoint.id] });
                    queryClient.invalidateQueries({ queryKey: ['admin-media-gallery', 'story', entryPoint.id] });
                  }}
                />

                {/* Cover Image Panel */}
                <CoverImageSection 
                  storyId={entryPoint.id} 
                  storyTitle={entryPoint.title} 
                  isLocked={!isAdmin && (entryPoint as any).publish_status === 'published'}
                  selectedMediaId={selectedMediaId}
                  onMediaSelected={setSelectedMediaId}
                />

                {/* Gallery Manager */}
                <GallerySection 
                  storyId={entryPoint.id} 
                  storyTitle={entryPoint.title} 
                  isLocked={!isAdmin && (entryPoint as any).publish_status === 'published'} 
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
