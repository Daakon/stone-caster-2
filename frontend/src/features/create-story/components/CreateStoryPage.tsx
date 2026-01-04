/**
 * @deprecated Incomplete refactor. Use CastingCircleWizard instead.
 * Create Story Page
 * Route entry point for the Story Creation (Casting Circle) wizard
 * 
 * Orchestrates the multi-step wizard flow
 */

import React, { useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { StoryWizardLayout } from './StoryWizardLayout';
import { Step1_World } from './Step1_World';
import { NarrativeStep } from './NarrativeStep';
import { Step2_Forces } from './Step2_Forces';
import { Step3_Elements } from './Step3_Elements';
import { Step4_Lore } from './Step4_Lore';
import { Step5_Compile } from './Step5_Compile';

export function CreateStoryPage() {
  const { id, step } = useParams<{ id: string; step?: string }>();
  const navigate = useNavigate();
  const draft = useStoryDraftStore((state) => state.draft);
  const isLoading = useStoryDraftStore((state) => state.isLoading);
  const error = useStoryDraftStore((state) => state.error);
  const initializeDraft = useStoryDraftStore((state) => state.initializeDraft);
  const loadDraft = useStoryDraftStore((state) => state.loadDraft);
  const setStep = useStoryDraftStore((state) => state.setStep);

  // Ref to track initialization status
  const initialized = React.useRef(false);

  // Step mapping
  const STEP_SLUGS = ['world', 'forces', 'elements', 'lore', 'narrative', 'bind'];

  // 1. Initialize or Load Draft
  useEffect(() => {
    if (initialized.current) return;

    // Use ID from route
    const draftIdFromUrl = id;

    if (draftIdFromUrl) {
      if (draft?.draft_id === draftIdFromUrl) {
        // Already loaded
        return;
      }

      console.log('[CreateStoryPage] Loading draft:', draftIdFromUrl);
      loadDraft(draftIdFromUrl);
      initialized.current = true;
    } else if (!draft) {
      // New draft (Fallback, should ideally have an ID routed to it)
      console.log('[CreateStoryPage] Initializing new draft');
      const draftId = `draft-${Date.now()}`;
      initializeDraft(draftId, {
        title: '',
        summary: '',
        genre_tags: [],
        safety_filters: ['pg'],
        ruleset_keys: [],
      });
      initialized.current = true;
      // Navigate to the proper URL structure for the new draft
      navigate(`/stories/${draftId}/compose/world`, { replace: true });
    }
  }, [loadDraft, initializeDraft, id, draft, navigate]);

  // 2. Sync URL Step -> Store Step
  useEffect(() => {
    if (!draft) return;

    const stepSlug = step || 'world';
    const stepIndex = STEP_SLUGS.indexOf(stepSlug);
    const validStepIndex = stepIndex === -1 ? 0 : stepIndex;

    // Only update store if it's different to prevent loops
    if (draft.current_step !== validStepIndex) {
      setStep(validStepIndex);
    }
  }, [step, draft?.draft_id, setStep]); // Depend on step and draft_id uniqueness, not full draft object

  // 3. Sync Store Step -> URL (Optional, mostly for completion redirect or internal logic)
  useEffect(() => {
    if (!draft) return;

    // If the store's step changes (e.g. from internal logic), ensure URL matches
    // This is less critical now that tabs drive the URL directly, but good for safety
    const currentSlug = STEP_SLUGS[draft.current_step] || 'world';
    if (step !== currentSlug) {
      navigate(`/stories/${id}/compose/${currentSlug}`, { replace: true });
    }
  }, [draft?.current_step, navigate, id, step]);

  // Show loading skeleton while loading draft
  if (isLoading) {
    return (
      <StoryWizardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </StoryWizardLayout>
    );
  }

  // Show error state if loading failed
  if (error && !draft) {
    return (
      <StoryWizardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-8">
          <div className="text-destructive text-center">
            <p className="font-semibold mb-2">Failed to load draft</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </StoryWizardLayout>
    );
  }

  // Render step content based on current_step
  const renderStepContent = () => {
    if (!draft) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          Initializing draft...
        </div>
      );
    }

    switch (draft.current_step) {
      case 0:
        return <Step1_World />;
      case 1:
        return <Step2_Forces />;
      case 2:
        return <Step3_Elements />;
      case 3:
        return <Step4_Lore />;
      case 4:
        return <NarrativeStep />;
      case 5:
        return <Step5_Compile />;
      default:
        return (
          <div className="p-8 text-center text-muted-foreground">
            Invalid step
          </div>
        );
    }
  };

  return (
    <StoryWizardLayout>
      {renderStepContent()}
    </StoryWizardLayout>
  );
}
