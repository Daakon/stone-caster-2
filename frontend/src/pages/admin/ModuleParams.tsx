/**
 * Module Params Page
 * Edit module parameters for a story
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAppRoles } from '@/admin/routeGuard';
import { ParamsEditor } from '@/components/admin/ParamsEditor';

interface Module {
  id: string;
  title: string;
  version: number;
  params?: {
    schema?: string;
    defaults?: Record<string, unknown>;
    presets?: Array<{
      id: string;
      label: string;
      overrides: Record<string, unknown>;
    }>;
  };
}

interface StoryModule {
  module_id: string;
  params: Record<string, unknown> | null;
  modules: Module;
}

export default function ModuleParams() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor, isAdmin } = useAppRoles();
  const canEdit = isEditor || isAdmin;

  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch attached modules with params
  const { data: storyModules, isLoading } = useQuery({
    queryKey: ['admin', 'story-modules', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/stories/${id}/modules`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      return res.data as Module[];
    },
    enabled: !!id,
  });

  // Fetch module detail for params schema
  const { data: moduleDetail } = useQuery({
    queryKey: ['admin', 'module', selectedModuleId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/modules/${selectedModuleId}`);
      if (!res.ok) throw new Error('Failed to fetch module');
      return res.data as Module & { paramsDef?: { schema?: string; defaults?: Record<string, unknown>; presets?: Array<{ id: string; label: string; overrides: Record<string, unknown> }> } };
    },
    enabled: !!selectedModuleId,
  });

  // Get current params for selected module from story_modules
  const selectedModule = storyModules?.find(m => m.id === selectedModuleId);

  // Fetch current params for selected module
  const { data: currentParams } = useQuery({
    queryKey: ['admin', 'story-module-params', id, selectedModuleId],
    queryFn: async () => {
      // Get from story_modules
      const res = await api.get(`/api/admin/stories/${id}/modules`);
      if (!res.ok) return null;
      const modules = res.data as Module[];
      const module = modules.find(m => m.id === selectedModuleId);
      // Params are stored in story_modules, not in module detail
      // We'll need to fetch them separately or include in the modules list
      return null; // TODO: Fetch actual params from story_modules
    },
    enabled: !!selectedModuleId && !!id,
  });

  const saveMutation = useMutation({
    mutationFn: async (paramsToSave: Record<string, unknown>) => {
      const res = await api.patch(`/api/admin/stories/${id}/modules/${selectedModuleId}`, {
        params: paramsToSave,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to save params');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', id] });
      toast.success('Params saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save params');
    },
  });

  const handleSave = () => {
    // Client-side validation would go here
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    saveMutation.mutate(params);
  };

  // Initialize params when module selected
  useEffect(() => {
    if (selectedModuleId) {
      // Use story params if present, otherwise use defaults
      if (selectedModule?.params) {
        setParams(selectedModule.params);
      } else if (moduleDetail?.paramsDef?.defaults) {
        setParams(moduleDetail.paramsDef.defaults);
      }
    }
  }, [selectedModuleId, selectedModule, moduleDetail]);

  if (isLoading) {
    return <div className="p-6">Loading modules...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/admin/stories/${id}/modules`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Module Parameters</h1>
          <p className="text-muted-foreground">Configure module parameters for story {id}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Module</CardTitle>
          <CardDescription>Choose a module to configure its parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a module..." />
            </SelectTrigger>
            <SelectContent>
              {storyModules?.map(module => (
                <SelectItem key={module.id} value={module.id}>
                  {module.title} (v{module.version})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedModuleId && moduleDetail && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{moduleDetail.title} Parameters</CardTitle>
                <CardDescription>
                  Configure parameters for {moduleDetail.id}
                </CardDescription>
              </div>
              {canEdit && (
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {moduleDetail.paramsDef ? (
              <ParamsEditor
                schema={moduleDetail.paramsDef.schema}
                defaults={moduleDetail.paramsDef.defaults || {}}
                presets={moduleDetail.paramsDef.presets || []}
                value={params}
                onChange={setParams}
                errors={errors}
              />
            ) : (
              <div className="text-muted-foreground">
                This module has no configurable parameters.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

