/**
 * Chimera World Editor
 * Create or edit worlds
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraWorldsService, type CreateWorldData } from '@/services/chimera.worlds';
import { WorldForm } from '@/components/editors/WorldForm';

export default function WorldEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing world if editing
  const { data: existingWorld, isLoading: isLoadingWorld } = useQuery({
    queryKey: ['chimera-world', id],
    queryFn: () => chimeraWorldsService.getWorld(id!),
    enabled: isEditing && !!id,
  });

  // Transform existing world to form data format
  const initialFormData = existingWorld ? (() => {
    const worldTags = (existingWorld as any).tags;
    const tagsArray = Array.isArray(worldTags) 
      ? worldTags.map((t: string | { tag_name: string }) => 
          typeof t === 'string' ? t : t.tag_name
        )
      : (existingWorld as any).tags?.map((t: { tag_name: string }) => t.tag_name) || [];
    
    let imagesArray: any[] = [];
    if ((existingWorld as any).images) {
      imagesArray = Array.isArray((existingWorld as any).images) 
        ? (existingWorld as any).images 
        : [];
    } else if ((existingWorld as any).definition?.images) {
      imagesArray = Array.isArray((existingWorld as any).definition.images)
        ? (existingWorld as any).definition.images
        : [];
    }
    
    return {
      display_name: existingWorld.display_name,
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

      if (isEditing && id) {
        await chimeraWorldsService.updateWorld(id, payload);
        toast.success('World updated successfully');
        await queryClient.invalidateQueries({ queryKey: ['chimera-world', id] });
      } else {
        await chimeraWorldsService.createWorld(payload);
        toast.success('World created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['chimera-my-worlds'] });
      navigate('/dashboard/creations/worlds');
    } catch (error) {
      console.error('Error saving world:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save world');
      throw error; // Re-throw so WorldForm can handle loading state
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

      <WorldForm
        initialData={initialFormData}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        onCancel={() => navigate('/dashboard/creations/worlds')}
        submitLabel={isEditing ? 'Update World' : 'Create World'}
      />
    </div>
  );
}

