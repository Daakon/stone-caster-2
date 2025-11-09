/**
 * World Edit Page
 * Form for editing existing worlds
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { worldsService, type UpdateWorldData, type World } from '@/services/admin.worlds';
import { PromptAuthoringSection } from '@/components/admin/prompt-authoring/PromptAuthoringSection';
import { ContextChips } from '@/components/admin/prompt-authoring/ContextChips';
import { isAdminPromptFormsEnabled, isLegacyPromptTextareaRetired } from '@/lib/feature-flags';
import { trackAdminEvent } from '@/lib/admin-telemetry';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WorldEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [loadingWorld, setLoadingWorld] = useState(true);
  const [world, setWorld] = useState<World | null>(null);
  const [formData, setFormData] = useState<UpdateWorldData>({
    name: '',
    description: '',
    prompt: '',
    status: 'draft',
  });
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (id) {
      loadWorld();
    }
  }, [id]);

  const loadWorld = async () => {
    if (!id) return;
    
    try {
      setLoadingWorld(true);
      const worldData = await worldsService.getWorld(id);
      setWorld(worldData);
      // Parse the prompt from the doc field
      let parsedPrompt = '';
      if (worldData.doc?.prompt) {
        try {
          // If it's a stringified JSON, parse it
          if (typeof worldData.doc.prompt === 'string') {
            parsedPrompt = worldData.doc.prompt;
          } else {
            // If it's already an object, stringify it for display
            parsedPrompt = JSON.stringify(worldData.doc.prompt, null, 2);
          }
        } catch (error) {
          console.error('Error parsing prompt:', error);
          parsedPrompt = worldData.doc.prompt || '';
        }
      }

      setFormData({
        name: worldData.name,
        description: worldData.description || '',
        prompt: parsedPrompt,
        status: worldData.status,
      });
      
      // Generate slug from name if not provided
      const generatedSlug = worldData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generatedSlug);
    } catch (error) {
      toast.error('Failed to load world');
      console.error('Error loading world:', error);
      navigate('/admin/worlds');
    } finally {
      setLoadingWorld(false);
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
      await worldsService.updateWorld(id, formData);
      toast.success('World updated successfully');
      navigate(`/admin/worlds/${id}`);
    } catch (error) {
      toast.error('Failed to update world');
      console.error('Error updating world:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof UpdateWorldData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingWorld) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading world...</p>
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">World Not Found</h2>
        <p className="text-muted-foreground mb-4">The world you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/admin/worlds')}>
          Back to Worlds
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
          onClick={() => navigate(`/admin/worlds/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit World</h1>
          <p className="text-muted-foreground">
            Update world information
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>World Details</CardTitle>
          <CardDescription>
            Update the information for this world.
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
                  placeholder="Enter world name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="world-slug"
                />
                <p className="text-sm text-muted-foreground">
                  URL-friendly identifier (auto-generated from name)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter world description"
                rows={4}
              />
            </div>

            {/* Legacy Prompt Textarea - shown only when feature flag is off AND retirement flag is off */}
            {!isAdminPromptFormsEnabled() && !isLegacyPromptTextareaRetired() && (
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt (JSONB)</Label>
                <Textarea
                  id="prompt"
                  value={typeof formData.prompt === 'string' ? formData.prompt : JSON.stringify(formData.prompt, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleChange('prompt', parsed);
                    } catch {
                      // If not valid JSON, store as string for now
                      handleChange('prompt', e.target.value);
                    }
                  }}
                  placeholder='Enter world prompt as JSON, e.g. {"system": "You are a fantasy world", "rules": ["No magic", "Medieval setting"]}'
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  Enter structured prompt data as JSON. This allows for complex, multi-part prompts with unlimited length.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/admin/worlds/${id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Updating...' : 'Update World'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Prompt Authoring Section - shown when feature flag is on */}
      {isAdminPromptFormsEnabled() && id && world && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt Authoring (Preview)</CardTitle>
            <CardDescription>
              Preview and analyze the prompt that will be generated for this world
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ContextChips
                context={{
                  worldId: id,
                }}
                worldName={world.name}
                showTemplatesLink={true}
              />
            </div>
            <PromptAuthoringSection
              initialContext={{
                worldId: id,
                // templatesVersion can be added later when story/game pin is available
              }}
              initialExtrasOverrides={{
                world: (world as any)?.extras || {},
              }}
              onResult={async (result) => {
                const contextFlags = {
                  hasWorld: true,
                  hasRuleset: false,
                  hasScenario: false,
                  npcCount: 0,
                  templatesVersion: undefined, // TODO: Get from story/game if available
                };

                if (!result.data) {
                  if (result.type === 'preview') {
                    await trackAdminEvent('world.promptAuthoring.preview.failed', {
                      worldId: id,
                      ...contextFlags,
                    });
                  } else if (result.type === 'budget') {
                    await trackAdminEvent('world.promptAuthoring.budget.failed', {
                      worldId: id,
                      ...contextFlags,
                    });
                  }
                  return;
                }

                if (result.type === 'preview') {
                  await trackAdminEvent('world.promptAuthoring.preview.success', {
                    worldId: id,
                    ...contextFlags,
                  });
                } else if (result.type === 'budget') {
                  await trackAdminEvent('world.promptAuthoring.budget.success', {
                    worldId: id,
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
    </div>
  );
}
