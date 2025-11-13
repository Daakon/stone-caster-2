import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { npcsService, type UpdateNPCData, type NPC } from '@/services/admin.npcs';
import { worldsService, type World } from '@/services/admin.worlds';
import { ExtrasForm } from '@/components/admin/ExtrasForm';
import { PromptAuthoringSection, type PromptAuthoringContext } from '@/components/admin/prompt-authoring/PromptAuthoringSection';
import { ContextChips } from '@/components/admin/prompt-authoring/ContextChips';
import { isAdminPromptFormsEnabled, isLegacyPromptTextareaRetired } from '@/lib/feature-flags';
import { trackAdminEvent } from '@/lib/admin-telemetry';
import { PublishButton } from '@/components/publishing/PublishButton';
import { PreflightPanel } from '@/components/publishing/PreflightPanel';
import { isPublishingWizardEnabled, isAdminMediaEnabled } from '@/lib/feature-flags';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { CoverImagePanel } from '@/components/admin/CoverImagePanel';
import { GalleryManager } from '@/components/admin/GalleryManager';
import { getCoverMedia, getGalleryLinks, type GalleryLinkWithMedia } from '@/services/admin.media';
import type { MediaAssetDTO } from '@shared/types/media';
import { useAppRoles } from '@/admin/routeGuard';

// Extended NPC type to include fields that may be returned from API
interface ExtendedNPC extends NPC {
  world_id?: string;
  visibility?: 'private' | 'public';
  author_name?: string;
  author_type?: 'user' | 'original' | 'system';
}

// Extended update data to include all fields
interface ExtendedUpdateNPCData extends UpdateNPCData {
  world_id?: string;
  visibility?: 'private' | 'public';
  author_name?: string;
  author_type?: 'user' | 'original' | 'system';
}

// Cover Image Section Component
function CoverImageSection({ 
  npcId, 
  npcName, 
  isLocked,
  selectedMediaId,
  onMediaSelected,
}: { 
  npcId: string; 
  npcName: string; 
  isLocked: boolean;
  selectedMediaId?: string | null;
  onMediaSelected?: (mediaId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  
  const { data: coverMedia, isLoading: loadingCover } = useQuery({
    queryKey: ['admin-media-cover', 'npc', npcId],
    queryFn: async () => {
      const result = await getCoverMedia({ kind: 'npc', entityId: npcId });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to load cover media');
      }
      return result.data;
    },
    enabled: !!npcId && isAdminMediaEnabled(),
    staleTime: 30 * 1000,
  });

  const handleCoverChange = async (mediaId: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['admin-media-cover', 'npc', npcId] });
    queryClient.invalidateQueries({ queryKey: ['admin-npc', npcId] });
    if (onMediaSelected) {
      onMediaSelected(null); // Clear selection after setting cover
    }
  };

  if (loadingCover) {
    return <div className="text-sm text-muted-foreground">Loading cover image...</div>;
  }

  return (
    <CoverImagePanel
      entityKind="npc"
      entityId={npcId}
      coverMedia={coverMedia || undefined}
      selectedMediaId={selectedMediaId || null}
      disabled={isLocked}
      onChange={handleCoverChange}
      entityName={npcName}
    />
  );
}

// Gallery Section Component
function GallerySection({ npcId, npcName, isLocked }: { npcId: string; npcName: string; isLocked: boolean }) {
  const queryClient = useQueryClient();
  
  const { data: galleryItems, isLoading: loadingGallery } = useQuery({
    queryKey: ['admin-media-gallery', 'npc', npcId],
    queryFn: async () => {
      const result = await getGalleryLinks({ kind: 'npc', entityId: npcId });
      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to load gallery');
      }
      return result.data.items;
    },
    enabled: !!npcId && isAdminMediaEnabled(),
    staleTime: 30 * 1000,
  });

  const handleGalleryChange = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-media-gallery', 'npc', npcId] });
  };

  if (loadingGallery) {
    return <div className="text-sm text-muted-foreground">Loading gallery...</div>;
  }

  return (
    <GalleryManager
      entityKind="npc"
      entityId={npcId}
      items={galleryItems || []}
      disabled={isLocked}
      onChange={handleGalleryChange}
      entityName={npcName}
    />
  );
}

