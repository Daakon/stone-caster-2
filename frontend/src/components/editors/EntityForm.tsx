/**
 * Entity Form Component
 * Reusable form for creating/editing entities (used by Dashboard and Admin)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { TagSelect } from '@/components/chimera/TagSelect';
import { ImageUploader } from '@/components/ui/ImageUploader';
import type { CreateEntityData } from '@/services/chimera.entities';

const ENTITY_TYPE_OPTIONS = [
  { value: 'NPC', label: 'NPC' },
  { value: 'ITEM', label: 'Item' },
  { value: 'FACTION', label: 'Faction' },
  { value: 'LOCATION', label: 'Location' },
] as const;

interface EntityFormProps {
  initialData?: Partial<CreateEntityData>;
  onSubmit: (data: CreateEntityData) => Promise<void>;
  isLoading?: boolean;
  isOfficialMode?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

export function EntityForm({
  initialData,
  onSubmit,
  isLoading = false,
  isOfficialMode = false,
  onCancel,
  submitLabel,
}: EntityFormProps) {
  const [formData, setFormData] = useState<CreateEntityData>({
    display_name: '',
    description_short: null,
    entity_type: 'NPC',
    base_state_json: {},
    tag_names: [],
    images: [],
    ...initialData,
  });

  const [baseStateJsonText, setBaseStateJsonText] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        display_name: initialData.display_name || '',
        description_short: initialData.description_short ?? null,
        entity_type: initialData.entity_type || 'NPC',
        base_state_json: initialData.base_state_json || {},
        tag_names: initialData.tag_names || [],
        images: initialData.images || [],
      });
      setBaseStateJsonText(JSON.stringify(initialData.base_state_json || {}, null, 2));
    }
  }, [initialData]);

  const handleChange = (field: keyof CreateEntityData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleJsonChange = (value: string) => {
    setBaseStateJsonText(value);
    setJsonError(null);
    
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('base_state_json must be a JSON object');
        return;
      }
      setFormData((prev) => ({ ...prev, base_state_json: parsed }));
    } catch (error) {
      setJsonError('Invalid JSON format');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate JSON before submitting
    try {
      const parsed = JSON.parse(baseStateJsonText);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('base_state_json must be a JSON object');
        return;
      }
      setFormData((prev) => ({ ...prev, base_state_json: parsed }));
    } catch (error) {
      setJsonError('Invalid JSON format in base_state_json');
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Entity Details</CardTitle>
          <CardDescription>
            {isOfficialMode
              ? 'Configure official entity properties (will be marked as official)'
              : 'Configure your entity template properties'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isOfficialMode && (
            <Alert>
              <AlertDescription>
                This entity will be created as an official Stone Caster entity and will be visible to all users.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => handleChange('display_name', e.target.value)}
                placeholder="Enter entity name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_type">Entity Type *</Label>
              <Select
                value={formData.entity_type}
                onValueChange={(value) => handleChange('entity_type', value as typeof formData.entity_type)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <TagSelect
            selectedTagNames={formData.tag_names || []}
            onTagNamesChange={(tagNames) => handleChange('tag_names', tagNames)}
            description="Select existing approved tags or create new ones (new tags require admin approval)"
          />

          <div className="space-y-2">
            <Label>Entity Images</Label>
            <ImageUploader
              folder="entities"
              onUploadComplete={(publicUrl) => {
                const newAsset = {
                  id: self.crypto.randomUUID(),
                  url: publicUrl,
                  role: 'portrait' as const,
                  label: 'Portrait',
                };

                const existingImages = formData.images || [];
                const updatedImages = [newAsset, ...existingImages];
                handleChange('images', updatedImages);
              }}
            />
            {formData.images && formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {formData.images.map((img: any, idx: number) => (
                  <div key={img.id || idx} className="relative group">
                    <img
                      src={img.url}
                      alt={img.label || `Image ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const updatedImages = formData.images?.filter((_, i) => i !== idx) || [];
                        handleChange('images', updatedImages);
                      }}
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_state_json">Base State JSON *</Label>
            <Textarea
              id="base_state_json"
              value={baseStateJsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder='{"stats": {"health": 10, "disposition": "friendly"}}'
              rows={12}
              className={jsonError ? 'border-destructive font-mono text-sm' : 'font-mono text-sm'}
            />
            {jsonError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{jsonError}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              Enter a valid JSON object representing the base state of this entity. Example: {'{"stats": {"health": 10, "disposition": "friendly"}}'}
            </p>
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
            <Button type="submit" disabled={isLoading || !!jsonError}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                submitLabel || 'Save Entity'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
