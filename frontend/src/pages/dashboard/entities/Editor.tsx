/**
 * Chimera Entity Editor
 * Create or edit entity templates
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraEntitiesService, type CreateEntityData, type UpdateEntityData } from '@/services/chimera.entities';
import { TagSelect } from '@/components/chimera/TagSelect';

const ENTITY_TYPE_OPTIONS = [
  { value: 'NPC', label: 'NPC' },
  { value: 'ITEM', label: 'Item' },
  { value: 'FACTION', label: 'Faction' },
  { value: 'LOCATION', label: 'Location' },
] as const;

export default function EntityEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<CreateEntityData>({
    display_name: '',
    description_short: null,
    entity_type: 'NPC',
    base_state_json: {},
    tag_names: [],
  });

  const [baseStateJsonText, setBaseStateJsonText] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing entity if editing
  const { data: existingEntity, isLoading: isLoadingEntity } = useQuery({
    queryKey: ['chimera-entity', id],
    queryFn: () => chimeraEntitiesService.getEntity(id!),
    enabled: isEditing && !!id,
  });

  // Populate form when entity loads
  useEffect(() => {
    if (existingEntity) {
      setFormData({
        display_name: existingEntity.display_name,
        description_short: existingEntity.description_short,
        entity_type: existingEntity.entity_type,
        base_state_json: existingEntity.base_state_json,
        tag_names: (existingEntity as any).tags?.map((t: { tag_name: string }) => t.tag_name) || [],
      });
      setBaseStateJsonText(JSON.stringify(existingEntity.base_state_json, null, 2));
    }
  }, [existingEntity]);

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
        toast.error('base_state_json must be a JSON object');
        return;
      }
      setFormData((prev) => ({ ...prev, base_state_json: parsed }));
    } catch (error) {
      toast.error('Invalid JSON format in base_state_json');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && id) {
        const updateData: UpdateEntityData = { ...formData };
        await chimeraEntitiesService.updateEntity(id, updateData);
        toast.success('Entity updated successfully');
      } else {
        const createData: CreateEntityData = { ...formData };
        await chimeraEntitiesService.createEntity(createData);
        toast.success('Entity created successfully');
      }

      // Invalidate queries and navigate
      await queryClient.invalidateQueries({ queryKey: ['chimera-my-entities'] });
      navigate('/dashboard/creations/entities');
    } catch (error) {
      console.error('Error saving entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save entity');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && isLoadingEntity) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/entities')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Entity' : 'Create New Entity'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? 'Update your entity template' : 'Create a new entity template for the Chimera V2 engine'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Entity Details</CardTitle>
            <CardDescription>
              Configure your entity template properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard/creations')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !!jsonError}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditing ? 'Update Entity' : 'Create Entity'}
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

