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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraWorldsService, type CreateWorldData, type UpdateWorldData } from '@/services/chimera.worlds';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';
import { TagSelect } from '@/components/chimera/TagSelect';

export default function WorldEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<CreateWorldData>({
    display_name: '',
    description_short: null,
    description_long: null,
    ruleset_template_ids: [],
    tag_names: [],
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
      setFormData({
        display_name: existingWorld.display_name,
        description_short: existingWorld.description_short,
        description_long: existingWorld.description_long,
        ruleset_template_ids: existingWorld.ruleset_links?.map(
          (link: { ruleset_template_id: string }) => link.ruleset_template_id
        ) || [],
        tag_names: (existingWorld as any).tags?.map((t: { tag_name: string }) => t.tag_name) || [],
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
      if (isEditing && id) {
        // Explicitly exclude visibility from update data
        const { visibility, ...updateData } = formData;
        await chimeraWorldsService.updateWorld(id, updateData);
        toast.success('World updated successfully');
      } else {
        // Explicitly exclude visibility from create data
        const { visibility, ...createData } = formData;
        await chimeraWorldsService.createWorld(createData);
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

            <TagSelect
              selectedTagNames={formData.tag_names || []}
              onTagNamesChange={(tagNames) => handleChange('tag_names', tagNames)}
              description="Select existing approved tags or create new ones (new tags require admin approval)"
            />

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

