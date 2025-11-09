/**
 * Prompt Builder Page
 * Unified prompt authoring interface for composing prompts
 * Phase 4: Standalone builder with context picker
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Info, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PromptAuthoringSection, type PromptAuthoringContext, type PromptAuthoringSectionRef } from '@/components/admin/prompt-authoring/PromptAuthoringSection';
import { ContextChips } from '@/components/admin/prompt-authoring/ContextChips';
import { isAdminPromptFormsEnabled } from '@/lib/feature-flags';
import { trackAdminEvent } from '@/lib/admin-telemetry';
import { api } from '@/lib/api';
import { worldsService } from '@/services/admin.worlds';
import { rulesetsService } from '@/services/admin.rulesets';
import { npcsService } from '@/services/admin.npcs';
import { searchRefs, type RefItem } from '@/services/refs';

interface ContextState {
  worldId?: string;
  rulesetId?: string;
  scenarioId?: string;
  storyId?: string;
  npcIds: string[];
  templatesVersion?: number;
}

export default function PromptBuilder() {
  const [context, setContext] = useState<ContextState>({
    npcIds: [],
  });
  const [worldSearch, setWorldSearch] = useState('');
  const [rulesetSearch, setRulesetSearch] = useState('');
  const [storySearch, setStorySearch] = useState('');
  const [npcSearch, setNpcSearch] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const authoringSectionRef = useRef<PromptAuthoringSectionRef>(null);

  // Search worlds
  const { data: worldResults } = useQuery({
    queryKey: ['admin', 'worlds', 'search', worldSearch],
    queryFn: async () => {
      if (!worldSearch || worldSearch.length < 2) return [];
      return searchRefs('world', worldSearch, 10);
    },
    enabled: worldSearch.length >= 2,
  });

  // Search rulesets
  const { data: rulesetResults } = useQuery({
    queryKey: ['admin', 'rulesets', 'search', rulesetSearch],
    queryFn: async () => {
      if (!rulesetSearch || rulesetSearch.length < 2) return [];
      return searchRefs('ruleset', rulesetSearch, 10);
    },
    enabled: rulesetSearch.length >= 2,
  });

  // Search NPCs
  const { data: npcResults } = useQuery({
    queryKey: ['admin', 'npcs', 'search', npcSearch],
    queryFn: async () => {
      if (!npcSearch || npcSearch.length < 2) return [];
      const result = await npcsService.listNPCs({ search: npcSearch }, 1, 20);
      return result.data.map(npc => ({ id: npc.id, name: npc.name, slug: npc.id }));
    },
    enabled: npcSearch.length >= 2,
  });

  // Search stories (entry points)
  const { data: storyResults } = useQuery({
    queryKey: ['admin', 'stories', 'search', storySearch],
    queryFn: async () => {
      if (!storySearch || storySearch.length < 2) return [];
      return searchRefs('entry', storySearch, 10);
    },
    enabled: storySearch.length >= 2,
  });

  // Fetch selected story for display
  const { data: selectedStory } = useQuery({
    queryKey: ['admin', 'story', context.storyId],
    queryFn: async () => {
      if (!context.storyId) return null;
      const res = await api.get(`/api/catalog/stories/${context.storyId}`);
      if (!res.ok) return null;
      return res.data;
    },
    enabled: !!context.storyId,
  });

  // Fetch story modules when story is selected
  const { data: storyModules } = useQuery({
    queryKey: ['admin', 'story-modules', context.storyId],
    queryFn: async () => {
      if (!context.storyId) return [];
      const res = await api.get(`/api/admin/stories/${context.storyId}/modules`);
      if (!res.ok) return [];
      return res.data as Array<{
        id: string;
        title: string;
        version: number;
        params?: Record<string, unknown> | null;
      }>;
    },
    enabled: !!context.storyId && isAdminPromptFormsEnabled(),
  });

  // Fetch selected items for display
  const { data: selectedWorld } = useQuery({
    queryKey: ['admin', 'world', context.worldId],
    queryFn: async () => {
      if (!context.worldId) return null;
      return worldsService.getWorld(context.worldId);
    },
    enabled: !!context.worldId,
  });

  const { data: selectedRuleset } = useQuery({
    queryKey: ['admin', 'ruleset', context.rulesetId],
    queryFn: async () => {
      if (!context.rulesetId) return null;
      return rulesetsService.getRuleset(context.rulesetId);
    },
    enabled: !!context.rulesetId,
  });

  // Snapshot creation mutation
  const snapshotMutation = useMutation({
    mutationFn: async () => {
      if (!previewResult?.tp || !previewResult?.linearized) {
        throw new Error('No preview data available. Generate a preview first.');
      }

      await trackAdminEvent('promptBuilder.snapshot.requested', {
        hasWorld: !!context.worldId,
        hasRuleset: !!context.rulesetId,
        hasScenario: !!context.scenarioId,
        npcCount: context.npcIds.length,
        templatesVersion: context.templatesVersion,
      });

      const res = await api.post('/api/admin/prompt-snapshots/create', {
        tp: previewResult.tp,
        linearized_prompt_text: previewResult.linearized,
        templates_version: previewResult.templates_version || context.templatesVersion?.toString(),
      });
      if (!res.ok) throw new Error(res.error || 'Failed to create snapshot');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Snapshot created: ${data.data.snapshot_id.substring(0, 8)}...`);
      trackAdminEvent('promptBuilder.snapshot.success', {
        hasWorld: !!context.worldId,
        hasRuleset: !!context.rulesetId,
        hasScenario: !!context.scenarioId,
        npcCount: context.npcIds.length,
        templatesVersion: context.templatesVersion,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create snapshot');
      trackAdminEvent('promptBuilder.snapshot.failed', {
        hasWorld: !!context.worldId,
        hasRuleset: !!context.rulesetId,
        hasScenario: !!context.scenarioId,
        npcCount: context.npcIds.length,
        templatesVersion: context.templatesVersion,
      });
    },
  });

  const handleSelectWorld = (world: RefItem) => {
    setContext(prev => ({ ...prev, worldId: world.id }));
    setWorldSearch('');
  };

  const handleSelectRuleset = (ruleset: RefItem) => {
    setContext(prev => ({ ...prev, rulesetId: ruleset.id }));
    setRulesetSearch('');
  };

  const handleSelectStory = (story: RefItem) => {
    setContext(prev => ({ ...prev, storyId: story.id }));
    setStorySearch('');
    trackAdminEvent('promptBuilder.story.selected', {
      storyId: story.id,
      moduleCount: 0, // Will be updated when modules load
    });
  };

  const handleSelectNPC = (npc: RefItem) => {
    if (!context.npcIds.includes(npc.id)) {
      setContext(prev => ({ ...prev, npcIds: [...prev.npcIds, npc.id] }));
    }
    setNpcSearch('');
  };

  const handleRemoveNPC = (npcId: string) => {
    setContext(prev => ({ ...prev, npcIds: prev.npcIds.filter(id => id !== npcId) }));
  };

  const handleClearOverrides = () => {
    if (authoringSectionRef.current) {
      authoringSectionRef.current.clearOverrides();
    }
  };

  const handlePreviewResult = (result: { type: 'preview' | 'budget'; data: any }) => {
    if (result.type === 'preview' && result.data) {
      // Store the full preview result for snapshot creation
      setPreviewResult({
        tp: result.data.tp,
        linearized: result.data.linearized,
        templates_version: result.data.templates_version || context.templatesVersion?.toString(),
      });
    }

    const contextFlags = {
      hasWorld: !!context.worldId,
      hasRuleset: !!context.rulesetId,
      hasScenario: !!context.scenarioId,
      npcCount: context.npcIds.length,
      templatesVersion: context.templatesVersion,
    };

    if (!result.data) {
      if (result.type === 'preview') {
        trackAdminEvent('promptBuilder.preview.failed', contextFlags);
      } else if (result.type === 'budget') {
        trackAdminEvent('promptBuilder.budget.failed', contextFlags);
      }
      return;
    }

    if (result.type === 'preview') {
      trackAdminEvent('promptBuilder.preview.success', contextFlags);
    } else if (result.type === 'budget') {
      trackAdminEvent('promptBuilder.budget.success', contextFlags);
    }
  };

  if (!isAdminPromptFormsEnabled()) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Prompt Builder is disabled. Enable VITE_ADMIN_PROMPT_FORMS_ENABLED to use this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const authoringContext: PromptAuthoringContext = {
    worldId: context.worldId,
    rulesetId: context.rulesetId,
    scenarioId: context.scenarioId,
    npcIds: context.npcIds.length > 0 ? context.npcIds : undefined,
    templatesVersion: context.templatesVersion,
  };

  // Update telemetry when story modules load
  if (context.storyId && storyModules && storyModules.length > 0) {
    trackAdminEvent('promptBuilder.story.selected', {
      storyId: context.storyId,
      moduleCount: storyModules.length,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Prompt Builder</h1>
        <p className="text-muted-foreground">
          Compose and preview prompts with full context control
        </p>
      </div>

      {/* Context Picker Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>
            Select world, ruleset, scenario, and NPCs for prompt generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Context Chips */}
          <ContextChips
            context={{
              ...authoringContext,
              // Note: storyId is not part of PromptAuthoringContext, but we'll pass it separately
            }}
            worldName={selectedWorld?.name}
            rulesetName={selectedRuleset?.name}
            onRemove={(type, id) => {
              if (type === 'world') setContext(prev => ({ ...prev, worldId: undefined }));
              else if (type === 'ruleset') setContext(prev => ({ ...prev, rulesetId: undefined }));
              else if (type === 'scenario') setContext(prev => ({ ...prev, scenarioId: undefined }));
              else if (type === 'npc') setContext(prev => ({ ...prev, npcIds: prev.npcIds.filter(nid => nid !== id) }));
            }}
            showTemplatesLink={true}
          />
          {context.storyId && selectedStory && (
            <Badge variant="outline" className="gap-1">
              Story: {selectedStory.title || selectedStory.name || context.storyId.substring(0, 8)}...
              <button
                onClick={() => setContext(prev => ({ ...prev, storyId: undefined }))}
                className="ml-1 hover:text-destructive"
                aria-label="Remove story"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {/* Validation Note */}
          {(!context.worldId || !context.rulesetId) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Budget requires both world and ruleset to be selected.
              </AlertDescription>
            </Alert>
          )}

            <div className="grid gap-4 md:grid-cols-2">
            {/* World Selector */}
            <div className="space-y-2">
              <Label htmlFor="world">World</Label>
              <div className="relative">
                <Input
                  id="world"
                  value={worldSearch}
                  onChange={(e) => setWorldSearch(e.target.value)}
                  placeholder="Search worlds..."
                  onFocus={() => setWorldSearch('')}
                />
                {worldSearch && worldResults && worldResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {worldResults.map((world) => (
                      <button
                        key={world.id}
                        onClick={() => handleSelectWorld(world)}
                        className="w-full text-left px-4 py-2 hover:bg-accent"
                      >
                        {world.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ruleset Selector */}
            <div className="space-y-2">
              <Label htmlFor="ruleset">Ruleset</Label>
              <div className="relative">
                <Input
                  id="ruleset"
                  value={rulesetSearch}
                  onChange={(e) => setRulesetSearch(e.target.value)}
                  placeholder="Search rulesets..."
                  onFocus={() => setRulesetSearch('')}
                />
                {rulesetSearch && rulesetResults && rulesetResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {rulesetResults.map((ruleset) => (
                      <button
                        key={ruleset.id}
                        onClick={() => handleSelectRuleset(ruleset)}
                        className="w-full text-left px-4 py-2 hover:bg-accent"
                      >
                        {ruleset.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scenario Selector */}
            <div className="space-y-2">
              <Label htmlFor="scenario">Scenario ID</Label>
              <Input
                id="scenario"
                value={context.scenarioId || ''}
                onChange={(e) => setContext(prev => ({ ...prev, scenarioId: e.target.value || undefined }))}
                placeholder="Enter scenario UUID..."
              />
            </div>

            {/* Story Selector */}
            <div className="space-y-2">
              <Label htmlFor="story">Story</Label>
              <div className="relative">
                <Input
                  id="story"
                  value={storySearch}
                  onChange={(e) => setStorySearch(e.target.value)}
                  placeholder="Search stories..."
                  onFocus={() => setStorySearch('')}
                />
                {storySearch && storyResults && storyResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {storyResults.map((story) => (
                      <button
                        key={story.id}
                        onClick={() => handleSelectStory(story)}
                        className="w-full text-left px-4 py-2 hover:bg-accent"
                      >
                        {story.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Templates Version */}
            <div className="space-y-2">
              <Label htmlFor="templatesVersion">Templates Version</Label>
              <Select
                value={context.templatesVersion ? String(context.templatesVersion) : 'latest'}
                onValueChange={(value) => {
                  setContext(prev => ({
                    ...prev,
                    templatesVersion: value === 'latest' ? undefined : parseInt(value, 10),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="1">Version 1</SelectItem>
                  <SelectItem value="2">Version 2</SelectItem>
                  <SelectItem value="3">Version 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* NPC Multi-select */}
          <div className="space-y-2">
            <Label htmlFor="npcs">NPCs (Multi-select)</Label>
            <div className="relative">
              <Input
                id="npcs"
                value={npcSearch}
                onChange={(e) => setNpcSearch(e.target.value)}
                placeholder="Search NPCs..."
                onFocus={() => setNpcSearch('')}
              />
              {npcSearch && npcResults && npcResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {npcResults.map((npc) => (
                    <button
                      key={npc.id}
                      onClick={() => handleSelectNPC(npc)}
                      className="w-full text-left px-4 py-2 hover:bg-accent"
                      disabled={context.npcIds.includes(npc.id)}
                    >
                      {npc.name}
                      {context.npcIds.includes(npc.id) && ' (selected)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {context.npcIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {context.npcIds.map((npcId) => (
                  <Badge key={npcId} variant="secondary" className="gap-1">
                    {npcId.substring(0, 8)}...
                    <button
                      onClick={() => handleRemoveNPC(npcId)}
                      className="ml-1 hover:text-destructive"
                      aria-label={`Remove NPC ${npcId}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Authoring Section */}
      <PromptAuthoringSection
        initialContext={authoringContext}
        storyId={context.storyId}
        onResult={handlePreviewResult}
      />

      {/* Snapshot Action */}
      {previewResult && (
        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
            <CardDescription>
              Create a manual snapshot of the current preview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => snapshotMutation.mutate()}
              disabled={snapshotMutation.isPending || !previewResult}
              variant="outline"
            >
              {snapshotMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Snapshot
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

