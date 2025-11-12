import { useState, useEffect, useRef } from 'react';
import { type EntryPoint } from '@/services/admin.entryPoints';
import { BasicsStep } from './Steps/BasicsStep';
import { NPCsStep } from './Steps/NPCsStep';
import { SegmentsStep } from './Steps/SegmentsStep';
import { PreviewStep } from './Steps/PreviewStep';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export interface WizardData {
  // Step 1: Basics
  name?: string;
  slug?: string;
  type?: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  worldId?: string;
  rulesetIds?: string[];
  tags?: string[];
  subtitle?: string;
  synopsis?: string;
  
  // Step 2: NPCs
  npcIds?: string[];
  packIds?: string[];
  
  // Step 3: Segments (read-only, for display)
  segments?: Array<{
    scope: string;
    refId: string;
    count: number;
    missing: boolean;
  }>;
  
  // Step 4: Preview
  previewData?: any;
}

interface EntryWizardProps {
  entry: EntryPoint;
  currentStep: number;
  onStepComplete: (stepData: any) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function EntryWizard({ 
  entry, 
  currentStep, 
  onStepComplete, 
  onDirtyChange 
}: EntryWizardProps) {
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showWorldChangeDialog, setShowWorldChangeDialog] = useState(false);
  const [pendingWorldId, setPendingWorldId] = useState<string | null>(null);
  const previousWorldIdRef = useRef<string | undefined>(undefined);
  
  // Initialize wizard data from entry
  useEffect(() => {
    if (entry) {
      // Extract ruleset IDs from the rulesets array if available
      const rulesetIds = entry.rulesets 
        ? entry.rulesets
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(r => r.id)
        : [];
      
      const initialWorldId = entry.world_id;
      previousWorldIdRef.current = initialWorldId;
      
      setWizardData({
        name: entry.name,
        slug: entry.slug,
        type: entry.type || 'adventure',
        worldId: initialWorldId,
        rulesetIds,
        tags: entry.tags || [],
        subtitle: entry.subtitle,
        synopsis: entry.synopsis,
        npcIds: [], // Will be loaded separately
      });
    }
  }, [entry]);
  
  // Update dirty state
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  
  const updateWizardData = (updates: Partial<WizardData>) => {
    // Check if world is changing and there are selected NPCs or packs
    if (updates.worldId && updates.worldId !== previousWorldIdRef.current) {
      const hasNPCs = wizardData.npcIds && wizardData.npcIds.length > 0;
      const hasPacks = wizardData.packIds && wizardData.packIds.length > 0;
      
      if (hasNPCs || hasPacks) {
        // Show confirmation dialog
        setPendingWorldId(updates.worldId);
        setShowWorldChangeDialog(true);
        return; // Don't update yet, wait for user confirmation
      } else {
        // No NPCs or packs selected, safe to change world
        previousWorldIdRef.current = updates.worldId;
      }
    }
    
    setWizardData(prev => {
      const newData = { ...prev, ...updates };
      // If world changed and user confirmed, clear NPCs and packs
      if (updates.worldId && updates.worldId !== previousWorldIdRef.current) {
        newData.npcIds = [];
        newData.packIds = [];
      }
      return newData;
    });
    setIsDirty(true);
  };
  
  const handleWorldChangeConfirm = () => {
    if (pendingWorldId) {
      previousWorldIdRef.current = pendingWorldId;
      setWizardData(prev => ({
        ...prev,
        worldId: pendingWorldId,
        npcIds: [], // Clear NPCs when world changes
        packIds: [], // Clear NPC packs when world changes
      }));
      setIsDirty(true);
    }
    setShowWorldChangeDialog(false);
    setPendingWorldId(null);
  };
  
  const handleWorldChangeCancel = () => {
    setShowWorldChangeDialog(false);
    setPendingWorldId(null);
  };
  
  const handleStepComplete = (stepData: any) => {
    updateWizardData(stepData);
    setIsDirty(false);
    onStepComplete(stepData);
  };
  
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <BasicsStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      case 1:
        return (
          <NPCsStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      case 2:
        return (
          <SegmentsStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      case 3:
        return (
          <PreviewStep
            entry={entry}
            data={wizardData}
            onUpdate={updateWizardData}
            onComplete={handleStepComplete}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };
  
  return (
    <>
      <div className="space-y-6">
        {renderStep()}
      </div>
      
      <ConfirmationDialog
        open={showWorldChangeDialog}
        onOpenChange={setShowWorldChangeDialog}
        title="Change World?"
        description={`You have ${wizardData.npcIds?.length || 0} NPC(s) and ${wizardData.packIds?.length || 0} NPC pack(s) selected for this story. Changing the world will clear all selected NPCs and packs, as NPCs can only belong to one world. Are you sure you want to continue?`}
        confirmText="Change World & Clear NPCs"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleWorldChangeConfirm}
        onCancel={handleWorldChangeCancel}
      />
    </>
  );
}
