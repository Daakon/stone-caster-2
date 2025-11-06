/**
 * Ruleset Form Component
 * Create/edit ruleset with validation
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { type Ruleset, type CreateRulesetData, type UpdateRulesetData } from '@/services/admin.rulesets';

const rulesetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string().min(1, 'Slug is required').max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  prompt: z.any().optional(), // JSONB - no character limit
  status: z.enum(['draft', 'active', 'archived'])
});

type RulesetFormData = z.infer<typeof rulesetSchema>;

interface RulesetFormProps {
  ruleset?: Ruleset;
  onSubmit: (data: CreateRulesetData | UpdateRulesetData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function RulesetForm({ ruleset, onSubmit, onCancel, loading = false }: RulesetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<RulesetFormData>({
    resolver: zodResolver(rulesetSchema),
    defaultValues: {
      name: ruleset?.name || '',
      slug: ruleset?.slug || '',
      description: ruleset?.description || '',
      prompt: ruleset?.prompt || '',
      status: ruleset?.status ?? 'active'
    }
  });

  const watchedName = watch('name');

  // Auto-generate slug from name
  useEffect(() => {
    if (!ruleset && watchedName) {
      const slug = watchedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setValue('slug', slug);
    }
  }, [watchedName, ruleset, setValue]);

  const handleFormSubmit = async (data: RulesetFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      toast.success(ruleset ? 'Ruleset updated successfully' : 'Ruleset created successfully');
    } catch (error) {
      toast.error(ruleset ? 'Failed to update ruleset' : 'Failed to create ruleset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ruleset ? 'Edit Ruleset' : 'Create Ruleset'}</CardTitle>
        <CardDescription>
          {ruleset ? 'Update ruleset information' : 'Create a new game ruleset'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter ruleset name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register('slug')}
                placeholder="ruleset-slug"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && (
                <p className="text-sm text-red-600 mt-1">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Brief description of the ruleset..."
              rows={4}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              {...register('prompt')}
              placeholder="Enter the ruleset's prompt content for AI generation..."
              rows={4}
              className={errors.prompt ? 'border-red-500' : ''}
            />
            {errors.prompt && (
              <p className="text-sm text-red-600 mt-1">{errors.prompt.message as string}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              This prompt will be used by the AI to understand the ruleset's mechanics and constraints.
            </p>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(value) => setValue('status', value as 'draft' | 'active' | 'archived')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 mt-1">
              Active rulesets are available for selection in entry points
            </p>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || loading}>
              {isSubmitting ? 'Saving...' : (ruleset ? 'Update Ruleset' : 'Create Ruleset')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

