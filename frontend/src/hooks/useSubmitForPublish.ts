/**
 * useSubmitForPublish Hook
 * Phase 8: Submit entities for publish review
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { ApiErrorCode } from '@shared';

export type EntityType = 'world' | 'story' | 'npc';

interface SubmitForPublishResponse {
  submitted: boolean;
  world?: any;
  story?: any;
  npc?: any;
}

interface ErrorResponse {
  code: string;
  message: string;
  details?: {
    fieldsMissing?: string[];
    dependencyErrors?: string[];
    mediaErrors?: any[];
    currentStatus?: string;
  };
}

/**
 * Map error codes to user-friendly messages
 */
function getErrorMessage(error: any): string {
  const errorData = error?.response?.data as ErrorResponse | undefined;
  const code = errorData?.code || error?.code;

  switch (code) {
    case 'QUOTA_EXCEEDED':
      return "You've reached your limit for this type.";
    case 'ALREADY_IN_REVIEW':
      return 'Already under review.';
    case 'ALREADY_PUBLISHED':
      return 'Already published.';
    case 'VALIDATION_FAILED': {
      const details = errorData?.details;
      if (details?.fieldsMissing && details.fieldsMissing.length > 0) {
        return `Missing required fields: ${details.fieldsMissing.join(', ')}`;
      }
      if (details?.dependencyErrors && details.dependencyErrors.length > 0) {
        return 'Dependencies are not ready. Please check your world and ruleset assignments.';
      }
      if (details?.mediaErrors && details.mediaErrors.length > 0) {
        return details.mediaErrors[0].message || 'Media validation failed.';
      }
      return errorData?.message || 'Validation failed. Please check your content.';
    }
    default:
      return errorData?.message || error?.message || 'Failed to submit for review.';
  }
}

export function useSubmitForPublish(entityType: EntityType) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (entityId: string): Promise<SubmitForPublishResponse> => {
      // Map entityType to endpoint
      const endpoint = `/api/${entityType === 'story' ? 'stories' : `${entityType}s`}/${entityId}/submit-for-publish`;
      
      const result = await apiPost<SubmitForPublishResponse>(endpoint, {});
      
      if (!result.ok) {
        const error: any = new Error(result.error?.message || 'Failed to submit for publish');
        error.code = result.error?.code;
        error.response = {
          data: {
            code: result.error?.code,
            message: result.error?.message,
            details: result.error?.details,
          },
        };
        throw error;
      }

      return result.data;
    },
    onSuccess: () => {
      // Refetch the relevant My* list
      const queryKey = entityType === 'story' ? 'myStories' : entityType === 'world' ? 'myWorlds' : 'myNpcs';
      queryClient.invalidateQueries({ queryKey: [queryKey] });

      // Show success toast
      toast.success('Submitted for review.');
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      toast.error(message);
    },
  });

  return {
    submit: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

