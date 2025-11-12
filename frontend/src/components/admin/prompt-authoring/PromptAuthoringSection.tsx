/**
 * Prompt Authoring Section
 * Reusable component for authoring prompts with extras and module params
 * Phase 1: Preview and Budget dry-run
 */

import { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { worldsService } from '@/services/admin.worlds';
import { rulesetsService } from '@/services/admin.rulesets';
import { ExtrasForm } from '@/components/admin/ExtrasForm';
import { ParamsEditor } from '@/components/admin/ParamsEditor';
import { ActionsBar } from './ActionsBar';
import { ResultPane } from './ResultPane';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Loader2, Info } from 'lucide-react';
import { useAppRoles } from '@/admin/routeGuard';
import { trackAdminEvent } from '@/lib/admin-telemetry';

export interface PromptAuthoringContext {
  gameId?: string;
  worldId?: string;
  rulesetId?: string;
  scenarioId?: string;
  npcIds?: string[];
  templatesVersion?: number;
}

export interface PromptAuthoringSectionProps {
  /** Initial context values */
  initialContext?: PromptAuthoringContext;
  /** Story ID (for fetching modules) */
  storyId?: string;
  /** Initial extras overrides (e.g., { npcs: { [npcId]: npc.extras } }) */
  initialExtrasOverrides?: {
    world?: Record<string, unknown>;
    ruleset?: Record<string, unknown>;
    scenario?: Record<string, unknown>;
    npcs?: Record<string, Record<string, unknown>>;
  };
  /** Callback when preview/budget is generated */
  onResult?: (result: {
    type: 'preview' | 'budget';
    data: any;
  }) => void;
  /** Callback to clear overrides (for Prompt Builder) */
  onClearOverrides?: () => void;
}

export interface PromptAuthoringSectionRef {
  clearOverrides: () => void;
}

interface PreviewResult {
  tp: any;
  linearized: string;
  warnings: string[];
  errors: string[];
  tokens?: {
    before: number;
    after?: number;
    trimPlan?: Array<{ key: string; removedTokens: number }>;
  };
}

interface BudgetResult {
  tokens: {
    before: number;
    after: number;
  };
  trims: Array<{ key: string; removedChars: number; removedTokens: number }>;
  warnings: string[];
  sections: Array<{
    key: string;
    tokensBefore: number;
    tokensAfter: number;
    trimmed: boolean;
  }>;
}

