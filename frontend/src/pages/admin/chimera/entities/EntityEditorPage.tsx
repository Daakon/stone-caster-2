/**
 * Admin Official Entity Editor Page
 * Create or edit official entities (is_official = true)
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EntityForm } from '@/components/editors/EntityForm';
import { makeTitle } from '@/lib/meta';
import { useEffect, useState } from 'react';
import type { CreateEntityData } from '@/services/chimera.entities';
import { apiFetch, apiPost, apiPut } from '@/lib/api';

export default function EntityEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing entity if editing (fetch from admin endpoint)
  const { data: existingEntity, isLoading: isLoadingEntity } = useQuery({
    queryKey: ['admin-official-entity', id],
    queryFn: async () => {
      // Use admin endpoint for official entities
      const result = await apiFetch<any>(`/api/v2/chimera/admin/entities-official/${id}`);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch entity');
      }
      return result.data || null;
    },
    enabled: isEditing && !!id,
  });

  useEffect(() => {
    document.title = makeTitle([
      isEditing ? 'Edit Official Entity' : 'Create Official Entity',
      'Admin'
    ]);
  }, [isEditing]);

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
      let result;
      if (isEditing && id) {
        result = await apiPut<any>(`/api/v2/chimera/admin/entities-official/${id}`, data);
      } else {
        result = await apiPost<any>('/api/v2/chimera/admin/entities-official', data);
      }

      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to save entity');
      }
      
      if (isEditing) {
        toast.success('Official entity updated successfully');
        await queryClient.invalidateQueries({ queryKey: ['admin-official-entity', id] });
      } else {
        toast.success('Official entity created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-official-entities'] });
      navigate('/admin/chimera/entities/list');
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/chimera/entities/list')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Official Entity' : 'Create Official Entity'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing
              ? 'Update official entity details (will remain visible to all users)'
              : 'Create a new official Stone Caster entity (will be visible to all users)'}
          </p>
        </div>
      </div>

      <EntityForm
        initialData={initialFormData}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        isOfficialMode={true}
        onCancel={() => navigate('/admin/chimera/entities/list')}
        submitLabel={isEditing ? 'Update Official Entity' : 'Create Official Entity'}
      />
    </div>
  );
}
