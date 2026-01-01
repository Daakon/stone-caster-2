/**
 * Character Creator Page v2 ("Character Forge")
 * Phase: Schema & Layout & Form Renderer & Persistence
 * 
 * Uses the data-driven schema engine and local storage persistence.
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { getCompiledStory, getWorld, initializeGame } from '@/services/chimera-api';
import { useEntitySchema } from '@/hooks/chimera/useEntitySchema';
import { useCharacterDraftStore } from '@/stores/useCharacterDraftStore';
import { useDebounce } from '@/hooks/useDebounce';
import { CharacterForgeLayout } from '@/components/layout/CharacterForgeLayout';
import { EntityAttributesForm } from '@/components/chimera/EntityAttributesForm';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { RulesetDefinition, WorldDefinition } from '@shared/types/chimera-authoring';

export default function CharacterCreatorPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();

  // 1. Data Fetching
  const { data: compiledStory, isLoading: isLoadingStory, error: storyError } = useQuery({
    queryKey: ['compiled-story', storyId],
    queryFn: () => getCompiledStory(storyId!),
    enabled: !!storyId,
  });

  // Debug logging
  useEffect(() => {
    if (compiledStory) {
      console.log('[Forge] Compiled Story:', compiledStory);
      console.log('[Forge] Snapshot World:', (compiledStory as any).snapshot_world);
      console.log('[Forge] Creation Config:', (compiledStory as any).config_engine?.creation);
    }
  }, [compiledStory]);

  // Use snapshot world from compiled story if available
  // This avoids a separate fetch and ensures we use the version the story was compiled with.
  const world = (compiledStory as any)?.snapshot_world as WorldDefinition | undefined;
  const isLoadingWorld = isLoadingStory; // Since it's part of the story payload now

  // Extract creation config (the compiled schema instructions)
  const configEngine = (compiledStory?.config_engine as any);
  const creationConfig = configEngine?.creation;

  // Transform creation fields into a synthetic ruleset for the schema hook
  const effectiveRulesets = useMemo(() => {
    // 1. Prefer full ruleset definitions if available (contains rich metadata like ui_group)
    if (configEngine?.active_rulesets && Array.isArray(configEngine.active_rulesets)) {
      return configEngine.active_rulesets as RulesetDefinition[];
    }

    // 2. Fallback to synthetic ruleset from creation.fields
    if (!creationConfig?.fields) return undefined;

    // Convert array of fields back to a map structure for useEntitySchema
    const formHints: Record<string, any> = {};
    if (Array.isArray(creationConfig.fields)) {
      creationConfig.fields.forEach((field: any) => {
        if (field.key) {
          formHints[field.key] = field;
        }
      });
    }

    // Return as a synthetic ruleset
    const syntheticRuleset: RulesetDefinition = {
      id: 'compiled-ruleset',
      name: 'Compiled Rules',
      slug: 'compiled-rules',
      version: '1.0',
      type: 'foundation',
      description: 'Compiled schema from story config',
      state_contributions: {
        form_hints: formHints
      },
      actions: {},
      dependencies: [],
      exclusions: [],
      category: 'foundation' // Add required property
    };

    return [syntheticRuleset];
  }, [configEngine, creationConfig]);

  // 2. Schema Engine
  const steps = useEntitySchema(world, effectiveRulesets, { targetKind: 'player' });

  // 3. Store Persistence
  const { getDraft, saveDraft, clearDraft } = useCharacterDraftStore();

  // NOTE: Zustand persistence is synchronous for localStorage by default,
  // so we can read it immediately during render or effect.
  const existingDraft = storyId ? getDraft(storyId) : undefined;

  // 4. Form Management
  const form = useForm({
    mode: "onChange",
    defaultValues: existingDraft?.formData || {} as Record<string, any>
  });

  // State for tracking if we've initialized the form with defaults
  const [hasInitialized, setHasInitialized] = useState(false);

  // Populate defaults when steps load (merging with draft if needed)
  useEffect(() => {
    if (steps.length > 0 && !hasInitialized) {
      const draftData = existingDraft?.formData || {};
      const defaults: Record<string, any> = { ...draftData };

      steps.forEach(step => {
        step.groups.forEach(group => {
          group.fields.forEach(field => {
            // Only set default if not already present in draft
            if (defaults[field.key] === undefined) {
              if (field.default !== undefined) {
                defaults[field.key] = field.default;
              } else if (field.control === 'slider' || field.control === 'number') {
                defaults[field.key] = field.min ?? 0;
              } else if (field.control === 'tag_list') {
                defaults[field.key] = '';
              } else {
                defaults[field.key] = '';
              }
            }
          });
        });
      });

      form.reset(defaults);
      setHasInitialized(true);
    }
  }, [steps, hasInitialized, existingDraft, form]);

  // 5. Navigation State
  const [currentStepId, setCurrentStepId] = useState<string>('');

  // Set initial step
  useEffect(() => {
    if (steps.length > 0 && !currentStepId) {
      // Prefer draft step if valid
      const draftStep = existingDraft?.stepId;
      const isValidStep = draftStep && steps.some(s => s.id === draftStep);

      setCurrentStepId((isValidStep ? draftStep : steps[0].id) as string);
    }
  }, [steps, currentStepId, existingDraft]);

  const activeStep = useMemo(() =>
    steps.find(s => s.id === currentStepId),
    [steps, currentStepId]
  );

  // 6. Autosave Logic
  const [isSaving, setIsSaving] = useState(false);
  const formValues = form.watch();
  const debouncedValues = useDebounce(formValues, 1000);

  useEffect(() => {
    // Autosave trigger
    if (Object.keys(debouncedValues).length === 0) return;
    if (!form.formState.isDirty && !existingDraft) return; // Save if existing draft update

    if (!storyId || !currentStepId) return;

    const performSave = async () => {
      setIsSaving(true);
      // Save to local store
      saveDraft(storyId, currentStepId, debouncedValues);
      console.log("[Autosave] Draft saved to local storage");

      await new Promise(resolve => setTimeout(resolve, 300));
      setIsSaving(false);
    };

    performSave();
  }, [debouncedValues, storyId, currentStepId, saveDraft]);

  // 7. Mutation
  const initializeMutation = useMutation({
    mutationFn: (data: any) => initializeGame(storyId!, data),
    onSuccess: (data) => {
      // Clear draft on success
      if (storyId) clearDraft(storyId);

      toast.success('Character created! Starting game...');
      navigate(`/play/${data.gameStateId}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create character');
    },
  });

  // 8. Handlers
  const handleManualSave = () => {
    if (!storyId || !currentStepId) return;
    const values = form.getValues();
    saveDraft(storyId, currentStepId, values);
    toast.success('Draft saved');
  };

  const handleSaveAndExit = () => {
    handleManualSave();
    navigate(`/stories/${storyId}`);
  };

  const handleFinish = () => {
    const data = form.getValues();
    initializeMutation.mutate(data);
  };

  // 9. Render Loading / Error
  if (isLoadingStory || isLoadingWorld) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading Forge...</span>
      </div>
    );
  }

  if (storyError || (!compiledStory && !isLoadingStory)) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Failed to load story</h1>
        <p className="text-muted-foreground mb-4">The story context is missing or invalid.</p>
        <Button onClick={() => navigate('/stories')}>Back to Stories</Button>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <p className="text-muted-foreground">No character creation steps found for this story.</p>
        <Button variant="link" onClick={() => navigate('/stories')}>Go Back</Button>
      </div>
    );
  }

  return (
    <CharacterForgeLayout
      steps={steps}
      currentStepId={currentStepId}
      onStepChange={setCurrentStepId}
      onSave={handleManualSave}
      onSaveAndExit={handleSaveAndExit}
      onFinish={handleFinish}
      isSaving={isSaving || initializeMutation.isPending}
    >
      {activeStep ? (
        <EntityAttributesForm
          step={activeStep}
          control={form.control}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Select a step to begin...
        </div>
      )}
    </CharacterForgeLayout>
  );
}
