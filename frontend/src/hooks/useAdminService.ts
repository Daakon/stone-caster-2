import { useCallback } from 'react';
import { useAdminRole } from './useAdminRole';
import { adminService, type CreatePromptData, type UpdatePromptData, type PromptFilters } from '@/services/adminService';
import { toast } from 'sonner';

export function useAdminService() {
  const { isAdmin, isLoading } = useAdminRole();

  const guardedCall = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> => {
    if (!isAdmin) {
      toast.error(`Access denied: ${operationName} requires admin role`);
      return null;
    }

    try {
      return await operation();
    } catch (error) {

      toast.error(`Failed to ${operationName.toLowerCase()}`);
      throw error;
    }
  }, [isAdmin]);

  const getPrompts = useCallback(async (filters?: PromptFilters) => {
    return guardedCall(
      () => adminService.getPrompts(filters),
      'fetch prompts'
    );
  }, [guardedCall]);

  const getPrompt = useCallback(async (id: string) => {
    return guardedCall(
      () => adminService.getPrompt(id),
      'fetch prompt'
    );
  }, [guardedCall]);

  const createPrompt = useCallback(async (data: CreatePromptData) => {
    return guardedCall(
      () => adminService.createPrompt(data),
      'create prompt'
    );
  }, [guardedCall]);

  const updatePrompt = useCallback(async (id: string, data: UpdatePromptData) => {
    return guardedCall(
      () => adminService.updatePrompt(id, data),
      'update prompt'
    );
  }, [guardedCall]);

  const deletePrompt = useCallback(async (id: string) => {
    return guardedCall(
      () => adminService.deletePrompt(id),
      'delete prompt'
    );
  }, [guardedCall]);

  const togglePromptActive = useCallback(async (id: string) => {
    return guardedCall(
      () => adminService.togglePromptActive(id),
      'toggle prompt active status'
    );
  }, [guardedCall]);

  const togglePromptLocked = useCallback(async (id: string) => {
    return guardedCall(
      () => adminService.togglePromptLocked(id),
      'toggle prompt locked status'
    );
  }, [guardedCall]);

  const getPromptStats = useCallback(async () => {
    return guardedCall(
      () => adminService.getPromptStats(),
      'fetch prompt statistics'
    );
  }, [guardedCall]);

  const validateDependencies = useCallback(async () => {
    return guardedCall(
      () => adminService.validateDependencies(),
      'validate dependencies'
    );
  }, [guardedCall]);

  const bulkOperation = useCallback(async (action: string, promptIds: string[]) => {
    return guardedCall(
      () => adminService.bulkOperation(action, promptIds),
      'perform bulk operation'
    );
  }, [guardedCall]);

  return {
    isAdmin,
    isLoading,
    getPrompts,
    getPrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
    togglePromptActive,
    togglePromptLocked,
    getPromptStats,
    validateDependencies,
    bulkOperation,
    formatJsonForDisplay: adminService.formatJsonForDisplay,
    minifyJsonForStorage: adminService.minifyJsonForStorage,
    parseJsonFromStorage: adminService.parseJsonFromStorage
  };
}
