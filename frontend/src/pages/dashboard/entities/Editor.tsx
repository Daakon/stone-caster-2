/**
 * Chimera Entity Editor
 * Create or edit entity templates
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraEntitiesService, type CreateEntityData, type UpdateEntityData } from '@/services/chimera.entities';
import { EntityForm } from '@/components/editors/EntityForm';

export default function EntityEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing entity if editing
  const { data: existingEntity, isLoading: isLoadingEntity } = useQuery({
    queryKey: ['chimera-entity', id],
    queryFn: () => chimeraEntitiesService.getEntity(id!),
    enabled: isEditing && !!id,
  });

  // Transform existing entity to form data format
  // Extract from raw_data JSONB structure (Hybrid Schema pattern)
  const initialFormData = existingEntity ? {
    display_name: existingEntity.display_name || existingEntity.raw_data?.display_name || '',
    description_short: existingEntity.description_short ?? existingEntity.raw_data?.description_short ?? null,
    entity_type: existingEntity.entity_type || existingEntity.raw_data?.entity_type || 'NPC',
    base_state_json: existingEntity.raw_data?.base_state_json || existingEntity.base_state_json || {},
    tag_names: (existingEntity as any).tags?.map((t: { tag_name: string }) => t.tag_name) || [],
    images: existingEntity.raw_data?.images || [],
  } : undefined;

  const handleSubmit = async (data: CreateEntityData) => {
    setIsSubmitting(true);
    try {
      if (isEditing && id) {
        const updateData: UpdateEntityData = { ...data };
        await chimeraEntitiesService.updateEntity(id, updateData);
        toast.success('Entity updated successfully');
      } else {
        await chimeraEntitiesService.createEntity(data);
        toast.success('Entity created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['chimera-my-entities'] });
      navigate('/dashboard/creations/entities');
    } catch (error) {
      console.error('Error saving entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save entity');
      throw error;
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

      <EntityForm
        initialData={initialFormData}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        onCancel={() => navigate('/dashboard/creations/entities')}
        submitLabel={isEditing ? 'Update Entity' : 'Create Entity'}
      />
    </div>
  );
}

