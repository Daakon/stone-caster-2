import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Pencil } from 'lucide-react';
import { type EntryPoint, entryPointsService } from '@/services/admin.entryPoints';
import { type WizardData } from '../EntryWizard';
import { NamedSinglePicker } from '@/admin/components/NamedSinglePicker';
import { NamedMultiPicker } from '@/admin/components/NamedMultiPicker';
import { CreateWorldDialog } from '@/admin/components/CreateWorldDialog';
import { useWorlds } from '@/hooks/useWorlds';
import { useRulesets } from '@/hooks/useRulesets';
import { toast } from 'sonner';

const basicsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  type: z.enum(['adventure', 'scenario', 'sandbox', 'quest']),
  worldId: z.string().min(1, 'World is required'),
  rulesetIds: z.array(z.string()).min(1, 'At least one ruleset is required'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
  subtitle: z.string().optional(),
  synopsis: z.string().optional(),
});

type BasicsFormData = z.infer<typeof basicsSchema>;

interface BasicsStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

export function BasicsStep({ entry, data, onUpdate, onComplete }: BasicsStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [createWorldDialogOpen, setCreateWorldDialogOpen] = useState(false);
  const [editWorldDialogOpen, setEditWorldDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { worlds, loading: worldsLoading } = useWorlds();
  const { rulesets, loading: rulesetsLoading } = useRulesets();
  
  // Get initial values from entry or wizard data
  const getInitialValues = (): BasicsFormData => {
    const rulesetIds = entry.rulesets 
      ? entry.rulesets
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(r => r.id)
      : (data.rulesetIds || []);
    
    // Use title as name if name is missing (for backward compatibility)
    const name = entry.name || entry.title || data.name || '';
    
    return {
      name,
      slug: entry.slug || data.slug || '',
      type: (entry.type || data.type || 'adventure') as 'adventure' | 'scenario' | 'sandbox' | 'quest',
      worldId: entry.world_id || data.worldId || '',
      rulesetIds,
      tags: entry.tags || data.tags || [],
      subtitle: entry.subtitle || data.subtitle || '',
      synopsis: entry.synopsis || data.synopsis || '',
    };
  };
  
  const form = useForm<BasicsFormData>({
    resolver: zodResolver(basicsSchema),
    defaultValues: getInitialValues(),
  });
  
  // Track if we just saved to prevent resetting form with stale data
  const [justSaved, setJustSaved] = useState(false);
  
  // Reset form when entry data changes (but not when worlds list refetches or immediately after save)
  useEffect(() => {
    if (entry && entry.id && !justSaved) {
      const initialValues = getInitialValues();
      const currentValues = form.getValues();
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('BasicsStep: Entry data changed', {
          entryWorldId: entry.world_id,
          initialWorldId: initialValues.worldId,
          currentWorldId: currentValues.worldId,
          worldsAvailable: worlds?.length || 0,
          worldIds: worlds?.map(w => w.id) || [],
          worldNames: worlds?.map(w => w.name) || [],
          entryRulesets: entry.rulesets,
          initialRulesetIds: initialValues.rulesetIds,
          worldIdMatch: entry.world_id ? worlds?.some(w => w.id === entry.world_id) : false,
        });
      }
      
      // Always reset form when entry.world_id changes, even if other values haven't changed
      // This ensures the world picker gets the correct value
      const worldIdChanged = currentValues.worldId !== initialValues.worldId;
      
      // Only reset if entry values have actually changed to avoid unnecessary re-renders
      // Note: We don't reset when only worlds array changes (refetch) - only when entry data changes
      const hasChanged = 
        currentValues.name !== initialValues.name ||
        currentValues.slug !== initialValues.slug ||
        currentValues.type !== initialValues.type ||
        worldIdChanged ||
        JSON.stringify(currentValues.rulesetIds) !== JSON.stringify(initialValues.rulesetIds) ||
        JSON.stringify(currentValues.tags) !== JSON.stringify(initialValues.tags) ||
        currentValues.subtitle !== initialValues.subtitle ||
        currentValues.synopsis !== initialValues.synopsis;
      
      if (hasChanged) {
        form.reset(initialValues);
        // Explicitly set worldId to ensure it's updated
        if (worldIdChanged && initialValues.worldId) {
          setValue('worldId', initialValues.worldId, { shouldValidate: false });
        }
      }
    }
    // Note: Removed 'worlds' from dependencies to prevent form reset when worlds list refetches
    // The worlds array is only used for checking if a world exists, not for form values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, entry.name, entry.title, entry.slug, entry.type, entry.world_id, entry.rulesets, entry.tags, entry.subtitle, entry.synopsis, justSaved]);
  
  // Reset justSaved flag after a delay to allow refetch to complete
  useEffect(() => {
    if (justSaved) {
      const timer = setTimeout(() => {
        setJustSaved(false);
      }, 2000); // 2 second delay to allow refetch to complete
      return () => clearTimeout(timer);
    }
  }, [justSaved]);
  
  const { handleSubmit, watch, setValue, formState: { errors, isValid } } = form;
  
  const watchedName = watch('name');
  const watchedSlug = watch('slug');
  const watchedType = watch('type');
  const watchedWorldId = watch('worldId');
  const watchedRulesetIds = watch('rulesetIds');
  const watchedTags = watch('tags');
  const watchedSubtitle = watch('subtitle');
  const watchedSynopsis = watch('synopsis');
  
  // Update worldId when worlds are loaded and entry has a world_id
  useEffect(() => {
    if (!worldsLoading && worlds && worlds.length > 0 && entry?.world_id) {
      const currentWorldId = form.getValues('worldId');
      // Only update if the current value doesn't match and the world exists in the list
      if (currentWorldId !== entry.world_id) {
        const worldExists = worlds.some(w => w.id === entry.world_id);
        if (worldExists) {
          setValue('worldId', entry.world_id, { shouldValidate: false });
          onUpdate({ worldId: entry.world_id });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldsLoading, worlds, entry?.world_id]);
  
  const handleWorldChange = (worldId: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('BasicsStep: handleWorldChange called', {
        worldId,
        currentValue: form.getValues('worldId'),
      });
    }
    setValue('worldId', worldId, { shouldValidate: true });
    onUpdate({ worldId });
  };
  
  const handleRulesetsChange = (rulesetIds: string[]) => {
    setValue('rulesetIds', rulesetIds, { shouldValidate: true });
    onUpdate({ rulesetIds });
  };
  
  const handleTypeChange = (type: 'adventure' | 'scenario' | 'sandbox' | 'quest') => {
    setValue('type', type, { shouldValidate: true });
    onUpdate({ type });
  };
  
  const handleSubtitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue('subtitle', value, { shouldValidate: true });
    onUpdate({ subtitle: value });
  };
  
  const handleSynopsisChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValue('synopsis', value, { shouldValidate: true });
    onUpdate({ synopsis: value });
  };
  
  const addTag = () => {
    if (tagInput.trim() && watchedTags.length < 10 && !watchedTags.includes(tagInput.trim())) {
      const newTags = [...watchedTags, tagInput.trim()];
      setValue('tags', newTags, { shouldValidate: true });
      onUpdate({ tags: newTags });
      setTagInput('');
    }
  };
  
  const removeTag = (index: number) => {
    const newTags = watchedTags.filter((_, i) => i !== index);
    setValue('tags', newTags, { shouldValidate: true });
    onUpdate({ tags: newTags });
  };
  
  const onSubmit = async (formData: BasicsFormData) => {
    setIsSubmitting(true);
    
    try {
      // Save entry basics to backend
      const updatedEntry = await entryPointsService.updateEntryPoint(entry.id, {
        name: formData.name,
        type: formData.type,
        world_id: formData.worldId,
        rulesetIds: formData.rulesetIds,
        tags: formData.tags,
        subtitle: formData.subtitle,
        synopsis: formData.synopsis,
        // Map name to title for backward compatibility
        title: formData.name,
        // Map synopsis to description if description is missing
        description: entry.description || formData.synopsis || '',
      });
      
      toast.success('Entry basics saved successfully');
      
      // Update the form with the saved values to prevent reset on refetch
      // This ensures the form shows the saved values even if the refetch hasn't completed
      form.reset({
        name: formData.name,
        slug: formData.slug,
        type: formData.type,
        worldId: formData.worldId,
        rulesetIds: formData.rulesetIds,
        tags: formData.tags,
        subtitle: formData.subtitle,
        synopsis: formData.synopsis,
      });
      
      // Set flag to prevent form reset during refetch
      setJustSaved(true);
      
      // Invalidate and refetch entry data in the background to get the latest saved values
      // Don't await - let it happen in the background
      queryClient.invalidateQueries({ queryKey: ['admin-entry', entry.id] });
      
      onUpdate(formData);
      onComplete(formData);
    } catch (error) {
      console.error('Failed to save basics:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save entry basics');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      className="space-y-6"
      onClick={(e) => {
        // Allow clicks in popovers/command menus to work
        const target = e.target as HTMLElement;
        if (target.closest('[role="combobox"]') || target.closest('[cmdk-list]') || target.closest('[cmdk-item]')) {
          e.stopPropagation();
        }
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name and Slug */}
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>
              Basic information about this entry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter entry name"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                {...form.register('slug')}
                placeholder="entry-slug"
                readOnly
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-generated from name
              </p>
            </div>
            
            <div>
              <Label htmlFor="type">Story Type</Label>
              <Select
                value={watchedType}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select story type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adventure">Adventure</SelectItem>
                  <SelectItem value="scenario">Scenario</SelectItem>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="quest">Quest</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-600 mt-1">{errors.type.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                {...form.register('subtitle')}
                onChange={handleSubtitleChange}
                placeholder="Enter subtitle"
              />
              {errors.subtitle && (
                <p className="text-sm text-red-600 mt-1">{errors.subtitle.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* World Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>World</CardTitle>
                <CardDescription>
                  Select the world for this entry
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditWorldDialogOpen(true)}
                  disabled={!watchedWorldId}
                  title={watchedWorldId ? "Edit selected world" : "Select a world to edit"}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateWorldDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New World
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {worldsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading worlds...</p>
              </div>
            ) : (
                  <NamedSinglePicker
                    items={worlds?.map(world => ({
                      id: world.id,
                      name: world.name,
                      description: world.description,
                    })) || []}
                    value={watchedWorldId || entry.world_id || data.worldId || ''}
                    onValueChange={handleWorldChange}
                    placeholder="Select a world"
                    allowCreateNew={true}
                    onCreateNewLabel="Create New World"
                    onCreated={(worldId) => {
                      // World is automatically selected after creation
                      handleWorldChange(worldId);
                    }}
                  />
            )}
            {errors.worldId && (
              <p className="text-sm text-red-600 mt-1">{errors.worldId.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Rulesets Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Rulesets</CardTitle>
          <CardDescription>
            Select and order the rulesets for this entry. The order matters for prompt assembly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesetsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading rulesets...</p>
            </div>
          ) : (
            <NamedMultiPicker
              items={rulesets?.map(ruleset => ({
                id: ruleset.id,
                name: ruleset.name,
                description: ruleset.description,
              })) || []}
              value={watchedRulesetIds}
              onValueChange={handleRulesetsChange}
              placeholder="Select rulesets"
            />
          )}
          {errors.rulesetIds && (
            <p className="text-sm text-red-600 mt-1">{errors.rulesetIds.message}</p>
          )}
        </CardContent>
      </Card>
      
      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Add tags to help categorize your entry point (max 10)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button 
              type="button" 
              onClick={addTag} 
              disabled={!tagInput.trim() || watchedTags.length >= 10}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {watchedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {watchedTags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {errors.tags && (
            <p className="text-sm text-red-600 mt-1">{errors.tags.message}</p>
          )}
        </CardContent>
      </Card>
      
      {/* Description and Synopsis */}
      <Card>
        <CardHeader>
          <CardTitle>Description & Synopsis</CardTitle>
          <CardDescription>
            Provide detailed information about your entry point
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="synopsis">Synopsis</Label>
            <Textarea
              id="synopsis"
              {...form.register('synopsis')}
              onChange={handleSynopsisChange}
              placeholder="Enter synopsis"
              rows={4}
            />
            {errors.synopsis && (
              <p className="text-sm text-red-600 mt-1">{errors.synopsis.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Review your selections before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Entry:</span>
              <Badge variant="outline">{watchedName || 'Untitled'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Type:</span>
              <Badge variant="outline">{watchedType || 'Not selected'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">World:</span>
              <Badge variant="outline">
                {worlds?.find(w => w.id === watchedWorldId)?.name || 'Not selected'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Rulesets:</span>
              <div className="flex gap-1 flex-wrap">
                {watchedRulesetIds.length > 0 ? (
                  watchedRulesetIds.map((rulesetId, index) => {
                    const ruleset = rulesets?.find(r => r.id === rulesetId);
                    return (
                      <Badge key={rulesetId} variant="secondary">
                        {index + 1}. {ruleset?.name || 'Unknown'}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">None selected</span>
                )}
              </div>
            </div>
            {watchedTags.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Tags:</span>
                <div className="flex gap-1 flex-wrap">
                  {watchedTags.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={!isValid || isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </form>
    <CreateWorldDialog
      open={createWorldDialogOpen}
      onOpenChange={setCreateWorldDialogOpen}
      onCreated={(worldId) => {
        // World is automatically selected after creation
        handleWorldChange(worldId);
      }}
    />
    <CreateWorldDialog
      open={editWorldDialogOpen}
      onOpenChange={setEditWorldDialogOpen}
      worldId={watchedWorldId || entry.world_id || data.worldId || undefined}
      onCreated={(worldId) => {
        // After editing, don't invalidate worlds query to avoid form reset
        // The world data is updated but the list doesn't need to refresh
        // Only invalidate if we need to show the updated world name in the list
        // For now, skip invalidation to preserve form state
      }}
    />
  </>
  );
}