export default function EditNPCPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAdmin } = useAppRoles();
  const [loading, setLoading] = useState(false);
  const [loadingNPC, setLoadingNPC] = useState(true);
  const [worldsLoading, setWorldsLoading] = useState(true);
  const [npc, setNPC] = useState<ExtendedNPC | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExtendedUpdateNPCData>({
    name: '',
    description: '',
    status: 'draft',
    prompt: '',
    world_id: '',
    visibility: 'private',
    author_name: '',
    author_type: 'user',
  });

  useEffect(() => {
    if (id) {
      loadNPC();
      loadWorlds();
    }
  }, [id]);

  const loadNPC = async () => {
    if (!id) return;
    
    try {
      setLoadingNPC(true);
      const npcData = await npcsService.getNPC(id) as ExtendedNPC & { extras?: Record<string, unknown> };
      setNPC(npcData);
      
      // Parse the prompt if it exists
      let parsedPrompt = '';
      if (npcData.prompt) {
        try {
          if (typeof npcData.prompt === 'string') {
            parsedPrompt = npcData.prompt;
          } else {
            parsedPrompt = JSON.stringify(npcData.prompt, null, 2);
          }
        } catch (error) {
          console.error('Error parsing prompt:', error);
          parsedPrompt = String(npcData.prompt || '');
        }
      }

      setFormData({
        name: npcData.name,
        description: npcData.description || '',
        prompt: parsedPrompt,
        status: npcData.status,
        world_id: npcData.world_id || '',
        visibility: npcData.visibility || 'private',
        author_name: npcData.author_name || '',
        author_type: npcData.author_type || 'user',
      });
    } catch (error) {
      toast.error('Failed to load NPC');
      console.error('Error loading NPC:', error);
      navigate('/admin/npcs');
    } finally {
      setLoadingNPC(false);
    }
  };

  const loadWorlds = async () => {
    try {
      setWorldsLoading(true);
      const response = await worldsService.listWorlds({ status: 'active' });
      setWorlds(response.data || []);
    } catch (error) {
      console.error('Failed to load worlds:', error);
      toast.error('Failed to load worlds');
      setWorlds([]);
    } finally {
      setWorldsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!id) return;

    try {
      setLoading(true);
      
      // Prepare update data
      const updateData: ExtendedUpdateNPCData = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
      };

      // Add optional fields if they exist
      if (formData.prompt) {
        try {
          // Try to parse as JSON, if it fails, use as string
          const parsed = JSON.parse(formData.prompt as string);
          updateData.prompt = parsed;
        } catch {
          updateData.prompt = formData.prompt;
        }
      }

      if (formData.world_id) {
        updateData.world_id = formData.world_id;
      }

      if (formData.visibility) {
        updateData.visibility = formData.visibility;
      }

      if (formData.author_type) {
        updateData.author_type = formData.author_type;
      }

      if (formData.author_name) {
        updateData.author_name = formData.author_name;
      }

      await npcsService.updateNPC(id, updateData);
      toast.success('NPC updated successfully');
      navigate(`/admin/npcs/${id}`);
    } catch (error) {
      toast.error('Failed to update NPC');
      console.error('Error updating NPC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ExtendedUpdateNPCData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingNPC || worldsLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading NPC...</p>
        </div>
      </div>
    );
  }

  if (!npc) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">NPC Not Found</h2>
        <p className="text-muted-foreground mb-4">The NPC you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/admin/npcs')}>
          Back to NPCs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/admin/npcs/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit NPC</h1>
          <p className="text-muted-foreground">
            Update NPC information
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Details</CardTitle>
          <CardDescription>
            Update the information for this NPC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter NPC name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value as 'draft' | 'active' | 'archived')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="world_id">World</Label>
              <Select
                value={formData.world_id}
                onValueChange={(value) => handleChange('world_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a world" />
                </SelectTrigger>
                <SelectContent>
                  {worlds?.map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => handleChange('visibility', value as 'private' | 'public')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (Only you can see)</SelectItem>
                    <SelectItem value="public">Public (Everyone can see)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="author_type">Author Type</Label>
                <Select
                  value={formData.author_type}
                  onValueChange={(value) => handleChange('author_type', value as 'user' | 'original' | 'system')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Player Character</SelectItem>
                    <SelectItem value="original">Original Character</SelectItem>
                    <SelectItem value="system">System Character</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.author_type === 'original' && (
              <div className="space-y-2">
                <Label htmlFor="author_name">Author Name</Label>
                <Input
                  id="author_name"
                  value={formData.author_name}
                  onChange={(e) => handleChange('author_name', e.target.value)}
                  placeholder="e.g., J.R.R. Tolkien, George Lucas"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter NPC description"
                rows={4}
              />
            </div>

            {/* Legacy Prompt Textarea - shown only when feature flag is off AND retirement flag is off */}
            {!isAdminPromptFormsEnabled() && !isLegacyPromptTextareaRetired() && (
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  value={typeof formData.prompt === 'string' ? formData.prompt : JSON.stringify(formData.prompt, null, 2)}
                  onChange={(e) => handleChange('prompt', e.target.value)}
                  placeholder="Enter NPC prompt/instructions for the AI"
                  rows={6}
                />
                <p className="text-sm text-muted-foreground">
                  This is the AI prompt that will be used when this NPC appears in the game.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {id && npc && (
                <>
                  {isPublishingWizardEnabled() && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/admin/publishing-wizard/npc/${id}`)}
                      disabled={npc && (npc as any).publish_status === 'published'}
                    >
                      Publishing Wizard
                    </Button>
                  )}
                  <PublishButton
                    type="npc"
                    id={id}
                    worldId={npc.world_id}
                    worldName={npc.world_id} // TODO: Get actual world name
                  />
                </>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/admin/npcs/${id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Updating...' : 'Update NPC'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Phase 6: Preflight Panel */}
      {id && <PreflightPanel type="npc" id={id} />}

      {/* Extras Form - shown when feature flag is off, or as part of PromptAuthoringSection when on */}
      {!isAdminPromptFormsEnabled() && id && (
        <ExtrasForm
          packType="npc"
          packId={id}
          initialExtras={(npc as any)?.extras || null}
          onSuccess={() => {
            loadNPC(); // Reload to get updated extras
          }}
        />
      )}

      {/* Prompt Authoring Section - shown when feature flag is on */}
      {isAdminPromptFormsEnabled() && id && npc && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt Authoring (Preview)</CardTitle>
            <CardDescription>
              Preview and analyze the prompt that will be generated for this NPC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ContextChips
                context={{
                  npcIds: [id],
                  worldId: npc.world_id || undefined,
                }}
                npcNames={{ [id]: npc.name }}
                showTemplatesLink={true}
              />
            </div>
            {(!npc.world_id) && (
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Partial context:</strong> Only NPC data is available. For a complete preview, assign this NPC to a world.
                </AlertDescription>
              </Alert>
            )}
            <PromptAuthoringSection
              initialContext={{
                npcIds: [id],
                worldId: npc.world_id || undefined,
                // templatesVersion can be added later when story/game pin is available
              }}
              initialExtrasOverrides={{
                npcs: {
                  [id]: (npc as any)?.extras || {},
                },
              }}
              onResult={async (result) => {
                const contextFlags = {
                  hasWorld: !!npc.world_id,
                  hasRuleset: false, // NPCs don't have direct ruleset
                  hasScenario: false,
                  npcCount: 1,
                  templatesVersion: undefined, // TODO: Get from story/game if available
                };

                if (!result.data) {
                  // Error case
                  if (result.type === 'preview') {
                    await trackAdminEvent('npc.promptAuthoring.preview.failed', {
                      npcId: id,
                      ...contextFlags,
                    });
                  } else if (result.type === 'budget') {
                    await trackAdminEvent('npc.promptAuthoring.budget.failed', {
                      npcId: id,
                      ...contextFlags,
                    });
                  }
                  return;
                }

                // Success case
                if (result.type === 'preview') {
                  await trackAdminEvent('npc.promptAuthoring.preview.success', {
                    npcId: id,
                    ...contextFlags,
                  });
                } else if (result.type === 'budget') {
                  await trackAdminEvent('npc.promptAuthoring.budget.success', {
                    npcId: id,
                    ...contextFlags,
                    tokensBefore: result.data?.tokens?.before,
                    tokensAfter: result.data?.tokens?.after,
                  });
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Phase 3b: Images section (admin-only, feature-flagged) */}
      {isAdminMediaEnabled() && id && npc && (
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
            <CardDescription>
              Upload and manage cover images and gallery for this NPC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Section */}
            <MediaUploader
              kind="npc"
              entityName={npc.name}
              onUploaded={async (media) => {
                toast.success('Image uploaded and finalized successfully');
                // Set the uploaded media as selected so user can set it as cover
                setSelectedMediaId(media.id);
                
                // Automatically add to gallery
                try {
                  const { createMediaLink } = await import('@/services/admin.media');
                  const result = await createMediaLink({
                    target: { kind: 'npc', id: id! },
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
                queryClient.invalidateQueries({ queryKey: ['admin-media-cover', 'npc', id] });
                queryClient.invalidateQueries({ queryKey: ['admin-media-gallery', 'npc', id] });
              }}
            />

            {/* Cover Image Panel */}
            <CoverImageSection 
              npcId={id} 
              npcName={npc.name} 
              isLocked={!isAdmin && (npc as any).publish_status === 'published'}
              selectedMediaId={selectedMediaId}
              onMediaSelected={setSelectedMediaId}
            />

            {/* Gallery Manager */}
            <GallerySection 
              npcId={id} 
              npcName={npc.name} 
              isLocked={!isAdmin && (npc as any).publish_status === 'published'} 
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

