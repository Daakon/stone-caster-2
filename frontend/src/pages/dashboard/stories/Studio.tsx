/**
 * Story Studio Page - Advanced Editor
 * Phase 2: Creator Tools - Frontend
 * Refactored to 3-section layout: Origin & Intent, Forces & Narrative Flow, Elements & Lore
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraStoriesService } from '@/services/chimera.stories';
import { chimeraLoreEntriesService } from '@/services/chimera.lore-entries';
import { chimeraEntitiesService } from '@/services/chimera.entities';
import { ComplexAssetSelector } from '@/components/chimera/ComplexAssetSelector';
import { chimeraService } from '@/services/admin.chimera';
import { CreateLoreModal } from '@/components/chimera/modals/CreateLoreModal';
import { CreateEntityModal } from '@/components/chimera/modals/CreateEntityModal';

export default function StoryStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal states
  const [isLoreModalOpen, setIsLoreModalOpen] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  
  // Shape button loading state
  const [isShaping, setIsShaping] = useState(false);

  // Section 1: Origin & Intent state
  const [displayName, setDisplayName] = useState('');
  const [worldId, setWorldId] = useState<string | null>(null);

  // Section 2: Forces & Narrative Flow state
  const [selectedMainSystemId, setSelectedMainSystemId] = useState<string | null>(null);
  const [selectedRulesetIds, setSelectedRulesetIds] = useState<Set<string>>(new Set());
  const [openAccordionSection, setOpenAccordionSection] = useState<string | undefined>('origin-intent');

  // Fetch story details
  const { data: story, isLoading, error } = useQuery({
    queryKey: ['chimera-story', id],
    queryFn: () => chimeraStoriesService.getStory(id!),
    enabled: !!id,
  });

  // Fetch ruleset templates
  const { data: allRulesets, isLoading: isLoadingRulesets } = useQuery({
    queryKey: ['chimera-ruleset-templates'],
    queryFn: () => chimeraService.listRulesetTemplates(),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch lore entries
  const { data: loreEntries, isLoading: isLoadingLore } = useQuery({
    queryKey: ['chimera-lore-entries', id],
    queryFn: () => chimeraLoreEntriesService.fetchLoreEntries(id!),
    enabled: !!id,
  });

  // Fetch linked entities
  const linkedEntityIds = story?.entity_links?.map((link) => link.entity_template_id) || [];
  const { data: linkedEntities, isLoading: isLoadingEntities } = useQuery({
    queryKey: ['chimera-linked-entities', linkedEntityIds],
    queryFn: async () => {
      if (linkedEntityIds.length === 0) return [];
      const entities = await Promise.all(
        linkedEntityIds.map((entityId) => chimeraEntitiesService.getEntity(entityId))
      );
      return entities;
    },
    enabled: linkedEntityIds.length > 0,
  });

  // Initialize state from story
  useEffect(() => {
    if (story) {
      setDisplayName(story.display_name || '');
      setWorldId(story.world_id || null);

      // Initialize ruleset selection from story links
      if (story.ruleset_links && allRulesets) {
        const linkedRulesetIds = story.ruleset_links.map((link) => link.ruleset_template_id);
        setSelectedRulesetIds(new Set(linkedRulesetIds));

        // Find main system
        const mainSystem = allRulesets.find(
          (r) => r.rule_type === 'MAIN_SYSTEM' && linkedRulesetIds.includes(r.id)
        );
        if (mainSystem) {
          setSelectedMainSystemId(mainSystem.id);
        }
      }
    }
  }, [story, allRulesets]);

  // Update story mutation
  const updateStoryMutation = useMutation({
    mutationFn: (data: { display_name: string; world_id: string | null }) =>
      chimeraStoriesService.updateStory(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update story');
    },
  });

  // Update ruleset links mutation
  const updateRulesetLinksMutation = useMutation({
    mutationFn: (rulesetIds: string[]) =>
      chimeraStoriesService.updateStory(id!, { ruleset_template_ids: rulesetIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
      toast.success('Rulesets updated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update rulesets');
    },
  });

  // Delete lore entry mutation
  const deleteLoreMutation = useMutation({
    mutationFn: (loreId: string) => chimeraLoreEntriesService.deleteLoreEntry(loreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chimera-lore-entries', id] });
      toast.success('Lore entry deleted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete lore entry');
    },
  });

  // Validation functions
  const isSection1Valid = () => {
    return displayName.trim().length > 0 && worldId !== null;
  };

  const isSection2Valid = () => {
    return selectedMainSystemId !== null;
  };

  // Handle display name change (save on blur)
  const handleDisplayNameBlur = () => {
    if (id && displayName.trim() !== story?.display_name) {
      updateStoryMutation.mutate({
        display_name: displayName.trim(),
        world_id: worldId,
      });
    }
  };

  // Handle world change (save immediately)
  const handleWorldChange = (ids: string[]) => {
    const newWorldId = ids[0] || null;
    setWorldId(newWorldId);
    if (id) {
      updateStoryMutation.mutate({
        display_name: displayName.trim(),
        world_id: newWorldId,
      });
    }
  };

  // Handle main system change
  const handleMainSystemChange = (rulesetId: string) => {
    setSelectedMainSystemId(rulesetId);
    const newSet = new Set(selectedRulesetIds);
    
    // Remove any existing MAIN_SYSTEM rulesets
    if (allRulesets) {
      allRulesets.forEach((r) => {
        if (r.rule_type === 'MAIN_SYSTEM') {
          newSet.delete(r.id);
        }
      });
    }
    
    newSet.add(rulesetId);
    setSelectedRulesetIds(newSet);
    
    // Save immediately
    updateRulesetLinksMutation.mutate(Array.from(newSet));
  };

  // Handle subsystem/modifier toggle
  const handleRulesetToggle = (rulesetId: string, checked: boolean) => {
    const newSet = new Set(selectedRulesetIds);
    if (checked) {
      newSet.add(rulesetId);
    } else {
      newSet.delete(rulesetId);
    }
    setSelectedRulesetIds(newSet);
    
    // Save immediately
    updateRulesetLinksMutation.mutate(Array.from(newSet));
  };

  // Handle shape button click
  const handleShapeStory = async () => {
    if (!id) return;

    setIsShaping(true);
    try {
      const result = await chimeraStoriesService.rebuildStory(id);
      
      toast.success('Story Dimension Shaped Successfully!', {
        description: `Last compiled: ${new Date(result.last_compiled_at).toLocaleString()}`,
      });
      
      // Optionally invalidate queries to refresh any compiled data
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    } catch (error) {
      console.error('Error shaping story:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Shaping Failed: ${errorMessage}`);
    } finally {
      setIsShaping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load story</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>Story not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter rulesets by type
  const mainSystemRulesets = allRulesets?.filter((r) => r.rule_type === 'MAIN_SYSTEM') || [];
  const subsystemRulesets =
    allRulesets?.filter(
      (r) => r.rule_type === 'SUBSYSTEM' && r.main_system_dependency === selectedMainSystemId
    ) || [];
  const modifierRulesets = allRulesets?.filter((r) => r.rule_type === 'MODIFIER') || [];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/stories')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Story Studio</h1>
            <p className="text-muted-foreground mt-2">
              Advanced Editor for &quot;{story.display_name}&quot;
            </p>
          </div>
        </div>
        <Button
          onClick={handleShapeStory}
          disabled={!isSection1Valid() || !isSection2Valid() || isShaping}
          size="lg"
        >
          {isShaping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Shaping...
            </>
          ) : (
            'Shape Story Dimension'
          )}
        </Button>
      </div>

      {/* 3-Section Accordion */}
      <Accordion
        type="single"
        collapsible
        className="w-full space-y-4"
        value={openAccordionSection}
        onValueChange={setOpenAccordionSection}
      >
        {/* Section 1: Origin & Intent */}
        <AccordionItem value="origin-intent" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm font-medium">
                1
              </span>
              <span className="text-lg font-semibold">Origin & Intent</span>
              {isSection1Valid() ? (
                <span className="text-green-600 text-xl">✅</span>
              ) : (
                <span className="text-yellow-600 text-xl">⚠️</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name *</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={handleDisplayNameBlur}
                  placeholder="Enter story name"
                  disabled={updateStoryMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>World *</Label>
                <ComplexAssetSelector
                  assetType="world"
                  selectedIds={worldId ? [worldId] : []}
                  onSelectionChange={handleWorldChange}
                  mode="single"
                  emptyMessage="No worlds available. Create one first!"
                  itemLabel="world"
                  onCreateNew={() => navigate('/dashboard/worlds/new')}
                  createNewLabel="Create New World"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: Forces & Narrative Flow */}
        <AccordionItem value="forces-narrative" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm font-medium">
                2
              </span>
              <span className="text-lg font-semibold">Forces & Narrative Flow</span>
              {isSection2Valid() ? (
                <span className="text-green-600 text-xl">✅</span>
              ) : (
                <span className="text-yellow-600 text-xl">⚠️</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6">
            <div className="space-y-6">
              {isLoadingRulesets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Main System Selection */}
                  <div className="space-y-2">
                    <Label>Main System *</Label>
                    <div className="space-y-2">
                      {mainSystemRulesets.map((ruleset) => (
                        <label
                          key={ruleset.id}
                          className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                        >
                          <input
                            type="radio"
                            name="main-system"
                            value={ruleset.id}
                            checked={selectedMainSystemId === ruleset.id}
                            onChange={() => handleMainSystemChange(ruleset.id)}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{ruleset.display_name}</div>
                            {ruleset.description_short && (
                              <div className="text-sm text-muted-foreground">
                                {ruleset.description_short}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Subsystems (only show if main system selected) */}
                  {selectedMainSystemId && subsystemRulesets.length > 0 && (
                    <div className="space-y-2">
                      <Label>Subsystems (Optional)</Label>
                      <div className="space-y-2">
                        {subsystemRulesets.map((ruleset) => (
                          <label
                            key={ruleset.id}
                            className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRulesetIds.has(ruleset.id)}
                              onChange={(e) => handleRulesetToggle(ruleset.id, e.target.checked)}
                              className="h-4 w-4"
                            />
                            <div className="flex-1">
                              <div className="font-medium">{ruleset.display_name}</div>
                              {ruleset.description_short && (
                                <div className="text-sm text-muted-foreground">
                                  {ruleset.description_short}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modifiers */}
                  {modifierRulesets.length > 0 && (
                    <div className="space-y-2">
                      <Label>Modifiers (Optional)</Label>
                      <div className="space-y-2">
                        {modifierRulesets.map((ruleset) => (
                          <label
                            key={ruleset.id}
                            className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRulesetIds.has(ruleset.id)}
                              onChange={(e) => handleRulesetToggle(ruleset.id, e.target.checked)}
                              className="h-4 w-4"
                            />
                            <div className="flex-1">
                              <div className="font-medium">{ruleset.display_name}</div>
                              {ruleset.description_short && (
                                <div className="text-sm text-muted-foreground">
                                  {ruleset.description_short}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Elements & Lore */}
        <AccordionItem value="elements-lore" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm font-medium">
                3
              </span>
              <span className="text-lg font-semibold">Elements & Lore</span>
              <span className="text-green-600 text-xl">✅</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6">
            <div className="space-y-6">
              {/* Header with action buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Linked Elements</CardTitle>
                  <CardDescription>Entities linked to this story</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEntityModalOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Element
                  </Button>
                </div>
              </div>

              {/* Linked Entities List */}
              {isLoadingEntities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : linkedEntities && linkedEntities.length > 0 ? (
                <div className="space-y-2">
                  {linkedEntities.map((entity) => (
                    <Card key={entity.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{entity.display_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {entity.entity_type} • {entity.description_short || 'No description'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No linked elements yet. Click &quot;Add Element&quot; to create one.</p>
                </div>
              )}

              {/* Lore Entries Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Lore Entries</CardTitle>
                    <CardDescription>Story-specific lore for RAG system</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLoreModalOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lore
                  </Button>
                </div>

                {/* Lore Entries List */}
                {isLoadingLore ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : loreEntries && loreEntries.length > 0 ? (
                  <div className="space-y-2">
                    {loreEntries.map((entry) => (
                      <Card key={entry.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{entry.display_name}</div>
                              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {entry.entry_text}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteLoreMutation.mutate(entry.id)}
                              disabled={deleteLoreMutation.isPending}
                              className="ml-4"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No lore entries yet. Click &quot;Add Lore&quot; to create one.</p>
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Modals */}
      {id && (
        <>
          <CreateLoreModal
            isOpen={isLoreModalOpen}
            onClose={() => setIsLoreModalOpen(false)}
            storyId={id}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['chimera-lore-entries', id] });
            }}
          />
          <CreateEntityModal
            isOpen={isEntityModalOpen}
            onClose={() => setIsEntityModalOpen(false)}
            storyId={id}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
            }}
          />
        </>
      )}
    </div>
  );
}
