/**
 * Admin Official World Editor Page
 * Create or edit official worlds (is_official = true)
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorldForm } from '@/components/editors/WorldForm';
import { makeTitle } from '@/lib/meta';
import { useEffect, useState } from 'react';
import type { CreateWorldData } from '@/services/chimera.worlds';
import { apiFetch, apiPost, apiPut } from '@/lib/api';

export default function WorldEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing world if editing (fetch full details from regular endpoint)
  const { data: existingWorld, isLoading: isLoadingWorld } = useQuery({
    queryKey: ['admin-official-world', id],
    queryFn: async () => {
      const result = await apiFetch<any>(`/api/chimera/worlds/${id}`);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch world');
      }
      return result.data || null;
    },
    enabled: isEditing && !!id,
  });

  useEffect(() => {
    document.title = makeTitle([
      isEditing ? 'Edit Official World' : 'Create Official World',
      'Admin'
    ]);
  }, [isEditing]);

  // Transform existing world to form data format
  const initialFormData = existingWorld ? (() => {
    const worldTags = existingWorld.tags || [];
    const tagsArray = Array.isArray(worldTags)
      ? worldTags.map((t: string | { tag_name: string }) =>
          typeof t === 'string' ? t : t.tag_name
        )
      : [];

    let imagesArray: any[] = [];
    if (existingWorld.images) {
      imagesArray = Array.isArray(existingWorld.images) ? existingWorld.images : [];
    } else if (existingWorld.definition?.images) {
      imagesArray = Array.isArray(existingWorld.definition.images)
        ? existingWorld.definition.images
        : [];
    }

    return {
      display_name: existingWorld.display_name || existingWorld.name,
      description_short: existingWorld.description_short,
      description_long: existingWorld.description_long,
      character_schema_contributions: existingWorld.character_schema_contributions || {},
      ruleset_template_ids: existingWorld.ruleset_links?.map(
        (link: { ruleset_template_id: string }) => link.ruleset_template_id
      ) || [],
      tag_names: tagsArray,
      tags: tagsArray,
      images: imagesArray,
    };
  })() : undefined;

  const handleSubmit = async (data: CreateWorldData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        tags: data.tag_names || data.tags || [],
      };

      let result;
      if (isEditing && id) {
        result = await apiPut<any>(`/api/v2/chimera/admin/worlds/${id}`, payload);
      } else {
        result = await apiPost<any>('/api/v2/chimera/admin/worlds', payload);
      }

      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to save world');
      }
      
      if (isEditing) {
        toast.success('Official world updated successfully');
        await queryClient.invalidateQueries({ queryKey: ['admin-official-world', id] });
      } else {
        toast.success('Official world created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-official-worlds'] });
      navigate('/admin/chimera/worlds/list');
    } catch (error) {
      console.error('Error saving world:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save world');
      throw error;
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/chimera/worlds/list')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Official World' : 'Create Official World'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing
              ? 'Update official world details (will remain visible to all users)'
              : 'Create a new official Stone Caster world (will be visible to all users)'}
          </p>
        </div>
      </div>

      <WorldForm
        initialData={initialFormData as any}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        isOfficialMode={true}
        onCancel={() => navigate('/admin/chimera/worlds/list')}
        submitLabel={isEditing ? 'Update Official World' : 'Create Official World'}
      />
    </div>
  );
}
