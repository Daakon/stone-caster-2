/**
 * Story Settings Admin Page
 * Manage templates_version pinning for games/stories
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2, Package, RotateCcw, Info, History, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TemplatesVersionSelect } from '@/components/admin/TemplatesVersionSelect';
import { ParamsEditor } from '@/components/admin/ParamsEditor';
import { PromptAuthoringSection } from '@/components/admin/prompt-authoring/PromptAuthoringSection';
import { ContextChips } from '@/components/admin/prompt-authoring/ContextChips';
import { isAdminPromptFormsEnabled } from '@/lib/feature-flags';
import { trackAdminEvent } from '@/lib/admin-telemetry';
import { useAppRoles } from '@/admin/routeGuard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Module {
  id: string;
  title: string;
  version: number;
  params?: Record<string, unknown> | null;
  exports?: {
    actions?: Array<{ type: string }>;
  };
}

interface ModuleDetail extends Module {
  paramsDef?: {
    schema?: string;
    defaults?: Record<string, unknown>;
    presets?: Array<{
      id: string;
      label: string;
      overrides: Record<string, unknown>;
    }>;
  };
}

export default function StorySettings() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor, isAdmin } = useAppRoles();
  const canEdit = isEditor || isAdmin;
  const [templatesVersion, setTemplatesVersion] = useState<number | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [moduleParams, setModuleParams] = useState<Record<string, Record<string, unknown>>>({});
  const [savedModuleParams, setSavedModuleParams] = useState<Record<string, Record<string, unknown>>>({});
  const [paramsErrors, setParamsErrors] = useState<Record<string, Record<string, string>>>({});
  const [selectedLoadoutId, setSelectedLoadoutId] = useState<string>('');

  // Fetch game
  const { data: game, isLoading } = useQuery({
    queryKey: ['admin', 'games', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      // Assuming there's a GET /api/admin/games/:id endpoint
      const res = await api.get(`/api/admin/games/${gameId}`);
      if (!res.ok) throw new Error('Failed to fetch game');
      return res.data as {
        id: string;
        templates_version?: number | null;
        world_id?: string;
        [key: string]: any;
      };
    },
    enabled: !!gameId,
    onSuccess: (data) => {
      setTemplatesVersion(data.templates_version ?? null);
    },
  });

  // Fetch story modules with params
  const { data: storyModules, isLoading: loadingModules } = useQuery({
    queryKey: ['admin', 'story-modules', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      const res = await api.get(`/api/admin/stories/${gameId}/modules`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      const modules = res.data as Module[];
      // Initialize params state
      const paramsMap: Record<string, Record<string, unknown>> = {};
      const savedMap: Record<string, Record<string, unknown>> = {};
      modules.forEach(module => {
        const params = module.params || {};
        paramsMap[module.id] = params;
        savedMap[module.id] = { ...params }; // Deep copy for comparison
      });
      setModuleParams(paramsMap);
      setSavedModuleParams(savedMap);
      return modules;
    },
    enabled: !!gameId && isAdminPromptFormsEnabled(),
  });

  // Fetch module detail for selected module
  const { data: moduleDetail } = useQuery({
    queryKey: ['admin', 'module', selectedModuleId],
    queryFn: async () => {
      if (!selectedModuleId) return null;
      const res = await api.get(`/api/admin/modules/${selectedModuleId}`);
      if (!res.ok) throw new Error('Failed to fetch module');
      return res.data as ModuleDetail;
    },
    enabled: !!selectedModuleId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (version: number | null) => {
      if (!gameId) throw new Error('Game ID required');
      const res = await api.patch(`/api/admin/games/${gameId}`, {
        templates_version: version,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to update game');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Templates version updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'games', gameId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update game');
    },
  });

  // Save params mutation
  const saveParamsMutation = useMutation({
    mutationFn: async ({ moduleId, params }: { moduleId: string; params: Record<string, unknown> }) => {
      if (!gameId) throw new Error('Game ID required');
      const res = await api.patch(`/api/admin/stories/${gameId}/modules/${moduleId}`, { params });
      if (!res.ok) throw new Error(res.error || 'Failed to save params');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', gameId] });
      // Update saved params snapshot
      setSavedModuleParams(prev => ({
        ...prev,
        [variables.moduleId]: { ...moduleParams[variables.moduleId] },
      }));
      
      // Show diff summary
      const changedModules = [variables.moduleId];
      toast.success(`Params saved for ${changedModules.length} module(s)`, {
        description: `Module: ${storyModules?.find(m => m.id === variables.moduleId)?.title || variables.moduleId}`,
      });
      
      trackAdminEvent('story.params.saved', {
        storyId: gameId,
        moduleId: variables.moduleId,
        moduleCount: storyModules?.length || 0,
        changedModules,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save params');
      trackAdminEvent('story.params.save.failed', {
        storyId: gameId,
        moduleCount: storyModules?.length || 0,
      });
    },
  });

  // Apply loadout mutation
  const applyLoadoutMutation = useMutation({
    mutationFn: async (loadoutId: string) => {
      if (!gameId) throw new Error('Game ID required');
      const res = await api.post(`/api/admin/stories/${gameId}/apply-loadout`, { loadoutId });
      if (!res.ok) throw new Error(res.error || 'Failed to apply loadout');
      return res.data;
    },
    onSuccess: (data, loadoutId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', gameId] });
      // Show diff summary
      const selectedLoadout = loadouts?.find(l => l.id === loadoutId);
      const attachedModules = selectedLoadout?.modules || [];
      toast.success('Loadout applied successfully', {
        description: `${attachedModules.length} module(s) attached with preset params`,
      });
      trackAdminEvent('story.loadout.applied', {
        storyId: gameId,
        loadoutId,
        moduleCount: storyModules?.length || 0,
        changedModules: attachedModules,
        presetIds: Object.keys(selectedLoadout?.overrides || {}),
      });
    },
    onError: (error: Error, loadoutId) => {
      toast.error(error.message || 'Failed to apply loadout');
      trackAdminEvent('story.loadout.failed', {
        storyId: gameId,
        loadoutId,
        error: error.message,
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(templatesVersion ?? null);
  };

  const handleSaveParams = (moduleId: string) => {
    const params = moduleParams[moduleId];
    if (!params) return;
    
    // Size guard warning
    const paramsSize = JSON.stringify(params).length;
    if (paramsSize > 7000) {
      toast.warning(`Params size is ${paramsSize} bytes (approaching 8KB limit)`);
    }
    
    saveParamsMutation.mutate({ moduleId, params });
  };

  const handleResetParams = (moduleId: string) => {
    if (!moduleDetail?.paramsDef?.defaults) return;
    setModuleParams(prev => ({
      ...prev,
      [moduleId]: { ...moduleDetail.paramsDef!.defaults! },
    }));
    trackAdminEvent('story.params.reset', {
      storyId: gameId,
      moduleId,
    });
  };

  // Fetch loadouts
  const { data: loadouts } = useQuery({
    queryKey: ['admin', 'loadouts'],
    queryFn: async () => {
      const res = await api.get('/api/admin/loadouts');
      if (!res.ok) throw new Error('Failed to fetch loadouts');
      return res.data as Array<{
        id: string;
        title: string;
        ruleset_id: string;
        modules: string[];
        overrides?: Record<string, { params?: Record<string, unknown> }>;
      }>;
    },
  });

  // Check for unsaved params changes
  const hasUnsavedParams = useMemo(() => {
    return Object.keys(moduleParams).some(moduleId => {
      const current = JSON.stringify(moduleParams[moduleId] || {});
      const saved = JSON.stringify(savedModuleParams[moduleId] || {});
      return current !== saved;
    });
  }, [moduleParams, savedModuleParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    trackAdminEvent('story.tabs.changed', { tab, storyId: gameId });
  };

  const handleApplyLoadout = (loadoutId: string) => {
    applyLoadoutMutation.mutate(loadoutId);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!game) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Game not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/admin')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Story Settings</h1>
          <p className="text-muted-foreground">
            Game ID: {gameId}
          </p>
        </div>
        <Button onClick={() => navigate('/admin')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" role="tab" aria-controls="overview-panel">Overview</TabsTrigger>
          <TabsTrigger value="params" role="tab" aria-controls="params-panel">
            Module Params
            {hasUnsavedParams && <span className="ml-1 text-xs">•</span>}
          </TabsTrigger>
          <TabsTrigger value="loadouts" role="tab" aria-controls="loadouts-panel">Loadouts</TabsTrigger>
          <TabsTrigger value="history" role="tab" aria-controls="history-panel">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" id="overview-panel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates Version Pinning</CardTitle>
              <CardDescription>
                Pin a specific templates version for this story, or use "Latest Published" to auto-update
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TemplatesVersionSelect
                value={templatesVersion}
                onChange={setTemplatesVersion}
                gameId={gameId}
              />

              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
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
            </CardContent>
          </Card>

          {isAdminPromptFormsEnabled() && (
            <Card>
              <CardHeader>
                <CardTitle>Prompt Authoring (Preview)</CardTitle>
                <CardDescription>
                  Preview and analyze the prompt that will be generated for this story
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <ContextChips
                    context={{
                      worldId: game?.world_id,
                      templatesVersion: templatesVersion || undefined,
                    }}
                    showTemplatesLink={true}
                  />
                </div>
                <PromptAuthoringSection
                  initialContext={{
                    worldId: game?.world_id,
                    templatesVersion: templatesVersion || undefined,
                  }}
                  storyId={gameId}
                  onResult={async (result) => {
                    const contextFlags = {
                      hasWorld: !!game?.world_id,
                      hasRuleset: false,
                      hasScenario: false,
                      npcCount: 0,
                      templatesVersion: templatesVersion || undefined,
                    };

                    if (!result.data) {
                      if (result.type === 'preview') {
                        await trackAdminEvent('story.promptAuthoring.preview.failed', {
                          storyId: gameId,
                          ...contextFlags,
                        });
                      } else if (result.type === 'budget') {
                        await trackAdminEvent('story.promptAuthoring.budget.failed', {
                          storyId: gameId,
                          ...contextFlags,
                        });
                      }
                      return;
                    }

                    if (result.type === 'preview') {
                      await trackAdminEvent('story.promptAuthoring.preview.success', {
                        storyId: gameId,
                        ...contextFlags,
                      });
                    } else if (result.type === 'budget') {
                      await trackAdminEvent('story.promptAuthoring.budget.success', {
                        storyId: gameId,
                        ...contextFlags,
                        tokensBefore: result.data?.tokens?.before,
                        tokensAfter: result.data?.tokens?.after,
                      });
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="params" id="params-panel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Module Parameters</CardTitle>
              <CardDescription>
                Configure parameters for attached modules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingModules ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading modules...</p>
                </div>
              ) : storyModules && storyModules.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Module</label>
                    <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a module..." />
                      </SelectTrigger>
                      <SelectContent>
                        {storyModules.map(module => (
                          <SelectItem key={module.id} value={module.id}>
                            {module.title} (v{module.version})
                            {module.exports?.actions && module.exports.actions.length > 0 && (
                              <Badge variant="outline" className="ml-2">
                                {module.exports.actions.length} actions
                              </Badge>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedModuleId && moduleDetail && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{moduleDetail.title} Parameters</h3>
                          <p className="text-sm text-muted-foreground">
                            Configure parameters for {moduleDetail.id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {moduleDetail.paramsDef?.defaults && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetParams(selectedModuleId)}
                              disabled={!canEdit}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset to defaults
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              onClick={() => handleSaveParams(selectedModuleId)}
                              disabled={saveParamsMutation.isPending}
                              size="sm"
                            >
                              {saveParamsMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Params
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const paramsSize = JSON.stringify(moduleParams[selectedModuleId] || {}).length;
                        if (paramsSize > 7000) {
                          return (
                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Size warning:</strong> Params are {paramsSize} bytes (approaching 8KB limit).
                                Preview works with overrides, but saving may be blocked if limits are exceeded.
                              </AlertDescription>
                            </Alert>
                          );
                        }
                        return null;
                      })()}

                      {moduleDetail.paramsDef ? (
                        <ParamsEditor
                          schema={moduleDetail.paramsDef.schema}
                          defaults={moduleDetail.paramsDef.defaults || {}}
                          presets={moduleDetail.paramsDef.presets || []}
                          value={moduleParams[selectedModuleId] || {}}
                          onChange={(value) => {
                            setModuleParams(prev => ({
                              ...prev,
                              [selectedModuleId]: value,
                            }));
                          }}
                          errors={paramsErrors[selectedModuleId] || {}}
                        />
                      ) : (
                        <div className="text-muted-foreground">
                          This module has no configurable parameters.
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No modules attached to this story.</p>
                  <p className="text-sm mt-1">
                    <Button
                      variant="link"
                      onClick={() => navigate(`/admin/stories/${gameId}/modules`)}
                      className="p-0 h-auto"
                    >
                      Attach modules
                    </Button>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loadouts" id="loadouts-panel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Apply Loadout</CardTitle>
              <CardDescription>
                Apply a preset loadout (ruleset + modules + param overrides) to this story
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canEdit && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    You need editor role or higher to apply loadouts
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Loadout</label>
                <Select
                  value={selectedLoadoutId}
                  onValueChange={setSelectedLoadoutId}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a loadout..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loadouts?.map(loadout => (
                      <SelectItem key={loadout.id} value={loadout.id}>
                        {loadout.title} ({loadout.modules.length} modules)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedLoadoutId && (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleApplyLoadout(selectedLoadoutId)}
                    disabled={!canEdit || applyLoadoutMutation.isPending}
                    className="w-full"
                  >
                    {applyLoadoutMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        Apply Loadout
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" id="history-panel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot History</CardTitle>
              <CardDescription>
                View prompt snapshot history for this story
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/prompt-snapshots?gameId=${gameId}`)}
                asChild
              >
                <Link to={`/admin/prompt-snapshots?gameId=${gameId}`}>
                  <History className="h-4 w-4 mr-2" />
                  View All Snapshots
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