export const PromptAuthoringSection = forwardRef<PromptAuthoringSectionRef, PromptAuthoringSectionProps>(({
  initialContext = {},
  storyId,
  initialExtrasOverrides = {},
  onResult,
  onClearOverrides,
}, ref) => {
  // Context state
  const [context, setContext] = useState<PromptAuthoringContext>({
    worldId: '',
    rulesetId: '',
    scenarioId: '',
    npcIds: [],
    templatesVersion: undefined,
    ...initialContext,
  });

  // Extras overrides (keyed by pack type)
  const [extrasOverrides, setExtrasOverrides] = useState<{
    world?: Record<string, unknown>;
    ruleset?: Record<string, unknown>;
    scenario?: Record<string, unknown>;
    npcs?: Record<string, Record<string, unknown>>;
  }>(initialExtrasOverrides);

  // Track initial extras for unsaved changes detection
  const [initialExtrasSnapshot, setInitialExtrasSnapshot] = useState<{
    world?: Record<string, unknown>;
    ruleset?: Record<string, unknown>;
    scenario?: Record<string, unknown>;
    npcs?: Record<string, Record<string, unknown>>;
  }>(initialExtrasOverrides);

  // Module params overrides (keyed by module ID)
  const [moduleParamsOverrides, setModuleParamsOverrides] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // Module params (for storyId context - will be saved)
  const [moduleParams, setModuleParams] = useState<Record<string, Record<string, unknown>>>({});
  const [savedModuleParams, setSavedModuleParams] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const queryClient = useQueryClient();
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const canEditParams = isCreator || isModerator || isAdmin;

  // Fetch story modules when storyId is selected
  const { data: storyModules } = useQuery({
    queryKey: ['admin', 'story-modules', storyId],
    queryFn: async () => {
      if (!storyId) return [];
      const res = await api.get(`/api/admin/stories/${storyId}/modules`);
      if (!res.ok) return [];
      const modules = res.data as Array<{
        id: string;
        title: string;
        version: number;
        params?: Record<string, unknown> | null;
        exports?: { actions?: Array<{ type: string }> };
      }>;
      const paramsMap: Record<string, Record<string, unknown>> = {};
      const savedMap: Record<string, Record<string, unknown>> = {};
      modules.forEach(module => {
        const params = module.params || {};
        paramsMap[module.id] = params;
        savedMap[module.id] = { ...params };
      });
      setModuleParams(paramsMap);
      setSavedModuleParams(savedMap);
      return modules;
    },
    enabled: !!storyId,
  });

  // Fetch module detail for selected module
  const { data: moduleDetail } = useQuery({
    queryKey: ['admin', 'module', selectedModuleId],
    queryFn: async () => {
      if (!selectedModuleId) return null;
      const res = await api.get(`/api/admin/modules/${selectedModuleId}`);
      if (!res.ok) throw new Error('Failed to fetch module');
      return res.data as any; // ModuleDetail type
    },
    enabled: !!selectedModuleId,
  });

  // Save params mutation
  const saveParamsMutation = useMutation({
    mutationFn: async ({ moduleId, params }: { moduleId: string; params: Record<string, unknown> }) => {
      if (!storyId) throw new Error('Story ID required');
      const res = await api.patch(`/api/admin/stories/${storyId}/modules/${moduleId}`, { params });
      if (!res.ok) {
        const errorMsg = typeof res.error === 'string' ? res.error : (res.error as any)?.message || 'Failed to save params';
        throw new Error(errorMsg);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'story-modules', storyId] });
      setSavedModuleParams(prev => ({
        ...prev,
        [variables.moduleId]: { ...moduleParams[variables.moduleId] },
      }));
      toast.success('Params saved');
      trackAdminEvent('story.params.saved', {
        storyId: storyId!,
        moduleId: variables.moduleId,
        moduleCount: storyModules?.length || 0,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save params');
    },
  });

  const handleSaveParams = (moduleId: string) => {
    const params = moduleParams[moduleId];
    if (!params) return;
    saveParamsMutation.mutate({ moduleId, params });
  };

  const handleResetParams = (moduleId: string) => {
    if (!moduleDetail?.paramsDef?.defaults) return;
    setModuleParams(prev => ({
      ...prev,
      [moduleId]: { ...moduleDetail.paramsDef!.defaults! },
    }));
  };

  // Results
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [budgetResult, setBudgetResult] = useState<BudgetResult | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'budget'>('preview');

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        worldId: context.worldId,
        rulesetId: context.rulesetId,
        templatesVersion: context.templatesVersion,
        verbose: true,
      };

      if (context.scenarioId) payload.scenarioId = context.scenarioId;
      if (context.npcIds && context.npcIds.length > 0) payload.npcIds = context.npcIds;
      if (context.gameId) payload.gameId = context.gameId;

      // Add overrides if present
      if (Object.keys(extrasOverrides).length > 0) {
        payload.extrasOverrides = extrasOverrides;
      }
      // Use moduleParams when storyId is present, otherwise use moduleParamsOverrides
      const paramsToUse = storyId ? moduleParams : moduleParamsOverrides;
      if (Object.keys(paramsToUse).length > 0) {
        payload.moduleParamsOverrides = paramsToUse;
      }

      const res = await api.post('/api/admin/prompt-preview', payload);
      if (!res.ok) {
        // Handle 429 rate limit
        const errorStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
        if (errorStr.includes('429') || errorStr.includes('rate limit')) {
          throw new Error('Rate limit reached; try again shortly.');
        }
        // Extract validation messages if available
        const errorMsg = typeof res.error === 'string' ? res.error : (res.error as any)?.message || 'Failed to generate preview';
        throw new Error(errorMsg);
      }
      return res.data;
    },
    onSuccess: (data: any) => {
      // data is the response from the API, which has a nested structure
      const previewData = data.data || data;
      setPreviewResult(previewData);
      setActiveTab('preview');
      onResult?.({ type: 'preview', data: previewData });
      toast.success('Preview generated');
    },
    onError: (error: Error) => {
      onResult?.({ type: 'preview', data: null }); // Signal error to parent
      toast.error(error.message || 'Failed to generate preview');
    },
  });

  // Budget mutation
  const budgetMutation = useMutation({
    mutationFn: async (maxTokens?: number) => {
      const payload: any = {
        worldId: context.worldId,
        rulesetId: context.rulesetId,
        templatesVersion: context.templatesVersion,
      };

      if (context.scenarioId) payload.scenarioId = context.scenarioId;
      if (context.npcIds && context.npcIds.length > 0) payload.npcIds = context.npcIds;
      if (maxTokens) payload.maxTokens = maxTokens;

      // Add overrides if present
      if (Object.keys(extrasOverrides).length > 0) {
        payload.extrasOverrides = extrasOverrides;
      }
      // Use moduleParams when storyId is present, otherwise use moduleParamsOverrides
      const paramsToUse = storyId ? moduleParams : moduleParamsOverrides;
      if (Object.keys(paramsToUse).length > 0) {
        payload.moduleParamsOverrides = paramsToUse;
      }

      const res = await api.post('/api/admin/prompt-budget-report', payload);
      if (!res.ok) {
        // Handle 429 rate limit
        const errorStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
        if (errorStr.includes('429') || errorStr.includes('rate limit')) {
          throw new Error('Rate limit reached; try again shortly.');
        }
        // Extract validation messages if available
        const errorMsg = typeof res.error === 'string' ? res.error : (res.error as any)?.message || 'Failed to generate budget report';
        throw new Error(errorMsg);
      }
      return res.data;
    },
    onSuccess: (data: any) => {
      const budgetData = data.data || data;
      setBudgetResult(budgetData);
      setActiveTab('budget');
      onResult?.({ type: 'budget', data: budgetData });
      toast.success('Budget report generated');
    },
    onError: (error: Error) => {
      onResult?.({ type: 'budget', data: null }); // Signal error to parent
      
      // Handle rate limit errors
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        toast.error('Rate limit reached; try again shortly.');
      } else {
        // Standardize error rendering - show server validation messages
        const errorMessage = error.message || 'Failed to generate budget report';
        toast.error(errorMessage);
      }
    },
  });

  // Handle extras saved (ExtrasForm saves to DB, so we fetch after save)
  const handleExtrasSaved = async (packType: 'world' | 'ruleset' | 'scenario' | 'npc', packId: string) => {
    try {
      let extras: Record<string, unknown> | undefined;
      
      if (packType === 'world') {
        const world = await worldsService.getWorld(packId);
        extras = (world as any).extras;
      } else if (packType === 'ruleset') {
        const ruleset = await rulesetsService.getRuleset(packId);
        extras = (ruleset as any).extras;
      } else if (packType === 'scenario') {
        // Scenarios endpoint - use direct API call for now
        const res = await api.get(`/api/admin/scenarios/${packId}`);
        if (res.ok && (res.data as any)?.extras) {
          extras = (res.data as any).extras;
        }
      } else if (packType === 'npc') {
        const { npcsService } = await import('@/services/admin.npcs');
        const npc = await npcsService.getNPC(packId);
        extras = (npc as any).extras;
      }

      if (extras) {
        if (packType === 'npc') {
          setExtrasOverrides(prev => ({
            ...prev,
            npcs: {
              ...prev.npcs,
              [packId]: extras,
            },
          }));
          // Update initial snapshot after save
          setInitialExtrasSnapshot(prev => ({
            ...prev,
            npcs: {
              ...prev.npcs,
              [packId]: extras,
            },
          }));
        } else {
          setExtrasOverrides(prev => ({
            ...prev,
            [packType]: extras,
          }));
          // Update initial snapshot after save
          setInitialExtrasSnapshot(prev => ({
            ...prev,
            [packType]: extras,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch saved extras:', error);
    }
  };

  const handleModuleParamsChange = (moduleId: string, params: Record<string, unknown>) => {
    if (storyId) {
      // When storyId is present, use moduleParams (will be saved)
      setModuleParams(prev => ({
        ...prev,
        [moduleId]: params,
      }));
    } else {
      // Otherwise, use moduleParamsOverrides (preview-only)
      setModuleParamsOverrides(prev => ({
        ...prev,
        [moduleId]: params,
      }));
    }
  };

  // Check for unsaved extras changes
  const extrasModified = useMemo(() => {
    return JSON.stringify(extrasOverrides) !== JSON.stringify(initialExtrasSnapshot);
  }, [extrasOverrides, initialExtrasSnapshot]);

  // Clear overrides function (Phase 7: Clear overrides button)
  const handleClearOverrides = () => {
    // Reset extras to initial values
    setExtrasOverrides(initialExtrasOverrides);
    setInitialExtrasSnapshot(initialExtrasOverrides);
    
    // Reset module params
    if (storyId) {
      // Reset to saved module params
      setModuleParams(savedModuleParams);
    } else {
      // Reset to empty
      setModuleParamsOverrides({});
    }
    
    // Clear results
    setPreviewResult(null);
    setBudgetResult(null);
    
    toast.success('Overrides cleared');
    
    if (onClearOverrides) {
      onClearOverrides();
    }
  };

  // Expose clearOverrides via ref (Phase 7)
  useImperativeHandle(ref, () => ({
    clearOverrides: handleClearOverrides,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel: Forms */}
      <div className="space-y-6">
        {/* Context Inputs */}
        <Card>
          <CardHeader>
            <CardTitle>Context</CardTitle>
            <CardDescription>Set the context for prompt generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="worldId">World ID</Label>
                <Input
                  id="worldId"
                  value={context.worldId || ''}
                  onChange={(e) => setContext({ ...context, worldId: e.target.value })}
                  placeholder="world-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rulesetId">Ruleset ID</Label>
                <Input
                  id="rulesetId"
                  value={context.rulesetId || ''}
                  onChange={(e) => setContext({ ...context, rulesetId: e.target.value })}
                  placeholder="ruleset-id"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scenarioId">Scenario ID (Optional)</Label>
                <Input
                  id="scenarioId"
                  value={context.scenarioId || ''}
                  onChange={(e) => setContext({ ...context, scenarioId: e.target.value || undefined })}
                  placeholder="scenario-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templatesVersion">Templates Version (Optional)</Label>
                <Input
                  id="templatesVersion"
                  type="number"
                  value={context.templatesVersion || ''}
                  onChange={(e) => setContext({ 
                    ...context, 
                    templatesVersion: e.target.value ? parseInt(e.target.value, 10) : undefined 
                  })}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="npcIds">NPC IDs (Comma-separated, Optional)</Label>
              <Input
                id="npcIds"
                value={context.npcIds?.join(', ') || ''}
                onChange={(e) => {
                  const ids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  setContext({ ...context, npcIds: ids.length > 0 ? ids : undefined });
                }}
                placeholder="npc-id-1, npc-id-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Extras Overrides */}
        <Card>
          <CardHeader>
            <CardTitle>Extras Overrides</CardTitle>
            <CardDescription>Override extras for world, ruleset, or scenario</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={context.npcIds && context.npcIds.length > 0 ? "npc" : "world"} className="w-full">
              <TabsList className={`grid w-full ${context.npcIds && context.npcIds.length > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {context.npcIds && context.npcIds.length > 0 && (
                  <TabsTrigger value="npc">NPC</TabsTrigger>
                )}
                <TabsTrigger value="world">World</TabsTrigger>
                <TabsTrigger value="ruleset">Ruleset</TabsTrigger>
                <TabsTrigger value="scenario">Scenario</TabsTrigger>
              </TabsList>
              <TabsContent value="world" className="mt-4">
                {context.worldId ? (
                  <ExtrasForm
                    packType="world"
                    packId={context.worldId}
                    initialExtras={extrasOverrides.world || null}
                    onSuccess={() => handleExtrasSaved('world', context.worldId!)}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>Enter a World ID in Context to edit extras</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              <TabsContent value="ruleset" className="mt-4">
                {context.rulesetId ? (
                  <ExtrasForm
                    packType="ruleset"
                    packId={context.rulesetId}
                    initialExtras={extrasOverrides.ruleset || null}
                    onSuccess={() => handleExtrasSaved('ruleset', context.rulesetId!)}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>Enter a Ruleset ID in Context to edit extras</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              <TabsContent value="scenario" className="mt-4">
                {context.scenarioId ? (
                  <ExtrasForm
                    packType="scenario"
                    packId={context.scenarioId}
                    initialExtras={extrasOverrides.scenario || null}
                    onSuccess={() => handleExtrasSaved('scenario', context.scenarioId!)}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>Enter a Scenario ID in Context to edit extras</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              {/* NPC Extras - shown when npcIds are provided */}
              {context.npcIds && context.npcIds.length > 0 && (
                <TabsContent value="npc" className="mt-4">
                  {context.npcIds.map((npcId) => (
                    <div key={npcId} className="mb-4">
                      <h4 className="text-sm font-semibold mb-2">NPC: {npcId}</h4>
                      <ExtrasForm
                        packType="npc"
                        packId={npcId}
                        initialExtras={extrasOverrides.npcs?.[npcId] || null}
                        onSuccess={() => handleExtrasSaved('npc', npcId)}
                      />
                    </div>
                  ))}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Module Params Overrides - shown when storyId is present */}
        {storyId && (
          <Card>
            <CardHeader>
              <CardTitle>Module Params</CardTitle>
              <CardDescription>
                Configure parameters for attached modules
                {!storyModules || storyModules.length === 0 && ' (no modules attached)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!storyModules || storyModules.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No modules attached to this story. Select a Story with attached modules to edit parameters.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Module</Label>
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
                          <h4 className="font-semibold">{moduleDetail.title} Parameters</h4>
                          <p className="text-sm text-muted-foreground">
                            {moduleDetail.id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {moduleDetail.paramsDef?.defaults && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetParams(selectedModuleId)}
                              disabled={!canEditParams}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset
                            </Button>
                          )}
                          {canEditParams && (
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
                                <strong>Size warning:</strong> Params are {paramsSize} bytes (approaching 8KB limit)
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
                          onChange={(value) => handleModuleParamsChange(selectedModuleId, value)}
                          errors={{}}
                        />
                      ) : (
                        <div className="text-muted-foreground text-sm">
                          This module has no configurable parameters.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <ActionsBar
          onPreview={() => previewMutation.mutate()}
          onBudget={(maxTokens) => budgetMutation.mutate(maxTokens)}
          isLoadingPreview={previewMutation.isPending}
          isLoadingBudget={budgetMutation.isPending}
          hasContext={!!(context.npcIds && context.npcIds.length > 0) || !!(context.worldId && context.rulesetId)}
          hasBudgetContext={!!(context.worldId && context.rulesetId)} // Budget requires worldId + rulesetId
          contextId={context.npcIds?.[0] || context.gameId}
        />
      </div>

      {/* Right Panel: Results */}
      <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <ResultPane
          previewResult={previewResult}
          budgetResult={budgetResult}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasPartialContext={previewResult !== null && !!(context.npcIds && context.npcIds.length > 0) && !(context.worldId && context.rulesetId)}
          templatesVersion={context.templatesVersion}
          moduleIds={storyId ? (storyModules?.map(m => m.id) || []) : []}
          moduleNames={storyId ? (storyModules?.reduce((acc, m) => ({ ...acc, [m.id]: m.title }), {} as Record<string, string>) || {}) : {}}
          extrasModified={extrasModified}
          storyId={storyId}
        />
      </div>
    </div>
  );
});

