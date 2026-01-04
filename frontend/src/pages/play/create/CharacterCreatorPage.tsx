/**
 * Character Creator Page v2 ("Character Forge")
 * Phase: Schema & Layout & Form Renderer & Persistence
 * 
 * Uses the data-driven schema engine and local storage persistence.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { getCreationManifest } from '@/services/chimera-api';
import { useEntitySchema } from '@/hooks/chimera/useEntitySchema';
import { useCharacterDraftStore } from '@/stores/useCharacterDraftStore';
import { useDebounce } from '@/hooks/useDebounce';
import { CharacterForgeLayout } from '@/components/layout/CharacterForgeLayout';
import { EntityAttributesForm } from '@/components/chimera/EntityAttributesForm';
import { CharacterReviewSheet } from '@/components/chimera/CharacterReviewSheet';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';

export default function CharacterCreatorPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();

  // 1. Data Fetching - Microservice style
  const { data: manifestData, isLoading: isLoadingStory, error: storyError } = useQuery({
    queryKey: ['creation-manifest', storyId],
    queryFn: () => getCreationManifest(storyId!),
    enabled: !!storyId,
  });

  // Debug logging
  useEffect(() => {
    if (manifestData) {
      console.log('[Forge] Manifest Data:', manifestData);
      console.log('[Forge] Creation Manifest:', manifestData.creation_manifest);
      console.log('[Forge] Active Rulesets:', manifestData.snapshot_story?.config_engine?.active_rulesets);
    }
  }, [manifestData]);

  // 2. Schema Engine
  // We now pass the manifest data directly.
  const baseSteps = useEntitySchema(manifestData);

  // Inject Virtual Review Step
  const steps = useMemo(() => {
    if (baseSteps.length === 0) return [];
    return [
      ...baseSteps,
      {
        id: 'review',
        label: 'Review',
        priority: 999,
        groups: []
      }
    ];
  }, [baseSteps]);

  // 3. Store Persistence
  const { getDraft, saveDraft, clearDraft } = useCharacterDraftStore();

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
    if (baseSteps.length > 0 && !hasInitialized) {
      const draftData = existingDraft?.formData || {};
      const defaults: Record<string, any> = { ...draftData };

      baseSteps.forEach(step => {
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
  }, [baseSteps, hasInitialized, existingDraft, form]);

  // 5. Navigation State
  const [currentStepId, setCurrentStepId] = useState<string>('');

  // Set initial step
  useEffect(() => {
    if (steps.length > 0 && !currentStepId) {
      const draftStep = existingDraft?.stepId;
      // If draft step exists and is valid (or is 'review'), use it. Else first step.
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
  // Increased debounce to 2000ms to reduce save frequency
  const debouncedValues = useDebounce(formValues, 2000);

  // Track last saved string to avoid redundant saves on navigation or re-render
  const lastSavedJson = React.useRef<string>('');

  useEffect(() => {
    // 1. Basic gating
    if (Object.keys(debouncedValues).length === 0) return;
    if (!form.formState.isDirty) return;
    if (!storyId || !currentStepId) return;

    // 2. Diff against last successful save
    const currentJson = JSON.stringify(debouncedValues);
    if (currentJson === lastSavedJson.current) {
      return;
    }

    const performSave = async () => {
      setIsSaving(true);
      // Save to local store
      saveDraft(storyId, currentStepId, debouncedValues);
      console.log("[Autosave] Draft saved to local storage");

      // Update ref to current state
      lastSavedJson.current = currentJson;

      await new Promise(resolve => setTimeout(resolve, 300));
      setIsSaving(false);
    };

    performSave();
  }, [debouncedValues, storyId, currentStepId, saveDraft, form.formState.isDirty]);

  // 7. Handlers
  const handleManualSave = (exit = false) => {
    if (!storyId || !currentStepId) return;
    const values = form.getValues();
    saveDraft(storyId, currentStepId, values);
    toast.success('Draft saved');
    if (exit) {
      navigate(`/stories/${storyId}`);
    }
  };

  const handleSaveAndExit = () => handleManualSave(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsSaving(true);

    const toastId = toast.loading("Forging character...");

    try {
      const formData = form.getValues();
      const story = manifestData?.snapshot_story;

      // FIX: Robust Parsing of config_engine and manifests
      let manifest = story?.creation_manifest; // Try top-level first

      if (!manifest && story?.config_engine) {
        if (typeof story.config_engine === 'string') {
          try {
            const parsedConfig = JSON.parse(story.config_engine);
            manifest = parsedConfig.creation_manifest;
          } catch (e) {
            console.warn("Could not parse config_engine string", e);
          }
        } else {
          // It's already an object
          manifest = story.config_engine.creation_manifest;
        }
      }

      // FIX 1 & 2: Data Transformation Loop with Explicit Safety Net
      const processedFormData: any = { ...formData };

      // A. Explicit Safety Net (Run this regardless of manifest)
      const knownArrayKeys = ['core_traits', 'occupation_tags', 'aversion_triggers', 'interest_triggers', 'essence_alignment'];
      knownArrayKeys.forEach(key => {
        if (typeof processedFormData[key] === 'string') {
          processedFormData[key] = processedFormData[key]
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
        }
      });

      // B. Dynamic Manifest Crawl (for other list fields)
      if (manifest && manifest.steps) {
        manifest.steps.forEach((step: any) => {
          step.groups.forEach((group: any) => {
            group.fields.forEach((field: any) => {
              // Tag Lists -> Arrays
              if ((field.control === 'tag_list' || field.control === 'complex_list') && typeof processedFormData[field.key] === 'string') {
                processedFormData[field.key] = processedFormData[field.key]
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0);
              }
              // Sliders -> Numbers
              if ((field.control === 'slider' || field.control === 'number') && processedFormData[field.key] !== undefined) {
                processedFormData[field.key] = Number(processedFormData[field.key]);
              }
            });
          });
        });
      }

      // FIX 3: Ensure applied_rulesets is correct and robust
      let appliedRulesetIds: string[] = [];
      if (story?.active_rulesets && Array.isArray(story.active_rulesets)) {
        appliedRulesetIds = story.active_rulesets.map((r: any) => r.id);
      } else if (story?.config_engine?.active_rulesets && Array.isArray(story.config_engine.active_rulesets)) {
        appliedRulesetIds = story.config_engine.active_rulesets.map((r: any) => r.id);
      } else {
        // Fallback to manifest data if available
        appliedRulesetIds = manifestData?.snapshot_story?.config_engine?.active_rulesets?.map((r: any) => r.id) || [];
      }

      // FIX 4: Ensure world_id is passed
      const worldId = manifestData?.snapshot_world?.id || storyId;
      if (!worldId) throw new Error("Missing World Scope - cannot create character without a world context.");

      // Prepare Data
      // Wrap flat data into Engine Structure (tier1_entity)
      const statePayload = {
        tier1_entity: {
          ...processedFormData
        }
      };

      // 3. Save Template (The Player Character) via Backend API
      console.log("[Forge] Creating Player Character Template via API...", { name: processedFormData.name, worldId });

      const templatePayload = {
        name: processedFormData.name || 'Unnamed',
        state_snapshot: statePayload,
        world_id: worldId
      };

      const pcResult = await apiPost('/api/v2/chimera/player-characters', templatePayload);

      if (!pcResult.ok) {
        throw new Error(pcResult.error.message || 'Failed to save character template');
      }

      const pc = pcResult.data;
      console.log("[Forge] Template Created:", pc.id);

      // NOTE: We do NOT instantiate an entity in chimera_entities for Players.
      // The Engine loads them directly from chimera_player_characters.

      // Success!
      if (storyId) clearDraft(storyId);
      toast.dismiss(toastId);
      toast.success(`Welcome to ${story?.title || 'the story'}`);

      // Redirect to story play view
      navigate(`/play/story/${storyId}`, { replace: true });

    } catch (error) {
      console.error("Submission failed:", error);
      toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : "Failed to submit character");
    } finally {
      setIsSubmitting(false);
      setIsSaving(false);
    }
  };

  // 8. Render Loading / Error
  if (isLoadingStory) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading Forge...</span>
      </div>
    );
  }

  if (storyError || (!manifestData && !isLoadingStory)) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Failed to load story</h1>
        <p className="text-muted-foreground mb-4">The story context is missing or invalid.</p>
        <Button onClick={() => navigate('/stories')}>Back to Stories</Button>
      </div>
    );
  }

  if (baseSteps.length === 0) {
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
      onSave={() => handleManualSave(false)}
      onSaveAndExit={handleSaveAndExit}
      onFinish={handleFinish}
      isSaving={isSaving || isSubmitting}
    >
      {currentStepId === 'review' ? (
        <CharacterReviewSheet
          manifest={manifestData?.creation_manifest}
          data={form.watch()}
        />
      ) : activeStep ? (
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
