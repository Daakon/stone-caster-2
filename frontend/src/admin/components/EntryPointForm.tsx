/**
 * Entry Point Form Component
 * Phase 3: Form for creating and editing entry points
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { entryPointsService, type EntryPoint, type CreateEntryPointData, type UpdateEntryPointData } from '@/services/admin.entryPoints';
import { useAppRoles } from '@/admin/routeGuard';

const entryPointSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9_-]+$/, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores'),
  type: z.enum(['adventure', 'scenario', 'sandbox', 'quest']),
  world_id: z.string().min(1, 'World is required'),
  rulesetIds: z.array(z.string()).min(1, 'At least one ruleset is required'),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  synopsis: z.string().optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
  visibility: z.enum(['public', 'unlisted', 'private']),
  content_rating: z.string().min(1, 'Content rating is required'),
  lifecycle: z.enum(['draft', 'pending_review', 'changes_requested', 'active', 'archived', 'rejected']).optional()
});

type EntryPointFormData = z.infer<typeof entryPointSchema>;

interface EntryPointFormProps {
  entryPoint?: EntryPoint;
  onSave: (data: CreateEntryPointData | UpdateEntryPointData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function EntryPointForm({ entryPoint, onSave, onCancel, loading = false }: EntryPointFormProps) {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [worlds, setWorlds] = useState<Array<{ id: string; name: string }>>([]);
  const [rulesets, setRulesets] = useState<Array<{ id: string; name: string }>>([]);
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<EntryPointFormData>({
    resolver: zodResolver(entryPointSchema),
    defaultValues: {
      name: entryPoint?.name || '',
      slug: entryPoint?.slug || '',
      type: entryPoint?.type || 'adventure',
      world_id: entryPoint?.world_id || '',
      rulesetIds: entryPoint?.rulesets?.map(r => r.id) || [],
      title: entryPoint?.title || '',
      subtitle: entryPoint?.subtitle || '',
      description: entryPoint?.description || '',
      synopsis: entryPoint?.synopsis || '',
      tags: entryPoint?.tags || [],
      visibility: entryPoint?.visibility || 'private',
      content_rating: entryPoint?.content_rating || 'safe',
      lifecycle: entryPoint?.lifecycle || 'draft'
    }
  });

  const watchedTags = watch('tags');
  const watchedLifecycle = watch('lifecycle');

  // Load worlds and rulesets
  useEffect(() => {
    loadWorlds();
    loadRulesets();
  }, []);

  const loadWorlds = async () => {
    try {
      const worldsData = await entryPointsService.getWorlds();
      setWorlds(worldsData);
    } catch (error) {
      toast.error('Failed to load worlds');
      console.error('Error loading worlds:', error);
    }
  };

  const loadRulesets = async () => {
    try {
      const rulesetsData = await entryPointsService.getRulesets();
      setRulesets(rulesetsData);
    } catch (error) {
      toast.error('Failed to load rulesets');
      console.error('Error loading rulesets:', error);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && watchedTags.length < 10) {
      const newTags = [...watchedTags, tagInput.trim()];
      setValue('tags', newTags);
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    const newTags = watchedTags.filter((_, i) => i !== index);
    setValue('tags', newTags);
  };

  const onSubmit = async (data: EntryPointFormData) => {
    try {
      await onSave(data);
    } catch (error) {
      console.error('Error saving entry point:', error);
    }
  };

  const canSetLifecycle = (lifecycle: string) => {
    if (isCreator) {
      return lifecycle === 'draft' || lifecycle === 'pending_review' || lifecycle === 'changes_requested';
    }
    return true; // Moderators and admins can set any lifecycle
  };

  const getLifecycleOptions = () => {
    const allOptions = [
      { value: 'draft', label: 'Draft' },
      { value: 'pending_review', label: 'Pending Review' },
      { value: 'changes_requested', label: 'Changes Requested' },
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
      { value: 'rejected', label: 'Rejected' }
    ];

    if (isCreator) {
      return allOptions.filter(option => 
        option.value === 'draft' || 
        option.value === 'pending_review' || 
        option.value === 'changes_requested'
      );
    }

    return allOptions;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Core details about your entry point
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Internal Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Internal identifier (e.g., test-entry-point-1)"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Internal database identifier. Use lowercase letters, numbers, hyphens, and underscores.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Enter entry point title"
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register('slug')}
                placeholder="url-friendly-identifier"
              />
              {errors.slug && (
                <p className="text-sm text-red-500">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              {...register('subtitle')}
              placeholder="Optional subtitle"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Brief description of the entry point"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="synopsis">Synopsis</Label>
            <Textarea
              id="synopsis"
              {...register('synopsis')}
              placeholder="Detailed synopsis of the adventure"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Story Start Notice */}
      <Card>
        <CardHeader>
          <CardTitle>Story Start Content</CardTitle>
          <CardDescription>
            Define how the story begins for players
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Note:</strong> Story start content is managed in the <strong>Segments</strong> tab after saving this entry point.
            </p>
            <p className="text-xs text-muted-foreground">
              Create an "Entry Start" segment with scope <code className="bg-background px-1 rounded">entry_start</code> to define the opening narrative, atmosphere, and initial scene description that players will see on the first turn.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Set the type, world, and rules for your entry point
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={watch('type')}
                onValueChange={(value) => setValue('type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adventure">Adventure</SelectItem>
                  <SelectItem value="scenario">Scenario</SelectItem>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="quest">Quest</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-500">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="world_id">World *</Label>
              <Select
                value={watch('world_id')}
                onValueChange={(value) => setValue('world_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select world" />
                </SelectTrigger>
                <SelectContent>
                  {worlds.map(world => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.world_id && (
                <p className="text-sm text-red-500">{errors.world_id.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rulesetIds">Ruleset *</Label>
            <Select
              value={watch('rulesetIds')?.[0] || ''}
              onValueChange={(value) => setValue('rulesetIds', [value])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ruleset" />
              </SelectTrigger>
              <SelectContent>
                {rulesets.map(ruleset => (
                  <SelectItem key={ruleset.id} value={ruleset.id}>
                    {ruleset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.rulesetIds && (
              <p className="text-sm text-red-500">{errors.rulesetIds.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Multi-ruleset support coming soon. Currently, only one ruleset can be selected.
            </p>
          </div>
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
            <Button type="button" onClick={addTag} disabled={!tagInput.trim() || watchedTags.length >= 10}>
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
            <p className="text-sm text-red-500">{errors.tags.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Visibility and Lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle>Visibility & Lifecycle</CardTitle>
          <CardDescription>
            Control who can see your entry point and its current state
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={watch('visibility')}
                onValueChange={(value) => setValue('visibility', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content_rating">Content Rating</Label>
              <Select
                value={watch('content_rating')}
                onValueChange={(value) => setValue('content_rating', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">Safe</SelectItem>
                  <SelectItem value="mature">Mature</SelectItem>
                  <SelectItem value="explicit">Explicit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(isModerator || isAdmin) && (
            <div className="space-y-2">
              <Label htmlFor="lifecycle">Lifecycle</Label>
              <Select
                value={watch('lifecycle')}
                onValueChange={(value) => setValue('lifecycle', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lifecycle" />
                </SelectTrigger>
                <SelectContent>
                  {getLifecycleOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isCreator && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> As a creator, you can only set lifecycle to Draft, Pending Review, or Changes Requested. 
                Moderators and admins can set the entry point to Active.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : entryPoint ? 'Update Entry Point' : 'Create Entry Point'}
        </Button>
      </div>
    </form>
  );
}











