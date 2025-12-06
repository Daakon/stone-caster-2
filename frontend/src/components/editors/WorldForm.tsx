/**
 * World Form Component
 * Reusable form for creating/editing worlds (used by Dashboard and Admin)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';
import { TagSelect } from '@/components/chimera/TagSelect';
import { ImageUploader } from '@/components/ui/ImageUploader';
import type { CreateWorldData } from '@/services/chimera.worlds';

interface WorldFormProps {
  initialData?: Partial<CreateWorldData>;
  onSubmit: (data: CreateWorldData) => Promise<void>;
  isLoading?: boolean;
  isOfficialMode?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

export function WorldForm({
  initialData,
  onSubmit,
  isLoading = false,
  isOfficialMode = false,
  onCancel,
  submitLabel,
}: WorldFormProps) {
  const [formData, setFormData] = useState<CreateWorldData>({
    display_name: '',
    description_short: null,
    description_long: null,
    character_schema_contributions: {},
    ruleset_template_ids: [],
    tag_names: [],
    tags: [],
    images: [],
    ...initialData,
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

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      // Extract tags from tags array if available, otherwise from tag_names
      const tagsArray = Array.isArray(initialData.tags)
        ? initialData.tags.map((t: string | { tag_name: string }) =>
            typeof t === 'string' ? t : t.tag_name
          )
        : initialData.tag_names || [];

      // Extract images - handle both images and definition.images
      let imagesArray: any[] = [];
      if (initialData.images) {
        imagesArray = Array.isArray(initialData.images) ? initialData.images : [];
      } else if ((initialData as any).definition?.images) {
        imagesArray = Array.isArray((initialData as any).definition.images)
          ? (initialData as any).definition.images
          : [];
      }

      setFormData({
        display_name: initialData.display_name || '',
        description_short: initialData.description_short || null,
        description_long: initialData.description_long || null,
        character_schema_contributions: initialData.character_schema_contributions || {},
        ruleset_template_ids: initialData.ruleset_template_ids || [],
        tag_names: tagsArray,
        tags: tagsArray,
        images: imagesArray,
      });
    }
  }, [initialData]);

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

    // Prepare payload: ensure tags is a string array from tag_names
    const payload = {
      ...formData,
      tags: formData.tag_names || formData.tags || [],
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>World Details</CardTitle>
          <CardDescription>
            {isOfficialMode
              ? 'Configure official world properties (will be marked as official)'
              : 'Configure your world properties'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isOfficialMode && (
            <Alert>
              <AlertDescription>
                This world will be created as an official Stone Caster world and will be visible to all users.
              </AlertDescription>
            </Alert>
          )}

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
              handleChange('tag_names', tagNames);
              handleChange('tags', tagNames);
            }}
            description="Select existing approved tags or create new ones (new tags require admin approval)"
          />

          <div className="space-y-2">
            <Label>World Images</Label>
            <ImageUploader
              folder="worlds"
              onUploadComplete={(publicUrl) => {
                const newAsset = {
                  id: self.crypto.randomUUID(),
                  url: publicUrl,
                  role: 'banner' as const,
                  label: 'Main Banner',
                };

                const existingImages = formData.images || [];
                const otherImages = existingImages.filter(
                  (img: any) => img.role !== 'banner'
                );

                const updatedImages = [newAsset, ...otherImages];
                handleChange('images', updatedImages);
              }}
            />
            {formData.images && formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {formData.images.map((img: any, idx) => (
                  <div key={img.id || idx} className="relative">
                    <img
                      src={img.url || img.path}
                      alt={img.label || img.alt || `World image ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-md"
                    />
                    {img.role === 'banner' && (
                      <Badge variant="secondary" className="absolute top-1 left-1 text-xs">
                        Banner
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => {
                        const updatedImages = formData.images?.filter(
                          (i: any, index: number) => index !== idx
                        ) || [];
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
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                submitLabel || 'Save World'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
