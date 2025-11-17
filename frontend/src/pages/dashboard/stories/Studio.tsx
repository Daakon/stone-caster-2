/**
 * Story Studio Page
 * Phase 3: Vertical accordion layout for story creation
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, Loader2, RefreshCw, Plus, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraStoriesService } from '@/services/chimera.stories';
import { ComplexAssetSelector } from '@/components/chimera/ComplexAssetSelector';
import { chimeraService, type RulesetTemplate } from '@/services/admin.chimera';
import { useStudioStore } from '@/store/studio';
import { chimeraPacksService } from '@/services/chimera.packs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface StoryDefinition {
  start_premise?: string;
  objectives?: Array<{ id: string; text: string }>;
  scenes?: Array<{ id: string; title: string; description: string }>;
}

export default function StoryStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpContent, setHelpContent] = useState<{ title: string; content: string } | null>(null);

  // Shared store for selected rulesets
  const { selectedRulesets, setSelectedRulesets, addRuleset, removeRuleset, hasPlotPanelComponents } = useStudioStore();

  // Core & World state
  const [displayName, setDisplayName] = useState('');
  const [descriptionShort, setDescriptionShort] = useState('');
  const [worldId, setWorldId] = useState<string | null>(null);

  // Rules & Mechanics state
  const [selectedMainSystemId, setSelectedMainSystemId] = useState<string | null>(null);
  const [selectedRulesetIds, setSelectedRulesetIds] = useState<Set<string>>(new Set());
  const [openAccordionSection, setOpenAccordionSection] = useState<string | undefined>(undefined);
  
  // Assets & Lore state
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [selectedLoreIds, setSelectedLoreIds] = useState<string[]>([]);
  const [packAssetIds, setPackAssetIds] = useState<Set<string>>(new Set()); // Entity IDs from all selected packs
  const [packLoreIds, setPackLoreIds] = useState<Set<string>>(new Set()); // Lore IDs from all selected packs
  
  // Dynamic UI component values from ruleset ui_schema
  // Key format: "rulesetId:componentKey" -> value
  const [componentValues, setComponentValues] = useState<Record<string, unknown>>({});

  // Plot state
  const [startPremise, setStartPremise] = useState('');
  const [objectives, setObjectives] = useState<Array<{ id: string; text: string }>>([]);
  const [scenes, setScenes] = useState<Array<{ id: string; title: string; description: string }>>([]);

  // Fetch story details
  const { data: story, isLoading, error } = useQuery({
    queryKey: ['chimera-story', id],
    queryFn: () => chimeraStoriesService.getStory(id!),
    enabled: !!id,
  });

  // Fetch ruleset templates when Mechanics & Plot section is open or on page load
  const { data: allRulesets, isLoading: isLoadingRulesets } = useQuery({
    queryKey: ['chimera-ruleset-templates'],
    queryFn: () => chimeraService.listRulesetTemplates(),
    enabled: openAccordionSection === 'mechanics-plot' || !!id, // Fetch when section is open or when story ID exists
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pack details to get entity IDs when packs are selected
  const { data: selectedPacks } = useQuery({
    queryKey: ['chimera-packs-details', selectedPackIds],
    queryFn: async () => {
      if (selectedPackIds.length === 0) return [];
      // Fetch all selected packs in parallel
      const packPromises = selectedPackIds.map((packId) => chimeraPacksService.getPack(packId));
      return Promise.all(packPromises);
    },
    enabled: selectedPackIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Update packAssetIds and packLoreIds when selected packs change
  useEffect(() => {
    if (selectedPacks && selectedPacks.length > 0) {
      // Collect all entity_template_ids and lore_template_ids from all selected packs
      const allEntityIds = new Set<string>();
      const allLoreIds = new Set<string>();
      selectedPacks.forEach((pack) => {
        if (pack.entity_links && pack.entity_links.length > 0) {
          pack.entity_links.forEach((link) => {
            allEntityIds.add(link.entity_template_id);
          });
        }
        if (pack.lore_links && pack.lore_links.length > 0) {
          pack.lore_links.forEach((link) => {
            allLoreIds.add(link.lore_template_id);
          });
        }
      });
      setPackAssetIds(allEntityIds);
      setPackLoreIds(allLoreIds);
    } else {
      setPackAssetIds(new Set());
      setPackLoreIds(new Set());
    }
  }, [selectedPacks]);

  // Initialize form when story loads
  useEffect(() => {
    if (story) {
      setDisplayName(story.display_name || '');
      setDescriptionShort(story.description_short || '');
      setWorldId(story.world_id || null);

      // Initialize pack selections from story's pack_links
      if (story.pack_links && story.pack_links.length > 0) {
        setSelectedPackIds(story.pack_links.map((link) => link.pack_id));
      } else {
        setSelectedPackIds([]);
      }

      // Initialize entity selections from story's entity_links
      if (story.entity_links && story.entity_links.length > 0) {
        setSelectedEntityIds(story.entity_links.map((link) => link.entity_template_id));
      } else {
        setSelectedEntityIds([]);
      }

      // Initialize lore selections (if story has lore_links in the future)
      // For now, initialize as empty
      setSelectedLoreIds([]);

      // Initialize ruleset selections from story's ruleset_links
      if (story.ruleset_links && story.ruleset_links.length > 0) {
        const rulesetIds = new Set(story.ruleset_links.map((link) => link.ruleset_template_id));
        setSelectedRulesetIds(rulesetIds);
        // Find main system from selected rulesets (will be set after rulesets load)
      }

      if (story.story_definition) {
        const def = story.story_definition as StoryDefinition;
        setStartPremise(def.start_premise || '');
        setObjectives(def.objectives || []);
        setScenes(def.scenes || []);
      } else {
        setStartPremise('');
        setObjectives([]);
        setScenes([]);
      }
    }
  }, [story]);

  // Set main system from selected rulesets when rulesets load and populate shared store
  useEffect(() => {
    if (allRulesets && story?.ruleset_links) {
      // Find and set main system
      if (selectedMainSystemId === null) {
        const mainSystem = allRulesets.find(
          (r) =>
            r.rule_type === 'MAIN_SYSTEM' &&
            story.ruleset_links?.some((link) => link.ruleset_template_id === r.id)
        );
        if (mainSystem) {
          setSelectedMainSystemId(mainSystem.id);
        }
      }
      
      // Populate shared store with all selected rulesets
      const selectedRulesetObjects = allRulesets.filter((r) =>
        story.ruleset_links?.some((link) => link.ruleset_template_id === r.id)
      );
      if (selectedRulesetObjects.length > 0) {
        setSelectedRulesets(selectedRulesetObjects);
      }
    }
  }, [allRulesets, story, selectedMainSystemId, setSelectedRulesets]);

  // Update story basic info mutation
  const updateStoryMutation = useMutation({
    mutationFn: (data: { display_name: string; description_short: string | null; world_id: string | null }) =>
      chimeraStoriesService.updateStory(id!, data),
    onSuccess: () => {
      toast.success('Story updated successfully');
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update story');
    },
  });

  // Update story packs mutation
  const updateStoryPacksMutation = useMutation({
    mutationFn: (packIds: string[]) =>
      chimeraStoriesService.updateStory(id!, { pack_ids: packIds }),
    onSuccess: () => {
      toast.success('Content packs updated successfully');
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update content packs');
    },
  });

  // Update story entities mutation
  const updateStoryEntitiesMutation = useMutation({
    mutationFn: (entityIds: string[]) =>
      chimeraStoriesService.updateStory(id!, { entity_ids: entityIds }),
    onSuccess: () => {
      toast.success('Entities updated successfully');
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update entities');
    },
  });

  // Update story definition mutation
  const updateStoryDefinitionMutation = useMutation({
    mutationFn: (data: StoryDefinition) =>
      chimeraStoriesService.updateStoryDefinition(id!, data),
    onSuccess: () => {
      toast.success('Plot saved successfully');
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save plot');
    },
  });

  const handleSaveCoreAndWorld = () => {
    if (!id) return;
    // Save basic story fields
    updateStoryMutation.mutate({
      display_name: displayName.trim(),
      description_short: descriptionShort.trim() || null,
      world_id: worldId,
    });
    // Save Start Premise as part of story definition
    if (startPremise.trim()) {
      const storyDefinition: StoryDefinition = {
        start_premise: startPremise.trim(),
        objectives: objectives.filter((obj) => obj.text.trim()),
        scenes: scenes.filter((scene) => scene.title.trim() || scene.description.trim()),
      };
      updateStoryDefinitionMutation.mutate(storyDefinition);
    }
  };

  const handleSaveAssetsAndLore = (packIds?: string[], entityIds?: string[], loreIds?: string[]) => {
    if (!id) return;
    const packsToSave = packIds || selectedPackIds;
    const entitiesToSave = entityIds || selectedEntityIds;
    const loreToSave = loreIds || selectedLoreIds;
    
    // Save packs and entities
    updateStoryPacksMutation.mutate(packsToSave);
    updateStoryEntitiesMutation.mutate(entitiesToSave);
    // Note: Lore links saving will be implemented when backend supports it
    // For now, we just track the state
  };

  // Section completion checkers
  const isCoreWorldComplete = () => {
    // Core & World requires: Display Name, Start Premise, and World
    return displayName.trim().length > 0 && startPremise.trim().length > 0 && worldId !== null;
  };

  const isRulesMechanicsComplete = () => {
    return selectedMainSystemId !== null;
  };

  const isAssetsLoreComplete = () => {
    // Assets & Lore is optional, but shows ✅ when at least one asset is selected
    // Show ✅ if at least one pack, entity, or lore is selected, otherwise show (Optional)
    return selectedPackIds.length > 0 || selectedEntityIds.length > 0 || selectedLoreIds.length > 0;
  };

  // Note: Plot is now part of Mechanics & Plot section, so we don't need a separate isPlotComplete

  const getAllSectionsComplete = () => {
    // All three sections must have ✅ for Rebuild to be enabled
    // Assets & Lore is optional but must show ✅ (have at least one selection) for Rebuild
    return isCoreWorldComplete() && isRulesMechanicsComplete() && isAssetsLoreComplete();
  };


  const handleSavePlot = () => {
    if (!id) return;

    const storyDefinition: StoryDefinition = {
      start_premise: startPremise.trim() || undefined,
      objectives: objectives.filter((obj) => obj.text.trim()),
      scenes: scenes.filter((scene) => scene.title.trim() || scene.description.trim()),
    };

    updateStoryDefinitionMutation.mutate(storyDefinition);
  };

  const handleRebuild = async () => {
    if (!id) return;

    setIsRebuilding(true);
    try {
      const result = await chimeraStoriesService.rebuildStory(id);
      toast.success('Story rebuilt successfully!', {
        description: `Compiled ${result.source_manifest.length} ruleset templates.`,
      });
      queryClient.invalidateQueries({ queryKey: ['chimera-story', id] });
    } catch (error) {
      console.error('Error rebuilding story:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rebuild story');
    } finally {
      setIsRebuilding(false);
    }
  };

  // Ruleset selection handlers
  const handleMainSystemChange = (rulesetId: string) => {
    setSelectedMainSystemId(rulesetId);
    // Remove old main system from selected set and add new one
    const newSet = new Set(selectedRulesetIds);
    // Remove any existing MAIN_SYSTEM rulesets from local state
    if (allRulesets) {
      allRulesets.forEach((r) => {
        if (r.rule_type === 'MAIN_SYSTEM') {
          newSet.delete(r.id);
          // Remove from shared store
          removeRuleset(r.id);
        }
      });
    }
    newSet.add(rulesetId);
    setSelectedRulesetIds(newSet);
    
    // Add new main system to shared store
    const newMainSystem = allRulesets?.find((r) => r.id === rulesetId);
    if (newMainSystem) {
      addRuleset(newMainSystem);
    }
  };

  const handleSubsystemToggle = (rulesetId: string, checked: boolean) => {
    const newSet = new Set(selectedRulesetIds);
    if (checked) {
      newSet.add(rulesetId);
      // Add to shared store
      const ruleset = allRulesets?.find((r) => r.id === rulesetId);
      if (ruleset) {
        addRuleset(ruleset);
      }
    } else {
      newSet.delete(rulesetId);
      // Remove component values when ruleset is unchecked
      removeRulesetComponents(rulesetId);
      // Remove from shared store
      removeRuleset(rulesetId);
    }
    setSelectedRulesetIds(newSet);
  };

  const handleModifierToggle = (rulesetId: string, checked: boolean, exclusionGroupId: string | null) => {
    const newSet = new Set(selectedRulesetIds);
    
    if (checked) {
      // If this modifier has an exclusion group, remove other modifiers in the same group
      if (exclusionGroupId && allRulesets) {
        allRulesets.forEach((r) => {
          if (r.rule_type === 'MODIFIER' && r.exclusion_group_id === exclusionGroupId && r.id !== rulesetId) {
            newSet.delete(r.id);
            // Remove component values for unchecked modifiers
            removeRulesetComponents(r.id);
            // Remove from shared store
            removeRuleset(r.id);
          }
        });
      }
      newSet.add(rulesetId);
      // Add to shared store
      const ruleset = allRulesets?.find((r) => r.id === rulesetId);
      if (ruleset) {
        addRuleset(ruleset);
      }
    } else {
      newSet.delete(rulesetId);
      // Remove component values when ruleset is unchecked
      removeRulesetComponents(rulesetId);
      // Remove from shared store
      removeRuleset(rulesetId);
    }
    
    setSelectedRulesetIds(newSet);
  };

  // Remove all component values for a given ruleset
  const removeRulesetComponents = (rulesetId: string) => {
    setComponentValues((prev) => {
      const newValues = { ...prev };
      Object.keys(newValues).forEach((key) => {
        if (key.startsWith(`${rulesetId}:`)) {
          delete newValues[key];
        }
      });
      return newValues;
    });
  };

  const addObjective = () => {
    setObjectives([...objectives, { id: Date.now().toString(), text: '' }]);
  };

  const removeObjective = (objId: string) => {
    setObjectives(objectives.filter((obj) => obj.id !== objId));
  };

  const updateObjective = (objId: string, text: string) => {
    setObjectives(objectives.map((obj) => (obj.id === objId ? { ...obj, text } : obj)));
  };

  const addScene = () => {
    setScenes([...scenes, { id: Date.now().toString(), title: '', description: '' }]);
  };

  const removeScene = (sceneId: string) => {
    setScenes(scenes.filter((scene) => scene.id !== sceneId));
  };

  const updateScene = (sceneId: string, field: 'title' | 'description', value: string) => {
    setScenes(scenes.map((scene) => (scene.id === sceneId ? { ...scene, [field]: value } : scene)));
  };

  const showHelp = (title: string, content: string) => {
    setHelpContent({ title, content });
    setHelpOpen(true);
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

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/stories')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Story Studio</h1>
          <p className="text-muted-foreground mt-2">
            Create and configure &quot;{story.display_name}&quot;
          </p>
        </div>
      </div>

      <Accordion
        type="single"
        collapsible
        className="w-full space-y-4"
        value={openAccordionSection}
        onValueChange={setOpenAccordionSection}
      >
        {/* Section 1: Core & World */}
        <AccordionItem value="core-world" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm font-medium">
                1
              </span>
              <span className="text-lg font-semibold">Core & World</span>
              {isCoreWorldComplete() ? (
                <span className="text-green-600 text-xl">✅</span>
              ) : (
                <span className="text-yellow-600 text-xl">⚠️</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 rounded-full"
                        aria-label="Display Name help"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="right">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Display Name</h4>
                        <p className="text-sm text-muted-foreground">
                          The name that will be shown for this story in lists and menus. Choose something descriptive and memorable.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter story name"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="description-short">Short Description</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 rounded-full"
                        aria-label="Short Description help"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="right">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Short Description</h4>
                        <p className="text-sm text-muted-foreground">
                          A brief summary of your story. This will be shown in story listings and help players understand what the story is about.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea
                  id="description-short"
                  value={descriptionShort}
                  onChange={(e) => setDescriptionShort(e.target.value)}
                  placeholder="Brief description of your story"
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Select World (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 rounded-full"
                        aria-label="Select World help"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="right">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Select World</h4>
                        <p className="text-sm text-muted-foreground">
                          Choose the world setting for your story. This defines the universe, rules, and context in which your story takes place. You can create a new world if needed.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <ComplexAssetSelector
                  assetType="world"
                  selectedIds={worldId ? [worldId] : []}
                  onSelectionChange={(ids) => {
                    const newWorldId = ids[0] || null;
                    setWorldId(newWorldId);
                  }}
                  mode="single"
                  emptyMessage="No worlds available. Create one first!"
                  itemLabel="world"
                  onCreateNew={() => navigate('/dashboard/worlds/new')}
                  createNewLabel="Create New World"
                />
              </div>

              {/* Start Premise - Moved from Plot section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="start-premise">Start Premise</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 rounded-full"
                        aria-label="Start Premise help"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="right">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Start Premise</h4>
                        <p className="text-sm text-muted-foreground">
                          The initial situation or context when the story begins. This sets up the world, characters, and starting conditions for the player. Describe where the player starts, what they know, and what situation they find themselves in.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea
                  id="start-premise"
                  value={startPremise}
                  onChange={(e) => {
                    setStartPremise(e.target.value);
                  }}
                  placeholder="Describe the starting situation for your story..."
                  rows={6}
                  className="resize-none"
                />
              </div>

              <Button
                onClick={() => {
                  handleSaveCoreAndWorld();
                }}
                disabled={updateStoryMutation.isPending || !isCoreWorldComplete()}
                className="w-full sm:w-auto"
              >
                {updateStoryMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: Assets & Lore */}
        <AccordionItem value="assets-lore" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm font-medium">
                2
              </span>
              <span className="text-lg font-semibold">Assets & Lore</span>
              {isAssetsLoreComplete() ? (
                <span className="text-green-600 text-xl">✅</span>
              ) : (
                <span className="text-muted-foreground text-sm">(Optional)</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Select Content Packs (Optional)</Label>
                <ComplexAssetSelector
                  assetType="pack"
                  selectedIds={selectedPackIds}
                  onSelectionChange={(ids) => {
                    setSelectedPackIds(ids);
                    // Auto-save when packs change
                    handleSaveAssetsAndLore(ids, selectedEntityIds, selectedLoreIds);
                  }}
                  mode="multi"
                  emptyMessage="No content packs available. Create one first!"
                  itemLabel="pack"
                  onCreateNew={() => navigate('/dashboard/packs/new')}
                  createNewLabel="Create New Content Pack"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Entities - NPCs, Items, Factions (Optional)</Label>
                <ComplexAssetSelector
                  assetType="entity"
                  selectedIds={selectedEntityIds}
                  onSelectionChange={(ids) => {
                    setSelectedEntityIds(ids);
                    // Auto-save when entities change
                    handleSaveAssetsAndLore(selectedPackIds, ids, selectedLoreIds);
                  }}
                  mode="multi"
                  emptyMessage="No entities available. Create one first!"
                  itemLabel="entity"
                  onCreateNew={() => navigate('/dashboard/entities/new')}
                  createNewLabel="Create New Entity"
                  excludeIds={Array.from(packAssetIds)} // Exclude entities that are already in selected packs
                />
              </div>

              <div className="space-y-2">
                <Label>Select Individual Lore (Optional)</Label>
                <ComplexAssetSelector
                  assetType="lore"
                  selectedIds={selectedLoreIds}
                  onSelectionChange={(ids) => {
                    setSelectedLoreIds(ids);
                    // Auto-save when lore changes
                    handleSaveAssetsAndLore(selectedPackIds, selectedEntityIds, ids);
                  }}
                  mode="multi"
                  emptyMessage="No lore available. Create one first!"
                  itemLabel="lore"
                  onCreateNew={() => navigate('/dashboard/lore/new')}
                  createNewLabel="Create New Lore"
                  excludeIds={Array.from(packLoreIds)} // Exclude lore that is already in selected packs
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Mechanics & Plot */}
        <AccordionItem value="mechanics-plot" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm font-medium">
                3
              </span>
              <span className="text-lg font-semibold">Mechanics & Plot</span>
              {isRulesMechanicsComplete() ? (
                <span className="text-green-600 text-xl">✅</span>
              ) : (
                <span className="text-yellow-600 text-xl">⚠️</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6">
            {isLoadingRulesets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MechanicsPlotContent
                allRulesets={allRulesets || []}
                selectedMainSystemId={selectedMainSystemId}
                selectedRulesetIds={selectedRulesetIds}
                onMainSystemChange={(rulesetId) => {
                  handleMainSystemChange(rulesetId);
                }}
                onSubsystemToggle={handleSubsystemToggle}
                onModifierToggle={handleModifierToggle}
                componentValues={componentValues}
                onComponentValueChange={(key, value) => {
                  setComponentValues((prev) => ({ ...prev, [key]: value }));
                }}
                selectedRulesets={selectedRulesets}
                objectives={objectives}
                scenes={scenes}
                onAddObjective={addObjective}
                onRemoveObjective={removeObjective}
                onUpdateObjective={updateObjective}
                onAddScene={addScene}
                onRemoveScene={removeScene}
                onUpdateScene={updateScene}
              />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Rebuild Button - Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 shadow-lg">
        <div className="container mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {story.display_name}
          </div>
          <Button
            onClick={handleRebuild}
            disabled={isRebuilding || !getAllSectionsComplete()}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isRebuilding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rebuilding...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Rebuild Story
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{helpContent?.title || 'Help'}</DialogTitle>
            <DialogDescription>{helpContent?.content || ''}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component Renderer for ui_schema components
interface ComponentRendererProps {
  component: {
    component: string;
    label?: string;
    key?: string;
    [key: string]: unknown;
  };
  rulesetId: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ComponentRenderer({ component, rulesetId, value, onChange }: ComponentRendererProps) {
  const componentKey = component.key || `${rulesetId}:${component.component}`;
  const currentValue = value ?? component.default ?? (component.component === 'slider' ? component.min ?? 0 : '');

  switch (component.component) {
    case 'slider':
      return (
        <div className="space-y-2">
          <Label>{component.label || 'Slider'}</Label>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{component.minLabel || 'Min'}</span>
              <span className="font-medium">{currentValue as number}</span>
              <span>{component.maxLabel || 'Max'}</span>
            </div>
            <Slider
              value={[currentValue as number]}
              onValueChange={(vals) => onChange(vals[0])}
              min={(component.min as number) ?? 0}
              max={(component.max as number) ?? 100}
              step={(component.step as number) ?? 1}
              className="w-full"
            />
          </div>
          {component.description && (
            <p className="text-sm text-muted-foreground">{component.description as string}</p>
          )}
        </div>
      );

    case 'input':
      return (
        <div className="space-y-2">
          <Label htmlFor={componentKey}>{component.label || 'Input'}</Label>
          <Input
            id={componentKey}
            type={(component.type as string) || 'text'}
            value={(currentValue as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={(component.placeholder as string) || ''}
          />
          {component.description && (
            <p className="text-sm text-muted-foreground">{component.description as string}</p>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-2">
          <Label htmlFor={componentKey}>{component.label || 'Textarea'}</Label>
          <Textarea
            id={componentKey}
            value={(currentValue as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={(component.placeholder as string) || ''}
            rows={(component.rows as number) || 4}
            className="resize-none"
          />
          {component.description && (
            <p className="text-sm text-muted-foreground">{component.description as string}</p>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-start space-x-2">
          <Checkbox
            id={componentKey}
            checked={(currentValue as boolean) || false}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label htmlFor={componentKey} className="flex-1 cursor-pointer">
            <div>
              <p className="font-medium">{component.label || 'Checkbox'}</p>
              {component.description && (
                <p className="text-sm text-muted-foreground">{component.description as string}</p>
              )}
            </div>
          </Label>
        </div>
      );

    default:
      return (
        <Alert>
          <AlertDescription>
            Unknown component type: {component.component}. Supported types: slider, input, textarea, checkbox
          </AlertDescription>
        </Alert>
      );
  }
}

// Mechanics & Plot Section Component
interface MechanicsPlotContentProps {
  allRulesets: RulesetTemplate[];
  isLoading?: boolean;
  selectedMainSystemId: string | null;
  selectedRulesetIds: Set<string>;
  onMainSystemChange: (rulesetId: string) => void;
  onSubsystemToggle: (rulesetId: string, checked: boolean) => void;
  onModifierToggle: (rulesetId: string, checked: boolean, exclusionGroupId: string | null) => void;
  componentValues: Record<string, unknown>;
  onComponentValueChange: (key: string, value: unknown) => void;
  selectedRulesets: RulesetTemplate[];
  objectives: Array<{ id: string; text: string }>;
  scenes: Array<{ id: string; title: string; description: string }>;
  onAddObjective: () => void;
  onRemoveObjective: (id: string) => void;
  onUpdateObjective: (id: string, text: string) => void;
  onAddScene: () => void;
  onRemoveScene: (id: string) => void;
  onUpdateScene: (id: string, field: 'title' | 'description', value: string) => void;
}

function MechanicsPlotContent({
  allRulesets,
  isLoading,
  selectedMainSystemId,
  selectedRulesetIds,
  onMainSystemChange,
  onSubsystemToggle,
  onModifierToggle,
  componentValues,
  onComponentValueChange,
  selectedRulesets: selectedRulesetsProp,
  objectives,
  scenes,
  onAddObjective,
  onRemoveObjective,
  onUpdateObjective,
  onAddScene,
  onRemoveScene,
  onUpdateScene,
}: MechanicsPlotContentProps) {
  // Read directly from shared store to ensure we always have the latest selected rulesets
  const { selectedRulesets } = useStudioStore();
  
  // Use store value if available, otherwise fall back to prop
  const activeSelectedRulesets = selectedRulesets.length > 0 ? selectedRulesets : selectedRulesetsProp;
  // Filter rulesets by type
  const mainSystemRulesets = allRulesets.filter((r) => r.rule_type === 'MAIN_SYSTEM');
  const subsystemRulesets = allRulesets.filter(
    (r) => r.rule_type === 'SUBSYSTEM' && r.main_system_dependency === selectedMainSystemId
  );
  const modifierRulesets = allRulesets.filter((r) => r.rule_type === 'MODIFIER');

  // Group modifiers by exclusion group
  const modifiersByExclusionGroup: Record<string, RulesetTemplate[]> = {};
  const modifiersNoGroup: RulesetTemplate[] = [];

  modifierRulesets.forEach((modifier) => {
    if (modifier.exclusion_group_id && modifier.exclusion_group) {
      const groupId = modifier.exclusion_group_id;
      if (!modifiersByExclusionGroup[groupId]) {
        modifiersByExclusionGroup[groupId] = [];
      }
      modifiersByExclusionGroup[groupId].push(modifier);
    } else {
      modifiersNoGroup.push(modifier);
    }
  });

  // Check if a modifier is disabled due to exclusion group
  const isModifierDisabled = (modifier: RulesetTemplate): boolean => {
    if (!modifier.exclusion_group_id) return false;
    // If another modifier in the same exclusion group is selected, this one is disabled
    const groupModifiers = modifiersByExclusionGroup[modifier.exclusion_group_id] || [];
    const hasSelectedInGroup = groupModifiers.some(
      (m) => m.id !== modifier.id && selectedRulesetIds.has(m.id)
    );
    return hasSelectedInGroup;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main System Selection */}
      <div className="space-y-4">
        <Label>Main System *</Label>
        {mainSystemRulesets.length === 0 ? (
          <Alert>
            <AlertDescription>No MAIN_SYSTEM rulesets available.</AlertDescription>
          </Alert>
        ) : (
          <RadioGroup
            value={selectedMainSystemId || ''}
            onValueChange={onMainSystemChange}
            className="space-y-3"
          >
            {mainSystemRulesets.map((ruleset) => (
              <div key={ruleset.id} className="flex items-start space-x-3 border rounded-lg p-3">
                <RadioGroupItem value={ruleset.id} id={`main-${ruleset.id}`} className="mt-1" />
                <Label htmlFor={`main-${ruleset.id}`} className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">{ruleset.display_name}</p>
                    {ruleset.description_short && (
                      <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
      </div>

      {/* Subsystems */}
      {selectedMainSystemId && (
        <div className="space-y-4">
          <Label>Subsystems</Label>
          {subsystemRulesets.length === 0 ? (
            <Alert>
              <AlertDescription>No subsystems available for the selected main system.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 border rounded-lg p-4 max-h-96 overflow-y-auto">
              {subsystemRulesets.map((ruleset) => {
                const isChecked = selectedRulesetIds.has(ruleset.id);
                return (
                  <div key={ruleset.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={`sub-${ruleset.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => onSubsystemToggle(ruleset.id, checked as boolean)}
                      className="mt-1"
                    />
                    <Label htmlFor={`sub-${ruleset.id}`} className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-medium">{ruleset.display_name}</p>
                        {ruleset.description_short && (
                          <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modifiers */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Label>Modifiers</Label>
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>
        {modifierRulesets.length === 0 ? (
          <Alert>
            <AlertDescription>No modifiers available.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 border rounded-lg p-4 max-h-96 overflow-y-auto">
            {/* Modifiers with exclusion groups */}
            {Object.entries(modifiersByExclusionGroup).map(([groupId, modifiers]) => {
              const group = modifiers[0]?.exclusion_group;
              return (
                <div key={groupId} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {group?.group_name || 'Exclusion Group'}
                    </p>
                  </div>
                  <div className="space-y-2 pl-6">
                    {modifiers.map((ruleset) => {
                      const isChecked = selectedRulesetIds.has(ruleset.id);
                      const isDisabled = isModifierDisabled(ruleset);
                      return (
                        <div
                          key={ruleset.id}
                          className={`flex items-start space-x-3 ${isDisabled ? 'opacity-50' : ''}`}
                        >
                          <Checkbox
                            id={`mod-${ruleset.id}`}
                            checked={isChecked}
                            disabled={isDisabled}
                            onCheckedChange={(checked) =>
                              onModifierToggle(ruleset.id, checked as boolean, ruleset.exclusion_group_id)
                            }
                            className="mt-1"
                          />
                          <Label
                            htmlFor={`mod-${ruleset.id}`}
                            className={`flex-1 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div>
                              <p className="font-medium">{ruleset.display_name}</p>
                              {ruleset.description_short && (
                                <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                              )}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Modifiers without exclusion groups */}
            {modifiersNoGroup.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Other Modifiers</p>
                <div className="space-y-2 pl-6">
                  {modifiersNoGroup.map((ruleset) => {
                    const isChecked = selectedRulesetIds.has(ruleset.id);
                    return (
                      <div key={ruleset.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={`mod-${ruleset.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            onModifierToggle(ruleset.id, checked as boolean, null)
                          }
                          className="mt-1"
                        />
                        <Label htmlFor={`mod-${ruleset.id}`} className="flex-1 cursor-pointer">
                          <div>
                            <p className="font-medium">{ruleset.display_name}</p>
                            {ruleset.description_short && (
                              <p className="text-sm text-muted-foreground">{ruleset.description_short}</p>
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic UI Area - Renders configuration and plot components from selected rulesets */}
      {activeSelectedRulesets.length > 0 && (() => {
        // Collect all config_panel_components and plot_panel_components from selected rulesets (read from shared store)
        const configComponents: Array<{ ruleset: RulesetTemplate; component: unknown; index: number }> = [];
        const plotComponents: Array<{ ruleset: RulesetTemplate; component: unknown; index: number }> = [];
        
        activeSelectedRulesets.forEach((ruleset) => {
          if (ruleset?.definition) {
            const def = ruleset.definition as Record<string, unknown>;
            const uiSchema = def.ui_schema as Record<string, unknown> | undefined;
            
            // Collect config_panel_components
            if (uiSchema?.config_panel_components) {
              const components = uiSchema.config_panel_components as unknown[];
              components.forEach((comp, idx) => {
                configComponents.push({ ruleset, component: comp, index: idx });
              });
            }
            
            // Collect plot_panel_components
            if (uiSchema?.plot_panel_components) {
              const components = uiSchema.plot_panel_components as unknown[];
              components.forEach((comp, idx) => {
                plotComponents.push({ ruleset, component: comp, index: idx });
              });
            }
          }
        });

        // Check if we have any dynamic components to render
        const hasPlotComponents = plotComponents.length > 0;
        const hasConfigComponents = configComponents.length > 0;

        // Always show the dynamic UI area section if we have selected rulesets, even if no components yet
        return (
          <div className="space-y-6 border-t pt-6 mt-6">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">Dynamic Ruleset Components</Label>
              {!hasConfigComponents && !hasPlotComponents && (
                <span className="text-sm text-muted-foreground">
                  (No additional configuration needed for selected rulesets)
                </span>
              )}
            </div>
            
            {/* Objectives Editor - Show if any ruleset has plot_panel_components */}
            {hasPlotComponents && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Objectives</Label>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={onAddObjective}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Objective
                  </Button>
                </div>
                {objectives.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p className="text-sm">No objectives yet. Click &quot;Add Objective&quot; to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {objectives.map((obj) => (
                      <div key={obj.id} className="flex items-start gap-2 border rounded-lg p-3">
                        <Input
                          value={obj.text}
                          onChange={(e) => onUpdateObjective(obj.id, e.target.value)}
                          placeholder="Enter objective description..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveObjective(obj.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scenes Editor - Show if any ruleset has plot_panel_components */}
            {hasPlotComponents && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Scenes</Label>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={onAddScene}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Scene
                  </Button>
                </div>
                {scenes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p className="text-sm">No scenes yet. Click &quot;Add Scene&quot; to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scenes.map((scene) => (
                      <div key={scene.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            value={scene.title}
                            onChange={(e) => onUpdateScene(scene.id, 'title', e.target.value)}
                            placeholder="Scene title..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveScene(scene.id)}
                            className="ml-2"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <Textarea
                          value={scene.description}
                          onChange={(e) => onUpdateScene(scene.id, 'description', e.target.value)}
                          placeholder="Scene description..."
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Config Components (sliders, inputs, etc.) */}
            {hasConfigComponents && (
              <div className="space-y-6">
                {configComponents.map(({ ruleset, component, index }) => {
                  const comp = component as { component: string; key?: string; [key: string]: unknown };
                  const componentKey = comp.key || `${ruleset.id}:config:${index}`;
                  const valueKey = `${ruleset.id}:${componentKey}`;
                  return (
                    <div key={valueKey} className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-3">
                        From: {ruleset.display_name}
                      </div>
                      <ComponentRenderer
                        component={comp}
                        rulesetId={ruleset.id}
                        value={componentValues[valueKey]}
                        onChange={(value) => onComponentValueChange(valueKey, value)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Plot Components (other than objective_editor which is handled above) */}
            {plotComponents.map(({ ruleset, component, index }) => {
              const comp = component as { component: string; key?: string; [key: string]: unknown };
              
              // Skip objective_editor as it's handled by the Objectives editor above
              if (comp.component === 'objective_editor') {
                return null;
              }
              
              const componentKey = comp.key || `${ruleset.id}:plot:${index}`;
              const valueKey = `${ruleset.id}:${componentKey}`;
              return (
                <div key={valueKey} className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-3">
                    From: {ruleset.display_name}
                  </div>
                  <ComponentRenderer
                    component={comp}
                    rulesetId={ruleset.id}
                    value={componentValues[valueKey]}
                    onChange={(value) => onComponentValueChange(valueKey, value)}
                  />
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
