/**
 * Create Story Page
 * Route entry point for the Story Creation (Casting Circle) wizard
 * 
 * Orchestrates the multi-step wizard flow
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { StoryWizardLayout } from './StoryWizardLayout';
import { Step1_World } from './Step1_World';
import { Step2_Forces } from './Step2_Forces';
import { Step3_Elements } from './Step3_Elements';
import { Step4_Lore } from './Step4_Lore';
import { Step5_Compile } from './Step5_Compile';

export function CreateStoryPage() {
  const [searchParams] = useSearchParams();
  const draft = useStoryDraftStore((state) => state.draft);
  const isLoading = useStoryDraftStore((state) => state.isLoading);
  const error = useStoryDraftStore((state) => state.error);
  const initializeDraft = useStoryDraftStore((state) => state.initializeDraft);
  const loadDraft = useStoryDraftStore((state) => state.loadDraft);

  // Initialize or load draft on mount
  useEffect(() => {
    const draftIdFromUrl = searchParams.get('draftId');
    
    if (draftIdFromUrl) {
      // Check if draft is already loaded with matching ID
      if (draft?.draft_id === draftIdFromUrl) {
        // Draft already loaded, no action needed
        return;
      }
      
      // Load draft from backend
      loadDraft(draftIdFromUrl);
    } else if (!draft) {
      // Generate a new draft ID if no draft exists
      const draftId = `draft-${Date.now()}`;
      initializeDraft(draftId, {
        title: '',
        summary: '',
        genre_tags: [],
        safety_filters: ['pg'],
        ruleset_keys: [],
      });
    }
  }, [draft, initializeDraft, loadDraft, searchParams]);

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
