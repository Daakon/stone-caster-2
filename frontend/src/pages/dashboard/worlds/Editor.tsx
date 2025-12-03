/**
 * Chimera World Editor
 * Create or edit worlds
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraWorldsService, type CreateWorldData } from '@/services/chimera.worlds';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';
import { TagSelect } from '@/components/chimera/TagSelect';
import { ImageUploader } from '@/components/ui/ImageUploader';

export default function WorldEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<CreateWorldData>({
    display_name: '',
    description_short: null,
    description_long: null,
    character_schema_contributions: {},
    ruleset_template_ids: [],
    tag_names: [],
    tags: [],
    images: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing world if editing
  const { data: existingWorld, isLoading: isLoadingWorld } = useQuery({
    queryKey: ['chimera-world', id],
    queryFn: () => chimeraWorldsService.getWorld(id!),
    enabled: isEditing && !!id,
  });

  // Load available MODIFIER ruleset templates
  const { data: allRulesets, isLoading: isLoadingRulesets } = useQuery({
    queryKey: ['chimera-ruleset-templates'],
    queryFn: () => chimeraService.listRulesetTemplates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter to only MODIFIER rulesets
  const modifierRulesets = (allRulesets || []).filter(
    (r: RulesetTemplate) => r.rule_type === 'MODIFIER'
  );

  // Populate form when world loads
  useEffect(() => {
    if (existingWorld) {
      // Extract tags from tags array if available, otherwise from tag_names
      const worldTags = (existingWorld as any).tags;
      const tagsArray = Array.isArray(worldTags) 
        ? worldTags.map((t: string | { tag_name: string }) => 
            typeof t === 'string' ? t : t.tag_name
          )
        : (existingWorld as any).tags?.map((t: { tag_name: string }) => t.tag_name) || [];
      
      setFormData({
        display_name: existingWorld.display_name,
        description_short: existingWorld.description_short,
        description_long: existingWorld.description_long,
        character_schema_contributions: existingWorld.character_schema_contributions || {},
        ruleset_template_ids: existingWorld.ruleset_links?.map(
          (link: { ruleset_template_id: string }) => link.ruleset_template_id
        ) || [],
        tag_names: tagsArray,
        tags: tagsArray,
        images: (existingWorld as any).images || [],
      });
    }
  }, [existingWorld]);

  const handleChange = (field: keyof CreateWorldData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRulesetToggle = (rulesetId: string, checked: boolean) => {
    setFormData((prev) => {
      const currentIds = prev.ruleset_template_ids || [];
      if (checked) {
        return {
          ...prev,
          ruleset_template_ids: [...currentIds, rulesetId],
        };
      } else {
        return {
          ...prev,
          ruleset_template_ids: currentIds.filter((id) => id !== rulesetId),
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      // Prepare payload: ensure tags is a string array from tag_names
      // TagSelect manages tag_names, but API expects tags for filtering
      const payload = {
        ...formData,
        tags: formData.tag_names || formData.tags || [], // Use tag_names as source of truth, fallback to tags
      };

      if (isEditing && id) {
        await chimeraWorldsService.updateWorld(id, payload);
        toast.success('World updated successfully');
      } else {
        await chimeraWorldsService.createWorld(payload);
        toast.success('World created successfully');
      }

      // Invalidate queries and navigate
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-worlds'] });
      navigate('/dashboard/creations/worlds');
    } catch (error) {
      console.error('Error saving world:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save world');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && isLoadingWorld) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/worlds')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit World' : 'Create New World'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? 'Update your world details' : 'Create a new world for the Chimera V2 engine'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>World Details</CardTitle>
            <CardDescription>
              Configure your world properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => handleChange('display_name', e.target.value)}
                placeholder="Enter world name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_short">Short Description</Label>
              <Input
                id="description_short"
                value={formData.description_short || ''}
                onChange={(e) => handleChange('description_short', e.target.value || null)}
                placeholder="Brief description (max 500 characters)"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_long">Long Description</Label>
              <Textarea
                id="description_long"
                value={formData.description_long || ''}
                onChange={(e) => handleChange('description_long', e.target.value || null)}
                placeholder="Detailed description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="character_schema_contributions">Character Schema Contributions (JSON)</Label>
              <Textarea
                id="character_schema_contributions"
                value={JSON.stringify(formData.character_schema_contributions || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || '{}');
                    handleChange('character_schema_contributions', parsed);
                  } catch {
                    // Invalid JSON, ignore for now
                  }
                }}
                placeholder='{"essence_alignment": { ... }}'
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                JSON schema definitions that this World contributes to character creation (e.g., essence_alignment field)
              </p>
            </div>

            <TagSelect
              selectedTagNames={formData.tag_names || []}
              onTagNamesChange={(tagNames) => {
                // TagSelect works with tag_names (string array)
                // Map to tags array for API compatibility
                handleChange('tag_names', tagNames);
                handleChange('tags', tagNames); // Sync tags array for Wizard filtering
              }}
              description="Select existing approved tags or create new ones (new tags require admin approval)"
            />

            <div className="space-y-2">
              <Label>World Images</Label>
              <ImageUploader
                folder="worlds"
                onUploadComplete={(publicUrl) => {
                  const newImages = [...(formData.images || []), { path: publicUrl }];
                  handleChange('images', newImages);
                }}
              />
              {formData.images && formData.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img.path}
                        alt={img.alt || `World image ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => {
                          const updatedImages = formData.images?.filter((_, i) => i !== idx) || [];
                          handleChange('images', updatedImages);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label>World Rules (Modifiers)</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select MODIFIER ruleset templates to apply to this world
                </p>
              </div>

              {isLoadingRulesets ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : modifierRulesets.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No MODIFIER ruleset templates available. Create some in the admin panel first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="border rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                  {modifierRulesets.map((ruleset) => {
                    const isChecked = formData.ruleset_template_ids?.includes(ruleset.id) || false;
                    return (
                      <div key={ruleset.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={`ruleset-${ruleset.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            handleRulesetToggle(ruleset.id, checked === true)
                          }
                        />
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={`ruleset-${ruleset.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {ruleset.display_name}
                          </Label>
                          {ruleset.description_short && (
                            <p className="text-sm text-muted-foreground">
                              {ruleset.description_short}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Category: {ruleset.rule_category}</span>
                            <span>•</span>
                            <span>Version: {ruleset.version}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {formData.ruleset_template_ids && formData.ruleset_template_ids.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {formData.ruleset_template_ids.length} modifier{formData.ruleset_template_ids.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard/creations')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditing ? 'Update World' : 'Create World'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

